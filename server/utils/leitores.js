// Leitores de arquivo (só no servidor). Devolvem páginas no formato que shared/regras/analise.js espera:
// [{ numero, linhas: [{ texto, titulo?, lista? }] }]. Linha vazia separa parágrafos.
import { extractTextItems, getDocumentProxy } from 'unpdf'
import mammoth from 'mammoth'
import { limparTextoColado } from '#shared/regras/textoColado.js'

export class FalhaMaterial extends Error {
  constructor(codigo) {
    super(codigo)
    this.codigo = codigo
  }
}

const PALAVRAS_POR_PARTE = 450

// PDF: junta os pedaços de texto em linhas, marca título pela fonte maior e parágrafo pelo espaço vertical.
export async function lerPdf(bytes) {
  let pdf
  try {
    pdf = await getDocumentProxy(bytes)
  }
  catch (erro) {
    throw new FalhaMaterial(erro?.name === 'PasswordException' ? 'pdf_protegido' : 'pdf_invalido')
  }
  if (pdf.numPages > 300) throw new FalhaMaterial('paginas_demais')
  const { items } = await extractTextItems(pdf)
  return items.map((itens, i) => ({ numero: i + 1, linhas: linhasDoPdf(itens) }))
}

function linhasDoPdf(itens) {
  const linhas = []
  let atual = { texto: '', tamanho: 0, y: null }
  const fechar = () => {
    if (atual.texto.trim()) linhas.push(atual)
    atual = { texto: '', tamanho: 0, y: null }
  }
  for (const item of itens) {
    if (item.str) {
      atual.texto += item.str
      atual.tamanho = Math.max(atual.tamanho, item.fontSize || 0)
      if (atual.y === null) atual.y = item.y
    }
    if (item.hasEOL) fechar()
  }
  fechar()

  // Tamanho de fonte mais comum, pesado pelo número de letras: é o corpo do texto.
  const pesos = new Map()
  for (const l of linhas) {
    const t = Math.round(l.tamanho * 2) / 2
    pesos.set(t, (pesos.get(t) ?? 0) + l.texto.length)
  }
  const corpo = [...pesos].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 0

  const resultado = []
  let anterior = null
  for (const l of linhas) {
    // Espaço vertical maior que o normal entre linhas vira quebra de parágrafo.
    if (anterior && anterior.y !== null && l.y !== null && anterior.y - l.y > Math.max(l.tamanho, corpo) * 1.9) resultado.push({ texto: '' })
    const maior = corpo > 0 && l.tamanho >= corpo * 1.18 && l.texto.trim().length <= 90
    resultado.push(maior ? { texto: l.texto, titulo: true } : { texto: l.texto })
    anterior = l
  }
  return resultado
}

const ENTIDADES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' }
const decodificar = (t) => t
  .replace(/<br\s*\/?>/gi, ' ')
  .replace(/<[^>]+>/g, '')
  .replace(/&(#\d+|#x[0-9a-f]+|\w+);/gi, (m, e) => {
    if (e[0] === '#') return String.fromCodePoint(e[1].toLowerCase() === 'x' ? Number.parseInt(e.slice(2), 16) : Number(e.slice(1)))
    return ENTIDADES[e.toLowerCase()] ?? m
  })
  .replace(/\s+/g, ' ')
  .trim()

// DOCX: os estilos do Word dizem o que é título e o que é lista. Não há páginas: o texto vira partes de ~450 palavras.
export async function lerDocx(bytes) {
  let html
  try {
    html = (await mammoth.convertToHtml({ buffer: Buffer.from(bytes) })).value
  }
  catch {
    throw new FalhaMaterial('docx_invalido')
  }
  const linhas = []
  for (const [, tag, conteudo] of html.matchAll(/<(h[1-6]|p|li|td|th)\b[^>]*>([\s\S]*?)<\/\1>/gi)) {
    const texto = decodificar(conteudo)
    if (!texto) continue
    const t = tag.toLowerCase()
    if (t === 'li') linhas.push({ texto: `- ${texto}`, lista: true })
    else {
      linhas.push(t[0] === 'h' ? { texto, titulo: true } : { texto })
      linhas.push({ texto: '' })
    }
  }
  return emPartes(linhas)
}

