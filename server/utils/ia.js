// Cliente de IA em cascata (só no servidor). Todos os provedores falam o formato OpenAI de chat completions;
// cada um só muda o endereço e a chave. As chaves vêm do ambiente (.env no computador, Secrets na Vercel) e
// nunca vão para o navegador, para o banco ou para o log. Nenhum texto enviado ou recebido é guardado.
//
// executarCascata: pega os modelos ativos para a tarefa (na ordem do catálogo), pula os que passaram da cota
// grátis do dia, tenta até 3 e para no primeiro que devolve uma resposta válida. Cada tentativa é registrada
// (resultado, motivo, tempo e tokens); três falhas seguidas pausam o modelo.
import { serverSupabaseServiceRole } from '#supabase/server'
import { dentroDaCota, lerJson } from '#shared/regras/ia.js'

export class FalhaIA extends Error {
  constructor(categoria, detalhe = '') {
    super(detalhe || categoria)
    this.categoria = categoria
  }
}

export class FalhaCascata extends Error {
  constructor(tentativas) {
    super('Nenhum modelo respondeu.')
    this.tentativas = tentativas
  }
}

const ENDERECOS = {
  groq: () => 'https://api.groq.com/openai/v1',
  cloudflare: () => (process.env.CLOUDFLARE_ACCOUNT_ID ? `https://api.cloudflare.com/client/v4/accounts/${process.env.CLOUDFLARE_ACCOUNT_ID}/ai/v1` : null),
  gemini: () => 'https://generativelanguage.googleapis.com/v1beta/openai',
  openrouter: () => 'https://openrouter.ai/api/v1',
}

export const temChave = (modelo) => !!process.env[modelo.variavel_chave] && !!ENDERECOS[modelo.provedor]?.()

// Uma chamada a um modelo. Devolve { texto, tokensEntrada, tokensSaida, latencia } ou lança FalhaIA.
export async function chamarModelo(modelo, mensagens, { maxTokens = 4500, tempoMs = 45000, json = true } = {}) {
  const chave = process.env[modelo.variavel_chave]
  const base = ENDERECOS[modelo.provedor]?.()
  if (!chave || !base) throw new FalhaIA('sem_chave')
  const completo = {
    model: modelo.modelo,
    messages: mensagens,
    temperature: 0.4,
    max_tokens: maxTokens,
    ...(json && (modelo.capacidades ?? []).includes('json_object') ? { response_format: { type: 'json_object' } } : {}),
    ...(modelo.provedor === 'groq' && modelo.modelo.startsWith('openai/gpt-oss') ? { reasoning_effort: 'low' } : {}),
  }
  const inicio = Date.now()
  const pedir = async (corpo) => {
    let resposta
    try {
      resposta = await fetch(`${base}/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${chave}` },
        body: JSON.stringify(corpo),
        signal: AbortSignal.timeout(tempoMs),
      })
    }
    catch (erro) {
      throw new FalhaIA(erro?.name === 'TimeoutError' || erro?.name === 'AbortError' ? 'tempo_esgotado' : 'http')
    }
    return resposta
  }
  let resposta = await pedir(completo)
  // Parâmetro que o provedor não aceita (formato JSON, esforço de raciocínio): tenta uma vez com o pedido mínimo.
  if (resposta.status === 400) {
    resposta = await pedir({ model: completo.model, messages: completo.messages, temperature: completo.temperature, max_tokens: completo.max_tokens })
  }
  if (resposta.status === 401 || resposta.status === 403) throw new FalhaIA('sem_chave', `HTTP ${resposta.status}`)
  if (resposta.status === 429 || resposta.status === 413) throw new FalhaIA('limite', `HTTP ${resposta.status}`)
  if (!resposta.ok) throw new FalhaIA('http', `HTTP ${resposta.status}`)
  let dados
  try {
    dados = await resposta.json()
  }
  catch {
    throw new FalhaIA('saida_invalida')
  }
  const texto = dados?.choices?.[0]?.message?.content
  if (typeof texto !== 'string' || !texto.trim()) throw new FalhaIA('saida_invalida', 'resposta vazia')
  return {
    texto,
    tokensEntrada: Number(dados?.usage?.prompt_tokens) || 0,
    tokensSaida: Number(dados?.usage?.completion_tokens) || 0,
    latencia: Date.now() - inicio,
  }
}

