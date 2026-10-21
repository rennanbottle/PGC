// Geração de questões sem IA, só com o texto conferido do material (documento "Motor de estudo", seção 4).
// Entrada: trechos aprovados para questões e conceitos aprovados na conferência.
// Saída: questões prontas para gravar, separadas por técnica, com o motivo quando uma técnica não rende nada.
// Toda questão daqui nasce em Fácil ou Normal, em Lembrar ou Entender, e passa pela conferência de qualidade.
// A "chave" impede gerar a mesma questão duas vezes (o banco recusa chave repetida).
import { conferirQuestao } from './questoes.js'
import { calcular, formatarNumero, lerFormula } from './expressoes.js'

export const TECNICAS = [
  { id: 'lacuna', nome: 'Lacuna de definição', descricao: 'Das definições aprovadas.' },
  { id: 'cartao', nome: 'Cartão', descricao: 'Termo na frente, definição no verso.' },
  { id: 'numerica', nome: 'Numérica com variação', descricao: 'Valores novos nas fórmulas aprovadas, 3 por fórmula.' },
  { id: 'associar', nome: 'Associar termo e definição', descricao: 'Grupos de até 4 termos do mesmo assunto.' },
  { id: 'ordenar', nome: 'Ordenar', descricao: 'Das listas numeradas.' },
  { id: 'classificar', nome: 'Classificar em grupos', descricao: 'Listas que aparecem sob títulos diferentes.' },
  { id: 'cronologia', nome: 'Cronologia', descricao: 'Acontecimentos com ano, em ordem.' },
]

const RE_VERBO = /^(é|são|consiste em|corresponde a|define-se como|refere-se a|significa)\s+/i
const RE_NUMERO_LISTA = /^\s*(?:\d{1,2}[.)º°]|[a-z]\))\s+/
const RE_MARCA_LISTA = /^\s*(?:[-•*–▪◦]|\d{1,2}[.)º°]|[a-z]\))\s+/
const RE_ANO = /\b(1[0-9]{3}|20[0-9]{2})\b/g

const limpar = (t) => String(t ?? '').replace(/\s+/g, ' ').trim()
const semAcento = (t) => String(t).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
const maiuscula = (t) => (t ? t[0].toUpperCase() + t.slice(1) : t)
const tirarNumeracao = (t) => limpar(String(t).replace(/^\s*\d+(?:\.\d+)*\.?\s+/, ''))

export function frases(texto) {
  return limpar(texto).match(/[^.!?]+(?:[.!?]+|$)/g)?.map((f) => f.trim()).filter(Boolean) ?? []
}

function hash(texto) {
  let h = 5381
  for (const c of String(texto)) h = ((h << 5) + h + c.charCodeAt(0)) >>> 0
  return h.toString(36)
}