// TXT: tenta UTF-8; se vier cheio de caractere inválido, lê como Windows-1252 (arquivos antigos do Bloco de Notas).
export function lerTxt(bytes) {
  let texto = new TextDecoder('utf-8').decode(bytes)
  if ((texto.match(/�/g) ?? []).length > 5) texto = new TextDecoder('windows-1252').decode(bytes)
  // Texto copiado de páginas com fórmulas chega partido em linhas soltas: junta antes de dividir em partes.
  return emPartes(limparTextoColado(texto).split('\n').map((t) => ({ texto: t })))
}

// Divide as linhas em partes de ~450 palavras, sempre num fim de parágrafo.
function emPartes(linhas) {
  const paginas = []
  let atual = []
  let palavras = 0
  for (const l of linhas) {
    atual.push(l)
    palavras += (l.texto.match(/\S+/g) ?? []).length
    if (palavras >= PALAVRAS_POR_PARTE && !l.texto.trim()) {
      paginas.push(atual)
      atual = []
      palavras = 0
    }
  }
  if (atual.some((l) => l.texto.trim())) paginas.push(atual)
  if (paginas.length > 300) throw new FalhaMaterial('paginas_demais')
  return paginas.map((linhasDaParte, i) => ({ numero: i + 1, linhas: linhasDaParte }))
}

// Confere se há texto de verdade. PDF com pouquíssimas letras por página é escaneado (só imagem).
export function conferirTexto(paginas, formato) {
  const total = paginas.reduce((s, p) => s + p.linhas.reduce((t, l) => t + l.texto.trim().length, 0), 0)
  if (total > 400000) throw new FalhaMaterial('texto_grande')
  if (formato === 'pdf' && paginas.length > 0 && total / paginas.length < 40) throw new FalhaMaterial('pdf_escaneado')
  if (total < 20) throw new FalhaMaterial('texto_vazio')
}

// XLSX: é um ZIP com XML dentro. Lê só a primeira planilha, como linhas de texto (a primeira é o cabeçalho).
// Sem biblioteca de planilha: textos compartilhados (sharedStrings), texto na célula e números.
const XML_ENTIDADES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" }
const textoXml = (t) => String(t).replace(/&(#\d+|#x[0-9a-f]+|\w+);/gi, (m, e) => {
  if (e[0] === '#') return String.fromCodePoint(e[1].toLowerCase() === 'x' ? Number.parseInt(e.slice(2), 16) : Number(e.slice(1)))
  return XML_ENTIDADES[e.toLowerCase()] ?? m
})
const juntarT = (xml) => [...String(xml).matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/g)].map((m) => textoXml(m[1])).join('')
function colunaDaCelula(ref) {
  const letras = String(ref).match(/^[A-Z]+/)?.[0] ?? 'A'
  return [...letras].reduce((n, c) => n * 26 + (c.charCodeAt(0) - 64), 0) - 1
}

export async function lerXlsx(bytes) {
  let zip
  try {
    const { default: JSZip } = await import('jszip')
    zip = await JSZip.loadAsync(bytes)
  }
  catch {
    throw new FalhaMaterial('xlsx_invalido')
  }
  const compartilhado = await zip.file('xl/sharedStrings.xml')?.async('string')
  const textos = compartilhado ? [...compartilhado.matchAll(/<si>([\s\S]*?)<\/si>/g)].map((m) => juntarT(m[1])) : []
  const nomePlanilha = Object.keys(zip.files).filter((n) => /^xl\/worksheets\/sheet\d+\.xml$/.test(n)).sort((a, b) => Number(a.match(/\d+/)[0]) - Number(b.match(/\d+/)[0]))[0]
  if (!nomePlanilha) throw new FalhaMaterial('xlsx_invalido')
  const xml = await zip.file(nomePlanilha).async('string')
  const linhas = []
  for (const [, conteudoLinha] of xml.matchAll(/<row\b[^>]*>([\s\S]*?)<\/row>/g)) {
    const linha = []
    for (const m of conteudoLinha.matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const atributos = m[1]
      const corpo = m[2] ?? ''
      const ref = atributos.match(/\br="([A-Z]+\d+)"/)?.[1]
      const tipo = atributos.match(/\bt="(\w+)"/)?.[1]
      const v = corpo.match(/<v>([\s\S]*?)<\/v>/)?.[1]
      let valor = ''
      if (tipo === 's') valor = textos[Number(v)] ?? ''
      else if (tipo === 'inlineStr') valor = juntarT(corpo)
      else if (v !== undefined) valor = textoXml(v)
      linha[ref ? colunaDaCelula(ref) : linha.length] = valor
    }
    linhas.push(Array.from(linha, (x) => x ?? ''))
    if (linhas.length > 2001) break
  }
  return linhas
}
