// Prova do Enem pela API enem.dev (só no servidor). A API aceita 1 pedido por segundo, então a prova inteira
// (cerca de 185 questões, em partes de 50) é pedida com intervalo e guardada na memória por 6 horas.
import { API_ENEM } from '#shared/regras/enem.js'

const AGENTE = 'PGC-estudo/0.1 (https://github.com/rennanbottle/PGC)'
const guardadas = new Map()
const SEIS_HORAS = 6 * 60 * 60 * 1000
const espera = (ms) => new Promise((r) => setTimeout(r, ms))

async function pedir(url) {
  for (let tentativa = 0; tentativa < 2; tentativa++) {
    let r
    try {
      r = await fetch(url, { headers: { 'User-Agent': AGENTE, Accept: 'application/json' }, signal: AbortSignal.timeout(15000) })
    }
    catch {
      throw createError({ statusCode: 502, statusMessage: 'A API do Enem não respondeu agora. Tente de novo.' })
    }
    if (r.status === 429 && tentativa === 0) {
      await espera(Math.min(5000, Number(r.headers.get('retry-after')) || 1500))
      continue
    }
    if (r.status === 404) throw createError({ statusCode: 404, statusMessage: 'Essa prova não está na API do Enem.' })
    if (!r.ok) throw createError({ statusCode: 502, statusMessage: 'A API do Enem não respondeu agora. Tente de novo.' })
    return r.json()
  }
  throw createError({ statusCode: 429, statusMessage: 'A API do Enem pediu para esperar. Tente de novo em alguns segundos.' })
}

export async function provaDoEnem(ano) {
  const g = guardadas.get(ano)
  if (g && Date.now() - g.em < SEIS_HORAS) return g.questoes
  const questoes = []
  for (let offset = 0, i = 0; offset < 400 && i < 8; offset += 50, i++) {
    if (i) await espera(1100)
    const dados = await pedir(`${API_ENEM}/exams/${ano}/questions?limit=50&offset=${offset}`)
    questoes.push(...(Array.isArray(dados?.questions) ? dados.questions : []))
    if (!dados?.metadata?.hasMore) break
  }
  if (!questoes.length) throw createError({ statusCode: 404, statusMessage: 'Essa prova veio vazia da API do Enem.' })
  guardadas.set(ano, { em: Date.now(), questoes })
  return questoes
}

// Baixa a figura da questão (só do enem.dev, até 2 MB, PNG/JPG/WebP) para guardar no bucket da pessoa.
export async function figuraDoEnem(url) {
  try {
    const r = await fetch(url, { headers: { 'User-Agent': AGENTE }, signal: AbortSignal.timeout(15000) })
    const tipo = (r.headers.get('content-type') ?? '').split(';')[0].trim()
    if (!r.ok || !['image/png', 'image/jpeg', 'image/webp'].includes(tipo)) return null
    const dados = await r.arrayBuffer()
    if (dados.byteLength > 2 * 1024 * 1024) return null
    return { dados, tipo }
  }
  catch {
    return null
  }
}
