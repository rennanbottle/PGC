// Análise de material sem IA. Recebe as páginas já lidas do arquivo e devolve:
// - trechos (título, texto, lista, fórmula, tabela, rodapé) com página e ordem;
// - conceitos encontrados (definições e fórmulas), para a pessoa aprovar na conferência;
// - números do material (palavras, leitura, legibilidade, estrutura, termos, assuntos sugeridos).
//
// Entrada: [{ numero, linhas: [{ texto, titulo?, lista? }] }]. Linha vazia separa parágrafos.
// "titulo" e "lista" vêm do leitor quando o arquivo diz (tamanho da fonte no PDF, estilos no DOCX).
import { formulaValida } from './matematica.js'

const STOPWORDS = new Set(`a à às ao aos as o os um uma uns umas de da das do dos dum duma em na nas no nos num numa
por pela pelas pelo pelos para pra com sem sob sobre entre até após ante desde contra que se e ou mas nem como quando
onde quem qual quais cujo cuja porque pois porém também já ainda mais menos muito muita muitos muitas pouco pouca
tão tanto tanta todo toda todos todas outro outra outros outras mesmo mesma este esta estes estas esse essa esses essas
aquele aquela aqueles aquelas isto isso aquilo ele ela eles elas eu tu nós vós você vocês lhe lhes me te nos vos seu sua
seus suas meu minha meus minhas nosso nossa nossos nossas dele dela deles delas é são era eram foi foram ser estar está
estão estava estavam ter tem têm tinha tinham há houve haver sendo sido sido pode podem deve devem fazer faz fazem feito
assim então sim não só cada qualquer quaisquer alguns algumas algum alguma nenhum nenhuma vez vezes ser seja sejam será
serão seria seriam essa nesse nessa neste nesta nisso naquele naquela daquele daquela desse dessa deste desta disso
dois duas três primeiro primeira segundo segunda exemplo figura tabela página capítulo seção onde etc ex`.split(/\s+/))

