// Extras de um texto da Biblioteca, sem IA:
// - glossário: as definições achadas no texto (termo e definição), em ordem alfabética, sem as recusadas;
// - linha do tempo: frases com data ("Em 1822, ...", "7 de setembro de 1822", "15/11/1889"), da mais antiga para a
//   mais nova, com a data separada;
// - textos parecidos: compara os termos mais frequentes de dois textos (semelhança do cosseno) e diz quais pesam
//   mais nos dois. Serve para avisar de texto repetido e para ligar textos do mesmo tema.
import { frases } from './gerarLocal.js'

const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro']
const RE_DATA_COMPLETA = new RegExp(`\\b(\\d{1,2})(?:º)?\\s+de\\s+(${MESES.join('|')})\\s+de\\s+(1[0-9]{3}|20[0-9]{2})\\b`, 'i')
const RE_DATA_BARRAS = /\b(\d{1,2})\/(\d{1,2})\/(1[0-9]{3}|20[0-9]{2})\b/
const RE_ANO_COM_CONTEXTO = /\b(?:em|no ano de|desde|até|entre|no início de|no fim de|a partir de|de)\s+(1[0-9]{3}|20[0-9]{2})\b(?!\s*(?:km|m|kg|g|reais|pessoas|habitantes|metros|%))/i
const RE_ANO_NO_COMECO = /^(1[0-9]{3}|20[0-9]{2})\s*[:,–-]\s+/

export function glossario(conceitos = []) {
  const vistos = new Set()
  const lista = []
  for (const c of conceitos) {
    if (c.tipo !== 'definicao' || c.status === 'recusado' || !c.termo || !c.definicao) continue
    const chave = c.termo.trim().toLowerCase()
    if (vistos.has(chave)) continue
    vistos.add(chave)
    lista.push({ termo: c.termo.trim(), definicao: c.definicao.trim(), pagina: c.pagina ?? null })
  }
  return lista.sort((a, b) => a.termo.localeCompare(b.termo, 'pt-BR', { sensitivity: 'base' }))
}

// Data de uma frase: { ano, mes, dia, rotulo } ou null.
export function dataDaFrase(frase) {
  const f = String(frase)
  let m = f.match(RE_DATA_COMPLETA)
  if (m) return { ano: Number(m[3]), mes: MESES.indexOf(m[2].toLowerCase()) + 1, dia: Number(m[1]), rotulo: `${Number(m[1])} de ${m[2].toLowerCase()} de ${m[3]}` }
  m = f.match(RE_DATA_BARRAS)
  if (m && Number(m[2]) >= 1 && Number(m[2]) <= 12) return { ano: Number(m[3]), mes: Number(m[2]), dia: Number(m[1]), rotulo: `${m[1].padStart(2, '0')}/${m[2].padStart(2, '0')}/${m[3]}` }
  m = f.match(RE_ANO_NO_COMECO) ?? f.match(RE_ANO_COM_CONTEXTO)
  if (m) return { ano: Number(m[1]), mes: 0, dia: 0, rotulo: m[1] }
  return null
}

export function linhaDoTempo(trechos = [], maximo = 40) {
  const vistos = new Set()
  const lista = []
  for (const t of trechos) {
    if (t.tipo !== 'texto' && t.tipo !== 'lista') continue
    if (t.usar_em_questoes === false) continue
    for (const f of frases(t.texto)) {
      if (f.length < 25 || f.length > 280) continue
      const d = dataDaFrase(f)
      if (!d) continue
      const chave = f.toLowerCase()
      if (vistos.has(chave)) continue
      vistos.add(chave)
      lista.push({ ...d, fato: f, pagina: t.pagina ?? null })
    }
  }
  return lista
    .sort((a, b) => a.ano - b.ano || a.mes - b.mes || a.dia - b.dia)
    .slice(0, maximo)
}

// frequencias: [[termo, n], ...] (como a análise do texto guarda). Usa log para um termo muito repetido não dominar.
export function semelhanca(freqA = [], freqB = []) {
  const peso = (n) => 1 + Math.log(n)
  const a = new Map(freqA.map(([t, n]) => [t, peso(n)]))
  const b = new Map(freqB.map(([t, n]) => [t, peso(n)]))
  let produto = 0
  const comuns = []
  for (const [t, va] of a) {
    const vb = b.get(t)
    if (vb) {
      produto += va * vb
      comuns.push([t, va * vb])
    }
  }
  const norma = (m) => Math.sqrt([...m.values()].reduce((s, v) => s + v * v, 0))
  const divisor = norma(a) * norma(b)
  const valor = divisor ? produto / divisor : 0
  return {
    valor: Math.round(valor * 100) / 100,
    comuns: comuns.sort((x, y) => y[1] - x[1]).map(([t]) => t).filter((t, i, l) => !l.some((o, j) => j < i && o.includes(t))).slice(0, 5),
  }
}

// Os textos mais parecidos com o atual (até "maximo"), a partir de 35% de semelhança.
// outros: [{ id, titulo, materiaId, frequencias }]. "quase igual" a partir de 80%.
export function textosParecidos(frequencias, outros = [], { minimo = 0.35, maximo = 3 } = {}) {
  if (!frequencias?.length) return []
  return outros
    .map((o) => ({ ...o, ...semelhanca(frequencias, o.frequencias ?? []) }))
    .filter((o) => o.valor >= minimo)
    .sort((x, y) => y.valor - x.valor)
    .slice(0, maximo)
    .map(({ frequencias: _f, valor, ...resto }) => ({ ...resto, porcentagem: Math.round(valor * 100), quaseIgual: valor >= 0.8 }))
}
