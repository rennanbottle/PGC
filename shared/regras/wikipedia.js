// Material a partir da Wikipédia, do Wikilivros e da Wikiversidade em português (licença CC BY-SA 4.0: pode
// reutilizar citando a fonte). Os três usam a mesma API do MediaWiki; só muda o endereço.
// O texto vem da API pública já sem marcação; aqui só arrumamos títulos de seção e cortamos o fim
// (referências, ligações externas), que não serve para estudar.

export const LICENCA_WIKIPEDIA = 'CC BY-SA 4.0'
export const AGENTE = 'PGC-estudo/0.1 (https://github.com/rennanbottle/PGC)'
const FIM = /^(ver também|referências|notas|notas e referências|bibliografia|ligações externas|leitura adicional|fontes)$/i

// "== Cinemática ==" vira uma linha de título, separada por linhas em branco (o leitor de TXT entende como título).
export function limparExtrato(texto) {
  const linhas = String(texto ?? '').replace(/\r\n?/g, '\n').split('\n')
  const saida = []
  for (const l of linhas) {
    const m = l.match(/^\s*(={2,6})\s*(.*?)\s*\1\s*$/)
    if (m) {
      if (FIM.test(m[2])) break
      saida.push('', m[2], '')
      continue
    }
    saida.push(l.trim())
  }
  return saida.join('\n').replace(/\n{3,}/g, '\n\n').trim()
}

// Trecho da busca vem com marcação de destaque em HTML; vira texto simples.
export function limparTrecho(html) {
  return String(html ?? '').replace(/<[^>]+>/g, '').replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&#039;/g, "'").replace(/\s+/g, ' ').trim()
}

export const FONTES_WIKI = {
  wikipedia: { nome: 'Wikipédia', host: 'pt.wikipedia.org', descricao: 'Enciclopédia: bom para entender o tema e os conceitos.' },
  wikilivros: { nome: 'Wikilivros', host: 'pt.wikibooks.org', descricao: 'Livros didáticos abertos, divididos em capítulos.' },
  wikiversidade: { nome: 'Wikiversidade', host: 'pt.wikiversity.org', descricao: 'Cursos e aulas abertas, com exercícios em algumas páginas.' },
}
const host = (fonte) => (FONTES_WIKI[fonte] ?? FONTES_WIKI.wikipedia).host

export function enderecoBusca(termo, limite = 6, fonte = 'wikipedia') {
  const p = new URLSearchParams({ action: 'query', list: 'search', srsearch: termo, srlimit: String(limite), srprop: 'snippet|wordcount', srnamespace: '0', format: 'json', formatversion: '2' })
  return `https://${host(fonte)}/w/api.php?${p}`
}

export function enderecoArtigo(titulo, fonte = 'wikipedia') {
  const p = new URLSearchParams({ action: 'query', prop: 'extracts|info', explaintext: '1', exsectionformat: 'wiki', inprop: 'url', redirects: '1', titles: titulo, format: 'json', formatversion: '2' })
  return `https://${host(fonte)}/w/api.php?${p}`
}

export const enderecoPagina = (titulo, fonte = 'wikipedia') => `https://${host(fonte)}/wiki/${encodeURIComponent(String(titulo).replace(/ /g, '_'))}`

// ---------- Busca de um tema pensando na matéria ----------
// Wikilivros e Wikiversidade (material didático) vêm antes da Wikipédia. Em matérias técnicas, páginas de
// história ou biografia descem ("Python" trazia só "História do Python"). Título com palavras do assunto sobe.

export const ORDEM_FONTES = ['wikilivros', 'wikiversidade', 'wikipedia']
const PESO_FONTE = { wikilivros: 3, wikiversidade: 2, wikipedia: 0 }
const TECNICAS = new Set(['matematica', 'natureza', 'idiomas', 'programacao', 'exatas', 'saude'])
const HISTORIA = /^(historia|cronologia|biografia)\b|\bhistoria d[aeo]s?\b/
const BIOGRAFIA = /\bnascid[oa] (em|no|na)\b|\(\d{3,4}\s*[-–]\s*\d{3,4}\)|\bfoi uma? (matematic|fisic|quimic|program|escritor|cientista|engenheir|inventor)/
const VAZIAS = new Set(['de', 'da', 'do', 'das', 'dos', 'e', 'em', 'na', 'no', 'nas', 'nos', 'para', 'por', 'com', 'um', 'uma', 'os', 'as', 'a', 'o', 'ao', 'aos', 'que'])