// Sorteio com semente: a mesma fórmula sempre gera os mesmos valores (e a mesma chave).
export function sorteador(semente) {
  let a = Number.parseInt(hash(semente), 36) || 1
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// Frase do trecho com o termo trocado por lacuna. Null se o termo some ou aparece de novo na frase (daria a resposta).
export function lacunaDoTermo(textoTrecho, termo) {
  const alvo = semAcento(termo)
  for (const f of frases(textoTrecho)) {
    const base = semAcento(f)
    const i = base.indexOf(alvo)
    if (i < 0 || f.length > 320) continue
    if (base.indexOf(alvo, i + alvo.length) >= 0) return null
    const antes = i === 0 || !/[\p{L}\p{N}]/u.test(f[i - 1])
    const depois = i + alvo.length >= f.length || !/[\p{L}\p{N}]/u.test(f[i + alvo.length])
    if (!antes || !depois) continue
    return `${f.slice(0, i)}______${f.slice(i + alvo.length)}`
  }
  return null
}

const definicaoLimpa = (d) => maiuscula(limpar(String(d ?? '').replace(RE_VERBO, '')).replace(/[.;]+$/, ''))

function gerarLacunas(conceitos, trechoPorId) {
  const lista = []
  for (const c of conceitos) {
    if (c.tipo !== 'definicao' || !c.definicao) continue
    if (limpar(c.termo).split(' ').length > 5) continue
    const trecho = trechoPorId.get(c.trecho_id)
    let enunciado = trecho ? lacunaDoTermo(trecho.texto, c.termo) : null
    if (!enunciado) {
      const d = limpar(c.definicao)
      if (semAcento(d).includes(semAcento(c.termo))) continue
      enunciado = RE_VERBO.test(d) ? `______ ${d}` : `${maiuscula(d.replace(/[.;]+$/, ''))}. Esse é o conceito de ______.`
    }
    lista.push({
      tecnica: 'lacuna',
      chave: `lacuna:${c.id}`,
      tipo: 'lacuna_digitada',
      enunciado,
      conteudo: { lacunas: [{ respostas: [limpar(c.termo)] }] },
      explicacao: `No material${c.pagina ? `, página ${c.pagina}` : ''}: ${limpar(c.termo)} ${RE_VERBO.test(c.definicao) ? limpar(c.definicao) : `é ${limpar(c.definicao)}`}`.slice(0, 3000),
      nivel: 1,
      bloom: 1,
      conceito_id: c.id,
      trecho_id: c.trecho_id ?? null,
      assunto_id: c.assunto_id ?? trecho?.assunto_id ?? null,
    })
  }
  return lista
}

function gerarCartoes(conceitos, trechoPorId) {
  return conceitos.filter((c) => c.tipo === 'definicao' && c.definicao).map((c) => {
    const termo = limpar(c.termo)
    const plural = /^são\s/i.test(limpar(c.definicao))
    const nome = /\p{Lu}.*\p{Lu}/u.test(termo) ? termo : termo[0].toLowerCase() + termo.slice(1)
    return {
      tecnica: 'cartao',
      chave: `cartao:${c.id}`,
      tipo: 'cartao',
      enunciado: `O que ${plural ? 'são' : 'é'} ${nome}?`,
      conteudo: { verso: definicaoLimpa(c.definicao) },
      explicacao: null,
      nivel: 1,
      bloom: 1,
      conceito_id: c.id,
      trecho_id: c.trecho_id ?? null,
      assunto_id: c.assunto_id ?? trechoPorId.get(c.trecho_id)?.assunto_id ?? null,
    }
  })
}

function gerarAssociar(conceitos, trechoPorId) {
  const uteis = conceitos.filter((c) => c.tipo === 'definicao' && c.definicao && definicaoLimpa(c.definicao).length <= 180 && limpar(c.termo).length <= 60)
  const porAssunto = new Map()
  for (const c of uteis) {
    const assunto = c.assunto_id ?? trechoPorId.get(c.trecho_id)?.assunto_id ?? null
    if (!porAssunto.has(assunto)) porAssunto.set(assunto, [])
    porAssunto.get(assunto).push(c)
  }
  const lista = []
  for (const [assunto, grupo] of porAssunto) {
    const vistos = new Set()
    const unicos = grupo.filter((c) => {
      const k = semAcento(c.termo)
      if (vistos.has(k)) return false
      vistos.add(k)
      return true
    })
    for (let i = 0; i + 3 <= unicos.length; i += 4) {
      const parte = unicos.slice(i, i + 4)
      if (parte.length < 3) break
      lista.push({
        tecnica: 'associar',
        chave: `associar:${hash(parte.map((c) => c.id).sort().join(','))}`,
        tipo: 'associar',
        enunciado: 'Ligue cada termo à sua definição.',
        conteudo: { pares: parte.map((c) => ({ a: limpar(c.termo), b: definicaoLimpa(c.definicao) })) },
        explicacao: null,
        nivel: 2,
        bloom: 2,
        conceito_id: null,
        trecho_id: null,
        assunto_id: assunto,
      })
    }
  }
  return lista
}

// Título mais próximo antes de cada trecho, na ordem do material.
function titulosAntes(trechos) {
  const mapa = new Map()
  let atual = null
  for (const t of trechos) {
    if (t.tipo === 'titulo') atual = t
    else mapa.set(t.id, atual)
  }
  return mapa
}

const itensDaLista = (texto, numerada) => String(texto).split('\n').map((l) => l.trim()).filter(Boolean)
  .filter((l) => (numerada ? RE_NUMERO_LISTA.test(l) : RE_MARCA_LISTA.test(l)))
  .map((l) => limpar(l.replace(RE_MARCA_LISTA, '')).replace(/[;.]$/, ''))

function gerarOrdenar(trechos, titulos) {
  const lista = []
  for (const t of trechos) {
    if (t.tipo !== 'lista') continue
    const linhas = String(t.texto).split('\n').filter((l) => l.trim())
    const itens = itensDaLista(t.texto, true)
    if (itens.length < 3 || itens.length > 8 || itens.length !== linhas.length || itens.some((x) => x.length > 180 || x.length < 3)) continue
    const titulo = titulos.get(t.id)
    lista.push({
      tecnica: 'ordenar',
      chave: `ordenar:${t.id}`,
      tipo: 'ordenar',
      enunciado: titulo ? `Coloque na ordem certa: ${tirarNumeracao(titulo.texto)}.` : 'Coloque estes itens na ordem em que aparecem no material.',
      conteudo: { itens },
      explicacao: `Ordem do material${t.pagina ? `, página ${t.pagina}` : ''}.`,
      nivel: 2,
      bloom: 2,
      conceito_id: null,
      trecho_id: t.id,
      assunto_id: t.assunto_id ?? null,
    })
  }
  return lista
}

function gerarClassificar(trechos, titulos) {
  const listas = trechos
    .filter((t) => t.tipo === 'lista' && titulos.get(t.id) && itensDaLista(t.texto, true).length === 0)
    .map((t) => ({ trecho: t, titulo: tirarNumeracao(titulos.get(t.id).texto), itens: itensDaLista(t.texto, false) }))
    .filter((l) => l.itens.length >= 2 && l.itens.length <= 6 && l.itens.every((x) => x.length <= 90) && l.titulo.length <= 60)
  const lista = []
  for (let i = 0; i + 1 < listas.length; i++) {
    const a = listas[i]
    const b = listas[i + 1]
    if (semAcento(a.titulo) === semAcento(b.titulo) || Math.abs(a.trecho.pagina - b.trecho.pagina) > 3) continue
    const todos = [...a.itens, ...b.itens].map(semAcento)
    if (new Set(todos).size !== todos.length) continue
    lista.push({
      tecnica: 'classificar',
      chave: `classificar:${a.trecho.id}:${b.trecho.id}`,
      tipo: 'classificar',
      enunciado: 'Separe cada item no grupo certo.',
      conteudo: { grupos: [{ nome: a.titulo, itens: a.itens }, { nome: b.titulo, itens: b.itens }] },
      explicacao: null,
      nivel: 2,
      bloom: 2,
      conceito_id: null,
      trecho_id: a.trecho.id,
      assunto_id: a.trecho.assunto_id ?? b.trecho.assunto_id ?? null,
    })
    i++
  }
  return lista
}

// Valores "redondos": g fica 10; o resto de 2 a 20, sem dar divisão por zero nem resultado gigante.
function gerarNumericas(conceitos, trechoPorId) {
  const lista = []
  for (const c of conceitos) {
    if (c.tipo !== 'formula') continue
    const f = lerFormula(c.termo)
    if (!f) continue
    const sorte = sorteador(c.id)
    const usados = new Set()
    for (let k = 0, tentativas = 0; k < 3 && tentativas < 30; tentativas++) {
      const valores = Object.fromEntries(f.variaveis.map((v) => [v, v === 'g' ? 10 : 2 + Math.floor(sorte() * 19)]))
      const chaveValores = JSON.stringify(valores)
      if (usados.has(chaveValores)) continue
      let resultado
      try {
        resultado = calcular(f.arvore, valores)
      }
      catch {
        break
      }
      if (!Number.isFinite(resultado) || Math.abs(resultado) > 1e6 || Math.abs(resultado) < 0.01) continue
      usados.add(chaveValores)
      const resposta = Math.round(resultado * 100) / 100
      const dados = f.variaveis.map((v) => `${v} = ${formatarNumero(valores[v])}`)
      const textoDados = dados.length > 1 ? `${dados.slice(0, -1).join(', ')} e ${dados.at(-1)}` : dados[0]
      lista.push({
        tecnica: 'numerica',
        chave: `numerica:${c.id}:${k}`,
        tipo: 'numerica',
        enunciado: `Use a fórmula ${f.nome} = ${f.expressao}. Com ${textoDados}, quanto vale ${f.nome}?`,
        conteudo: { resposta, tolerancia: 1, unidade: '' },
        explicacao: `Substituindo os valores na fórmula, ${f.nome} = ${formatarNumero(resposta)}.`,
        nivel: 2,
        bloom: 2,
        conceito_id: c.id,
        trecho_id: c.trecho_id ?? null,
        assunto_id: c.assunto_id ?? trechoPorId.get(c.trecho_id)?.assunto_id ?? null,
      })
      k++
    }
  }
  return lista
}

// Frases com um ano só ("Em 1930, ...") viram acontecimentos; o ano sai do texto e vira a resposta.
export function acontecimentos(trechos) {
  const lista = []
  for (const t of trechos) {
    if (t.tipo !== 'texto') continue
    for (const f of frases(t.texto)) {
      const anos = f.match(RE_ANO) ?? []
      if (anos.length !== 1 || f.length < 30 || f.length > 220) continue
      const ano = Number(anos[0])
      const noComeco = new RegExp(`^(?:em|no ano de|no início de|no fim de)\\s+${anos[0]}\\b,?\\s*`, 'i')
      const noMeio = new RegExp(`\\s*\\b(?:em|no ano de|de|no início de|no fim de)\\s+${anos[0]}\\b`, 'i')
      const sem = limpar(noComeco.test(f) ? f.replace(noComeco, '') : f.replace(noMeio, ''))
      if (sem === limpar(f) || /\d{4}/.test(sem) || sem.length < 20) continue
      lista.push({ ano, texto: maiuscula(sem), trecho: t })
    }
  }
  return lista
}

function gerarCronologia(trechos) {
  const eventos = []
  const anos = new Set()
  for (const e of acontecimentos(trechos)) {
    if (anos.has(e.ano)) continue
    anos.add(e.ano)
    eventos.push(e)
  }
  const lista = []
  for (let i = 0; i + 3 <= eventos.length; i += 4) {
    const parte = eventos.slice(i, i + 4)
    if (parte.length < 3) break
    const ordem = [...parte].sort((a, b) => a.ano - b.ano)
    lista.push({
      tecnica: 'cronologia',
      chave: `cronologia:${hash(ordem.map((e) => e.texto).join('|'))}`,
      tipo: 'ordenar',
      enunciado: 'Coloque os acontecimentos em ordem, do mais antigo para o mais recente.',
      conteudo: { itens: ordem.map((e) => e.texto) },
      explicacao: ordem.map((e) => `${e.ano}: ${e.texto.replace(/[.!?]$/, '')}.`).join(' '),
      nivel: 2,
      bloom: 1,
      conceito_id: null,
      trecho_id: parte[0].trecho.id,
      assunto_id: parte[0].trecho.assunto_id ?? null,
    })
  }
  return lista
}

const MOTIVOS_VAZIOS = {
  lacuna: 'Nenhuma definição aprovada.',
  cartao: 'Nenhuma definição aprovada.',
  numerica: 'Nenhuma fórmula aprovada que dê para calcular.',
  associar: 'Precisa de 3 definições aprovadas do mesmo assunto.',
  ordenar: 'Não há lista numerada de 3 a 8 itens.',
  classificar: 'Não há listas sob títulos diferentes.',
  cronologia: 'Não há 3 datas com ano no texto.',
}

// Junta tudo. "existentes": chaves já geradas antes (não entram de novo).
export function gerarDoMaterial({ trechos = [], conceitos = [], existentes = new Set() }) {
  const usaveis = [...trechos].filter((t) => t.usar_em_questoes !== false).sort((a, b) => a.ordem - b.ordem)
  const aprovados = conceitos.filter((c) => c.status === 'aprovado')
  const trechoPorId = new Map(usaveis.map((t) => [t.id, t]))
  const titulos = titulosAntes(usaveis)
  const brutas = {
    lacuna: gerarLacunas(aprovados, trechoPorId),
    cartao: gerarCartoes(aprovados, trechoPorId),
    numerica: gerarNumericas(aprovados, trechoPorId),
    associar: gerarAssociar(aprovados, trechoPorId),
    ordenar: gerarOrdenar(usaveis, titulos),
    classificar: gerarClassificar(usaveis, titulos),
    cronologia: gerarCronologia(usaveis),
  }
  const resultado = {}
  for (const t of TECNICAS) {
    const todas = brutas[t.id]
    const novas = todas.filter((q) => !existentes.has(q.chave))
    const aprovadas = novas.filter((q) => conferirQuestao(q).aprovada)
    let motivo = ''
    if (!todas.length) motivo = MOTIVOS_VAZIOS[t.id]
    else if (!novas.length) motivo = 'Todas já foram geradas antes.'
    else if (!aprovadas.length) motivo = 'Nenhuma passou na conferência de qualidade.'
    resultado[t.id] = { ...t, questoes: aprovadas, repetidas: todas.length - novas.length, descartadas: novas.length - aprovadas.length, motivo }
  }
  return resultado
}