const RE_LISTA = /^\s*(?:[-•*–▪◦]|\d{1,2}[.)]|[a-z]\))\s+/
const RE_NUMERACAO_TITULO = /^\s*\d+(?:\.\d+)*\.?\s+\S/
const RE_FORMULA_SIMBOLO = /[=≈≤≥±×÷√∑∫Δ∆²³]/
const RE_FIM_FRASE = /[.!?:;]["”')\]]?$/
const RE_UNIDADE = /\b\d+(?:[.,]\d+)?\s?(?:km\/h|m\/s²|m\/s|km|cm|mm|nm|kg|mg|g|ml|mL|L|h|min|s|J|kJ|N|W|kW|V|A|Ω|°C|K|Pa|atm|mol|Hz|cal|kcal|%)(?![\p{L}\d])/gu
const MESES = 'janeiro|fevereiro|março|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro'
const RE_DATA = new RegExp(`\\b\\d{1,2}\\s+de\\s+(?:${MESES})(?:\\s+de\\s+\\d{3,4})?|\\b\\d{1,2}/\\d{1,2}/\\d{2,4}\\b|\\bem\\s+1[0-9]{3}\\b|\\bem\\s+20[0-9]{2}\\b`, 'gi')

export const LIMITES_MATERIAL = { paginas: 300, caracteres: 400000, trecho: 1500, alvoDivisao: 900 }

const limpar = (t) => String(t ?? '').replace(/­/g, '').replace(/[ \t ]+/g, ' ').trim()
const normalizarLinha = (t) => limpar(t).toLowerCase().replace(/\d+/g, '#')
export const contarPalavras = (texto) => (String(texto).match(/[\p{L}\p{N}]+(?:[-'][\p{L}\p{N}]+)*/gu) ?? []).length

// Linhas que se repetem em boa parte das páginas são cabeçalho ou rodapé ("Página 3 de 24 · Editora X").
export function linhasRepetidas(paginas) {
  if (paginas.length < 3) return new Set()
  const contagem = new Map()
  for (const p of paginas) {
    const vistas = new Set()
    for (const l of p.linhas) {
      const n = normalizarLinha(l.texto)
      if (!n || n.length > 120 || vistas.has(n)) continue
      vistas.add(n)
      contagem.set(n, (contagem.get(n) ?? 0) + 1)
    }
  }
  const minimo = Math.max(3, Math.ceil(paginas.length * 0.6))
  return new Set([...contagem].filter(([, n]) => n >= minimo).map(([l]) => l))
}

export function pareceFormula(texto) {
  const t = limpar(texto)
  if (!t || t.length > 120 || !RE_FORMULA_SIMBOLO.test(t)) return false
  const palavrasLongas = (t.match(/\p{L}{4,}/gu) ?? []).length
  return palavrasLongas <= 3
}

export function pareceTitulo(texto, proxima) {
  const t = limpar(texto)
  if (!t || t.length > 90 || RE_FIM_FRASE.test(t) || (RE_LISTA.test(t) && !RE_NUMERACAO_TITULO.test(t)) || pareceFormula(t)) return false
  const palavras = contarPalavras(t)
  if (palavras === 0 || palavras > 12) return false
  if (proxima === undefined) return false
  const numerado = RE_NUMERACAO_TITULO.test(t)
  const maiusculas = t === t.toUpperCase() && /\p{Lu}/u.test(t)
  const comecaMaiuscula = /^\p{Lu}/u.test(t)
  return numerado || maiusculas || (comecaMaiuscula && palavras <= 8 && !!proxima)
}

// Junta as linhas em blocos: título, parágrafo, lista, fórmula ou rodapé.
function blocosDaPagina(pagina, repetidas) {
  const blocos = []
  let paragrafo = null
  let lista = null
  const fechar = () => {
    if (paragrafo) blocos.push(paragrafo)
    if (lista) blocos.push(lista)
    paragrafo = null
    lista = null
  }
  const linhas = pagina.linhas
  for (let i = 0; i < linhas.length; i++) {
    const original = linhas[i]
    const texto = limpar(original.texto)
    if (!texto) {
      fechar()
      continue
    }
    if (repetidas.has(normalizarLinha(texto))) {
      fechar()
      blocos.push({ tipo: 'rodape', texto })
      continue
    }
    const proxima = linhas.slice(i + 1).find((l) => limpar(l.texto))
    // "1. Cinemática" é título quando é curto, sem ponto final e não vem seguido de outro item numerado.
    const tituloNumerado = !lista && RE_NUMERACAO_TITULO.test(texto) && pareceTitulo(texto, proxima?.texto) && !(proxima && RE_LISTA.test(limpar(proxima.texto)))
    if (!tituloNumerado && (original.lista || RE_LISTA.test(texto))) {
      if (paragrafo) {
        blocos.push(paragrafo)
        paragrafo = null
      }
      lista = lista ?? { tipo: 'lista', texto: '' }
      lista.texto += (lista.texto ? '\n' : '') + texto
      continue
    }
    if (lista && !RE_FIM_FRASE.test(lista.texto) && /^\p{Ll}/u.test(texto)) {
      lista.texto += ` ${texto}`
      continue
    }
    if (pareceFormula(texto)) {
      fechar()
      blocos.push({ tipo: 'formula', texto })
      continue
    }
    const titulo = original.titulo === true || (original.titulo !== false && !paragrafo && pareceTitulo(texto, proxima?.texto))
    if (titulo) {
      fechar()
      blocos.push({ tipo: 'titulo', texto })
      continue
    }
    if (lista) {
      blocos.push(lista)
      lista = null
    }
    if (paragrafo && !RE_FIM_FRASE.test(paragrafo.texto)) {
      // Palavra quebrada com hífen no fim da linha: "veloci-" + "dade".
      paragrafo.texto = /\p{L}-$/u.test(paragrafo.texto) ? paragrafo.texto.slice(0, -1) + texto : `${paragrafo.texto} ${texto}`
    }
    else if (paragrafo && /^\p{Ll}/u.test(texto)) {
      paragrafo.texto += ` ${texto}`
    }
    else {
      if (paragrafo) blocos.push(paragrafo)
      paragrafo = { tipo: 'texto', texto }
    }
  }
  fechar()
  return blocos
}

// Parágrafo muito longo vira mais de um trecho, cortado no fim de uma frase.
export function dividirTextoLongo(texto, maximo = LIMITES_MATERIAL.trecho, alvo = LIMITES_MATERIAL.alvoDivisao) {
  if (texto.length <= maximo) return [texto]
  const frases = texto.match(/[^.!?]+[.!?]+["”')\]]*\s*|[^.!?]+$/g) ?? [texto]
  const partes = []
  let atual = ''
  for (const f of frases) {
    if (atual && (atual + f).length > alvo) {
      partes.push(atual.trim())
      atual = ''
    }
    atual += f
  }
  if (atual.trim()) partes.push(atual.trim())
  return partes.flatMap((p) => (p.length > maximo * 1.5 ? p.match(new RegExp(`.{1,${maximo}}(\\s|$)`, 'g')).map((x) => x.trim()) : [p]))
}

const RE_DEFINICAO = /^([\p{Lu}][\p{L}\p{N} \-]{1,60}?)\s+(?:é|são|consiste em|corresponde a|define-se como|refere-se a|significa)\s+(.{12,280}?[.;])/u
const RE_DENOMINA = /(?:^|\.\s+)(?:Denomina-se|Chama-se|Define-se|Dá-se o nome de)\s+(.{3,60}?)\s+(?:a|o|as|os|ao|à)\s+(.{8,240}?[.;])/u

export function acharDefinicao(texto) {
  const t = limpar(texto)
  const d = t.match(RE_DENOMINA)
  if (d) return { termo: limpar(d[1]), definicao: limpar(d[2]) }
  const m = t.match(RE_DEFINICAO)
  if (!m) return null
  const termo = limpar(m[1])
  if (contarPalavras(termo) > 6 || STOPWORDS.has(termo.toLowerCase())) return null
  return { termo, definicao: limpar(`${t.slice(m[1].length, m.index + m[0].length)}`) }
}

// Legibilidade: índice de Flesch adaptado ao português (Martins e outros, 1996).
export function contarSilabas(palavra) {
  const p = palavra.toLowerCase().replace(/(?:ão|õe|ãe|ai|ei|oi|ui|au|eu|iu|ou)/g, 'a')
  return Math.max(1, (p.match(/[aeiouáéíóúâêôãõàü]+/g) ?? []).length)
}

export function legibilidade(texto) {
  const palavras = String(texto).match(/\p{L}+/gu) ?? []
  const frases = Math.max(1, (String(texto).match(/[.!?]+(?:\s|$)/g) ?? []).length)
  if (palavras.length < 30) return null
  const silabas = palavras.reduce((s, p) => s + contarSilabas(p), 0)
  const indice = 248.835 - 1.015 * (palavras.length / frases) - 84.6 * (silabas / palavras.length)
  return Math.round(Math.min(100, Math.max(0, indice)))
}

export function faixaLegibilidade(indice) {
  if (indice === null || indice === undefined) return 'texto curto demais para medir'
  if (indice >= 75) return 'muito fácil, anos iniciais do fundamental'
  if (indice >= 50) return 'fácil, anos finais do fundamental'
  if (indice >= 25) return 'difícil, ensino médio e graduação'
  return 'muito difícil, nível acadêmico'
}

// Frequência de termos (uma e duas palavras), sem palavras vazias nem números.
export function frequencias(texto, limite = 200) {
  const palavras = (String(texto).toLowerCase().match(/\p{L}[\p{L}-]*/gu) ?? []).map((p) => p.replace(/-+$/, ''))
  const conta = new Map()
  const somar = (k) => conta.set(k, (conta.get(k) ?? 0) + 1)
  for (let i = 0; i < palavras.length; i++) {
    const p = palavras[i]
    const util = p.length >= 3 && !STOPWORDS.has(p)
    if (util) somar(p)
    const q = palavras[i + 1]
    if (util && q && q.length >= 3 && !STOPWORDS.has(q)) somar(`${p} ${q}`)
  }
  return [...conta]
    .filter(([k, n]) => (k.includes(' ') ? n >= 3 : n >= 2))
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'pt-BR'))
    .slice(0, limite)
}

// Termos-chave: expressões de duas palavras valem um pouco mais; tira palavras soltas já contidas numa expressão forte.
export function termosChave(lista, quantos = 8) {
  const pontuados = lista.map(([termo, n]) => ({ termo, n, pontos: n * (termo.includes(' ') ? 1.6 : 1) }))
  const expressoes = pontuados.filter((t) => t.termo.includes(' '))
  return pontuados
    .filter((t) => t.termo.includes(' ') || !expressoes.some((e) => e.termo.split(' ').includes(t.termo) && e.n >= t.n * 0.8))
    .sort((a, b) => b.pontos - a.pontos)
    .slice(0, quantos)
    .map(({ termo, n }) => [termo, n])
}

// Assuntos sugeridos pelos títulos, com a faixa de páginas até o próximo título.
export function sugerirAssuntos(trechos, totalPaginas, quantos = 8) {
  const titulos = trechos.filter((t) => t.tipo === 'titulo')
  const vistos = new Set()
  const lista = []
  titulos.forEach((t, i) => {
    const nome = limpar(t.texto.replace(/^\s*\d+(?:\.\d+)*\.?\s+/, ''))
    const chave = nome.toLowerCase()
    if (!nome || nome.length < 3 || vistos.has(chave)) return
    vistos.add(chave)
    const fim = titulos[i + 1] ? Math.max(t.pagina, titulos[i + 1].pagina - (titulos[i + 1].pagina > t.pagina ? 1 : 0)) : totalPaginas
    lista.push({ nome: nome.slice(0, 120), paginaInicio: t.pagina, paginaFim: fim })
  })
  return lista.sort((a, b) => (b.paginaFim - b.paginaInicio) - (a.paginaFim - a.paginaInicio)).slice(0, quantos).sort((a, b) => a.paginaInicio - b.paginaInicio)
}

export function prepararMaterial(paginasLidas) {
  const paginas = paginasLidas.slice(0, LIMITES_MATERIAL.paginas)
  const repetidas = linhasRepetidas(paginas)
  const trechos = []
  const resumoPaginas = []
  let ordem = 0
  for (const p of paginas) {
    const blocos = blocosDaPagina(p, repetidas)
    let palavrasPagina = 0
    for (const b of blocos) {
      const partes = b.tipo === 'texto' ? dividirTextoLongo(b.texto) : [b.texto.slice(0, 20000)]
      for (const texto of partes) {
        ordem += 1
        if (b.tipo !== 'rodape') palavrasPagina += contarPalavras(texto)
        trechos.push({ ordem, pagina: p.numero, tipo: b.tipo, texto, usar: b.tipo !== 'rodape' })
      }
    }
    resumoPaginas.push({ numero: p.numero, palavras: palavrasPagina })
  }

  const conceitos = []
  let tituloAtual = ''
  for (const t of trechos) {
    if (t.tipo === 'titulo') tituloAtual = t.texto.replace(/^\s*\d+(?:\.\d+)*\.?\s+/, '')
    if (t.tipo === 'texto') {
      const d = acharDefinicao(t.texto)
      if (d) conceitos.push({ tipo: 'definicao', termo: d.termo.slice(0, 200), definicao: d.definicao.slice(0, 2000), pagina: t.pagina, trechoOrdem: t.ordem })
    }
    // Fórmula que a leitura do PDF desmontou ("=- 2a b") não vira conceito: ia aparecer quebrada no estudo.
    if (t.tipo === 'formula' && formulaValida(t.texto)) conceitos.push({ tipo: 'formula', termo: t.texto.slice(0, 200), definicao: tituloAtual.slice(0, 2000), pagina: t.pagina, trechoOrdem: t.ordem })
  }

  const corpo = trechos.filter((t) => t.usar).map((t) => t.texto).join('\n')
  const prosa = trechos.filter((t) => t.tipo === 'texto').map((t) => t.texto).join(' ')
  const palavras = contarPalavras(corpo)
  const indice = legibilidade(prosa)
  const freq = frequencias(corpo)
  const definicoes = conceitos.filter((c) => c.tipo === 'definicao').length
  const textos = trechos.filter((t) => t.tipo === 'texto').length
  const listasNumeradas = trechos.filter((t) => t.tipo === 'lista' && /^\s*\d/.test(t.texto)).length
  const unidades = (corpo.match(RE_UNIDADE) ?? []).length

  const analise = {
    palavras,
    caracteres: corpo.length,
    leituraMin: Math.max(1, Math.round(palavras / 200)),
    legibilidade: indice,
    faixa: faixaLegibilidade(indice),
    paginasComTexto: resumoPaginas.filter((p) => p.palavras > 0).length,
    estrutura: {
      titulos: trechos.filter((t) => t.tipo === 'titulo').length,
      listas: trechos.filter((t) => t.tipo === 'lista').length,
      formulas: trechos.filter((t) => t.tipo === 'formula').length,
      numerosComUnidade: unidades,
      datas: (corpo.match(RE_DATA) ?? []).length,
      rodapes: trechos.filter((t) => t.tipo === 'rodape').length,
    },
    definicoes,
    frequencias: freq,
    termos: termosChave(freq),
    assuntosSugeridos: sugerirAssuntos(trechos, resumoPaginas.length),
    // Estimativa do que dá para montar sem IA depois da conferência (as questões em si entram na Etapa 5b).
    questoesLocais: {
      lacuna: Math.min(textos, 60),
      verdadeiroFalso: Math.min(definicoes * 2 + Math.floor(unidades / 3), 60),
      associacao: Math.floor(definicoes / 3),
      ordenar: listasNumeradas,
    },
  }
  return { paginas: resumoPaginas, trechos, conceitos, analise }
}