const normalizarBusca = (t) => String(t ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim()
export const palavrasChave = (texto) => normalizarBusca(texto).split(/[^a-z0-9+#]+/).filter((p) => p.length >= 2 && !VAZIAS.has(p))

// Texto mandado para a busca: o tema, mais o nome da matéria quando ajuda (matéria técnica que não está no tema).
export function consultaDoTema({ tema = '', materia = '', assunto = '', area = '' } = {}) {
  const base = String(tema || assunto || '').replace(/\s+/g, ' ').trim()
  if (!base) return ''
  const temNoTema = (t) => palavrasChave(t).every((p) => palavrasChave(base).includes(p))
  const partes = [base]
  if (assunto && tema && !temNoTema(assunto)) partes.push(assunto)
  if (materia && TECNICAS.has(area) && !temNoTema(materia)) partes.push(materia)
  return partes.join(' ').slice(0, 100)
}

export function pontuarResultado(r, { tema = '', materia = '', assunto = '', area = '' } = {}) {
  let p = PESO_FONTE[r.fonte] ?? 0
  const titulo = normalizarBusca(r.titulo)
  const trecho = normalizarBusca(r.trecho)
  for (const w of palavrasChave(assunto)) p += titulo.includes(w) ? 3 : trecho.includes(w) ? 1 : 0
  for (const w of palavrasChave(tema)) p += titulo.includes(w) ? 2 : trecho.includes(w) ? 0.5 : 0
  if (materia && titulo.includes(normalizarBusca(materia))) p += 1
  if (TECNICAS.has(area) && (HISTORIA.test(titulo) || BIOGRAFIA.test(trecho))) p -= 6
  if (/desambigua/.test(titulo)) p -= 8
  if (/^lista d[aeo]s? /.test(titulo)) p -= 3
  const palavras = r.palavras ?? 0
  if (palavras < 150) p -= 4
  else if (palavras >= 400) p += 1
  return p
}

export function ordenarResultados(lista, contexto = {}, limite = 8) {
  const vistos = new Set()
  return (lista ?? [])
    .filter((r) => {
      const chave = `${r.fonte}:${normalizarBusca(r.titulo)}`
      if (vistos.has(chave)) return false
      vistos.add(chave)
      return true
    })
    .map((r, i) => ({ r, p: pontuarResultado(r, contexto), i }))
    .sort((a, b) => b.p - a.p || a.i - b.i)
    .slice(0, limite)
    .map((x) => x.r)
}

// ---------- Seções de uma página (prévia e escolha antes de trazer) ----------
// Seções de nível 2; subseções entram no texto da seção de cima. O fim (referências...) sai.
export function secoesDoExtrato(extrato) {
  const secoes = [{ titulo: 'Introdução', linhas: [] }]
  for (const l of String(extrato ?? '').replace(/\r\n?/g, '\n').split('\n')) {
    const m = l.match(/^\s*(={2,6})\s*(.*?)\s*\1\s*$/)
    if (m && FIM.test(m[2])) break
    if (m && m[1].length === 2) {
      secoes.push({ titulo: m[2], linhas: [] })
      continue
    }
    if (m) {
      secoes.at(-1).linhas.push('', m[2], '')
      continue
    }
    secoes.at(-1).linhas.push(l.trim())
  }
  return secoes
    .map((s) => {
      const texto = s.linhas.join('\n').replace(/\n{3,}/g, '\n\n').trim()
      return { titulo: s.titulo, texto, palavras: texto ? texto.split(/\s+/).length : 0 }
    })
    .filter((s) => s.palavras > 0)
}

// Texto final só com as seções escolhidas (índices da lista de secoesDoExtrato). Sem escolha, vai tudo.
export function montarTexto(extrato, escolhidas = null) {
  const secoes = secoesDoExtrato(extrato)
  const usar = Array.isArray(escolhidas) && escolhidas.length ? secoes.filter((_, i) => escolhidas.includes(i)) : secoes
  return usar.map((s, i) => (i === 0 && s.titulo === 'Introdução' ? s.texto : `${s.titulo}\n\n${s.texto}`)).join('\n\n').trim()
}

export const resumoDoTexto = (texto, max = 240) => {
  const t = String(texto ?? '').replace(/\s+/g, ' ').trim()
  return t.length > max ? `${t.slice(0, max).replace(/\s+\S*$/, '')}...` : t
}

// Fonte de um texto já guardado, pelo endereço (null = não veio de uma fonte aberta).
export function fonteDoEndereco(url) {
  const h = String(url ?? '').match(/^https?:\/\/([^/]+)/)?.[1]
  return Object.keys(FONTES_WIKI).find((f) => FONTES_WIKI[f].host === h) ?? null
}