export async function registrarTentativa(admin, { usuarioId, modelo, tarefa, ok, categoria = null, latencia = 0, tokensEntrada = 0, tokensSaida = 0 }) {
  const { error } = await admin.rpc('ia_registrar', {
    p_usuario: usuarioId, p_modelo_id: modelo.id, p_tarefa: tarefa, p_ok: ok, p_categoria: categoria,
    p_latencia: latencia, p_tokens_entrada: tokensEntrada, p_tokens_saida: tokensSaida,
  })
  if (error?.code === 'P0001') throw createError({ statusCode: 429, statusMessage: error.message })
  if (error) console.error('[ia] registro', error.code ?? 'erro')
}

// "validar(json)" devolve { ok: true, valor } ou { ok: false, motivo }.
export async function executarCascata(event, { tarefa, permiteTreino = false, usuarioId, mensagens, validar, maxTentativas = 3, maxTokens, tempoMs }) {
  exigirChaveSecreta('a IA do PGC')
  const admin = await serverSupabaseServiceRole(event)
  const { data: modelos, error } = await admin.rpc('ia_modelos_para', { p_tarefa: tarefa, p_permite_treino: permiteTreino })
  if (error) {
    console.error('[ia] catálogo', error.code ?? 'erro')
    throw new FalhaCascata([{ categoria: 'http', provedor: 'catálogo' }])
  }
  const candidatos = (modelos ?? []).filter((m) => temChave(m) && dentroDaCota(m.provedor, Number(m.tokens_entrada_hoje), Number(m.tokens_saida_hoje)))
  const tentativas = []
  if (!candidatos.length) {
    const semChave = (modelos ?? []).filter((m) => !temChave(m))
    throw new FalhaCascata(semChave.length && semChave.length === (modelos ?? []).length ? [{ categoria: 'sem_chave' }] : [{ categoria: 'cota' }])
  }
  for (const modelo of candidatos.slice(0, maxTentativas)) {
    try {
      const r = await chamarModelo(modelo, mensagens, { maxTokens, tempoMs })
      const json = lerJson(r.texto)
      const v = json ? validar(json) : { ok: false, motivo: 'Resposta sem JSON.' }
      await registrarTentativa(admin, { usuarioId, modelo, tarefa, ok: v.ok, categoria: v.ok ? null : 'saida_invalida', latencia: r.latencia, tokensEntrada: r.tokensEntrada, tokensSaida: r.tokensSaida })
      if (v.ok) return { valor: v.valor, modelo, latencia: r.latencia, tentativas }
      tentativas.push({ provedor: modelo.provedor, modelo: modelo.modelo, categoria: 'saida_invalida', motivo: v.motivo })
    }
    catch (erro) {
      if (!(erro instanceof FalhaIA)) throw erro
      await registrarTentativa(admin, { usuarioId, modelo, tarefa, ok: false, categoria: erro.categoria })
      tentativas.push({ provedor: modelo.provedor, modelo: modelo.modelo, categoria: erro.categoria })
    }
  }
  throw new FalhaCascata(tentativas)
}

const NOMES_PROVEDOR = { groq: 'Groq', cloudflare: 'Cloudflare', gemini: 'Gemini', openrouter: 'OpenRouter' }
const MOTIVOS = { limite: 'passou do limite', tempo_esgotado: 'demorou demais', http: 'deu erro', saida_invalida: 'devolveu uma resposta fora do formato', sem_chave: 'está sem chave' }
export const nomeDoModelo = (m) => `${NOMES_PROVEDOR[m.provedor] ?? m.provedor}, ${m.modelo.replace(/^@cf\//, '').replace(/^openai\//, '')}`

// Explicação curta para a tela quando nenhum modelo resolveu.
export function explicarFalha(tentativas) {
  if (tentativas.length === 1 && tentativas[0].categoria === 'cota') return 'A cota grátis de IA do PGC acabou por hoje. Ela volta ao longo da noite (a da Cloudflare zera às 21h de Brasília).'
  if (tentativas.length === 1 && tentativas[0].categoria === 'sem_chave') return 'Nenhum serviço de IA está configurado no servidor.'
  const partes = tentativas.filter((t) => t.provedor && t.provedor !== 'catálogo').map((t) => `${NOMES_PROVEDOR[t.provedor] ?? t.provedor} ${MOTIVOS[t.categoria] ?? 'falhou'}`)
  return partes.length ? `${partes.join('; ')}.` : 'Os serviços de IA não responderam agora.'
}
