// POST /api/ia/testar
// Teste manual de um modelo (ou de todos os ativos), só para donos, até 10 por hora.
// Pede um JSON mínimo e registra o resultado como tarefa "teste" (conta para a pausa, como qualquer tentativa).
import { serverSupabaseClient, serverSupabaseServiceRole, serverSupabaseUser } from '#supabase/server'
import { lerJson } from '#shared/regras/ia.js'
import { FalhaIA, chamarModelo, registrarTentativa } from '../../utils/ia.js'
import { UUID } from '../../utils/consultas.js'

const PEDIDO = [
  { role: 'system', content: 'Responda só com JSON.' },
  { role: 'user', content: 'Devolva {"ok":true,"soma":7} se 3 + 4 = 7.' },
]

export default defineEventHandler(async (event) => {
  const usuario = await serverSupabaseUser(event).catch(() => null)
  if (!usuario?.sub) throw createError({ statusCode: 401, statusMessage: 'Entre de novo para continuar.' })
  const supabase = await serverSupabaseClient(event)
  const { data: diag, error } = await supabase.rpc('ia_diagnostico')
  if (error) throw createError({ statusCode: 404, statusMessage: 'Página não encontrada.' })
  const corpo = (await readBody(event).catch(() => null)) ?? {}
  exigirChaveSecreta('o teste da IA')
  const admin = await serverSupabaseServiceRole(event)
  let consulta = admin.from('ia_modelos').select('id, provedor, modelo, variavel_chave, capacidades, ativo').order('prioridade')
  consulta = UUID.test(corpo.modeloId ?? '') ? consulta.eq('id', corpo.modeloId) : consulta.eq('ativo', true)
  const { data: modelos } = await consulta
  const vagas = Math.max(0, 10 - Number(diag.testes_ultima_hora ?? 0))
  if (!vagas) throw createError({ statusCode: 429, statusMessage: 'Limite de 10 testes por hora. Tente mais tarde.' })
  const resultados = []
  for (const m of (modelos ?? []).slice(0, vagas)) {
    try {
      const r = await chamarModelo(m, PEDIDO, { maxTokens: 300, tempoMs: 20000 })
      const ok = lerJson(r.texto)?.soma === 7
      await registrarTentativa(admin, { usuarioId: usuario.sub, modelo: m, tarefa: 'teste', ok, categoria: ok ? null : 'saida_invalida', latencia: r.latencia, tokensEntrada: r.tokensEntrada, tokensSaida: r.tokensSaida })
      resultados.push({ id: m.id, ok, latencia: r.latencia, categoria: ok ? null : 'saida_invalida' })
    }
    catch (erro) {
      if (!(erro instanceof FalhaIA)) throw erro
      await registrarTentativa(admin, { usuarioId: usuario.sub, modelo: m, tarefa: 'teste', ok: false, categoria: erro.categoria })
      resultados.push({ id: m.id, ok: false, categoria: erro.categoria })
    }
  }
  return { resultados }
})
