// Gráfico de função nas explicações. Lê "f(x) = x² - 6x + 5" (ou "y = 2x + 1"), calcula sem eval (leitor de
// expressoes.js) e acha o que interessa desenhar: raízes, vértice (2º grau), onde corta o eixo y e uma janela que
// mostre tudo isso. Usado pelo bloco ```grafico``` do TextoRico e pelo "Ver o gráfico" das correções.
import { analisarExpressao, calcular, formatarNumero, variaveisDe } from './expressoes.js'

const RE_FUNCAO = /(?:^|[^\p{L}])([fghy])\s*(?:\(\s*x\s*\))?\s*=\s*([^=;?\n]+)/u

// Tira cifrões e o LaTeX mais comum, para o leitor de fórmulas entender.
function semLatex(texto) {
  return String(texto ?? '')
    .replace(/\$/g, '')
    .replace(/\\left|\\right/g, '')
    .replace(/\\frac\s*\{([^{}]+)\}\s*\{([^{}]+)\}/g, '($1)/($2)')
    .replace(/\\cdot|\\times/g, '*')
    .replace(/\^\{([^{}]+)\}/g, '^($1)')
    .replace(/[{}]/g, '')
    .replace(/\\/g, '')
}

// "f(x) = x^2 - 6x + 5" -> { nome: 'f(x)', expressao, calcular(x) } ou null.
export function lerFuncao(linha) {
  const t = semLatex(linha).trim().replace(/[.,]\s*$/, '')
  if (!t) return null
  const m = t.match(/^\s*([fghy])\s*(\(\s*x\s*\))?\s*=\s*(.+)$/u)
  const nome = m ? (m[1] === 'y' ? 'y' : `${m[1]}(x)`) : 'f(x)'
  const expressao = (m ? m[3] : t).trim()
  try {
    const arvore = analisarExpressao(expressao)
    const vars = [...variaveisDe(arvore)]
    if (!vars.length || vars.some((v) => v !== 'x')) return null
    const f = (x) => calcular(arvore, { x })
    if (!Number.isFinite(f(0.37)) && !Number.isFinite(f(1.3))) return null
    return { nome, expressao, calcular: f }
  }
  catch {
    return null
  }
}

// Acha uma função no texto de uma questão: "Qual é o vértice de f(x) = x² - 6x + 5?". Só polinômios de grau 1 ou 2,
// que são os gráficos que ajudam na explicação. Devolve a linha ("f(x) = ...") ou null.
export function acharFuncao(texto) {
  const t = semLatex(texto)
  const m = t.match(RE_FUNCAO)
  if (!m || !/x/.test(m[2])) return null
  // A conta vai até a primeira palavra ("f(x) = x² - 6x + 5 passa por..." fica com "x² - 6x + 5").
  const expressao = (m[2].match(/^[\sx\d+\-−*·×/^²³().,√]+/u)?.[0] ?? '').replace(/[.,:\s]+$/, '').trim()
  const nome = m[1] === 'y' ? 'y' : `${m[1]}(x)`
  const lida = lerFuncao(`${nome} = ${expressao}`)
  if (!lida) return null
  const grau = grauDoPolinomio(lida.calcular)
  return grau === 1 || grau === 2 ? `${nome} = ${expressao}` : null
}

const perto = (a, b) => Math.abs(a - b) < 1e-7 * Math.max(1, Math.abs(a), Math.abs(b))

// Grau pelo método das diferenças (em x = -2..3): 0, 1, 2 ou null (não é polinômio até o grau 3).
export function grauDoPolinomio(f) {
  let v = [-2, -1, 0, 1, 2, 3].map(f)
  if (v.some((y) => !Number.isFinite(y))) return null
  for (let g = 0; g <= 3; g++) {
    if (v.every((y) => perto(y, v[0]))) return g
    v = v.slice(1).map((y, i) => y - v[i])
  }
  return null
}

const arredondar = (n) => Math.round(n * 1000) / 1000
const ponto = (x, y, rotulo) => ({ x: arredondar(x), y: arredondar(y), rotulo })

// Pontos importantes e a janela do desenho.
export function analisarFuncao(f) {
  const grau = grauDoPolinomio(f)
  const c = f(0)
  const pontos = []
  let a = 0
  let b = 0
  let vertice = null
  const raizes = []
  if (grau === 2) {
    a = (f(1) + f(-1) - 2 * c) / 2
    b = (f(1) - f(-1)) / 2
    const delta = b * b - 4 * a * c
    const xv = -b / (2 * a)
    vertice = ponto(xv, f(xv), 'vértice')
    if (delta > 1e-9) raizes.push((-b - Math.sqrt(delta)) / (2 * a), (-b + Math.sqrt(delta)) / (2 * a))
    else if (Math.abs(delta) <= 1e-9) raizes.push(xv)
  }
  else if (grau === 1) {
    b = f(1) - c
    raizes.push(-c / b)
  }
  else {
    // Outras funções: procura onde o sinal troca entre -10 e 10.
    for (let x = -10; x < 10; x += 0.05) {
      const y1 = f(x)
      const y2 = f(x + 0.05)
      if (Number.isFinite(y1) && Number.isFinite(y2) && Math.sign(y1) !== Math.sign(y2)) raizes.push(x + 0.025)
      if (raizes.length >= 4) break
    }
  }
  raizes.sort((p, q) => p - q)
  for (const r of raizes) pontos.push(ponto(r, 0, 'raiz'))
  if (vertice && !raizes.some((r) => perto(r, vertice.x))) pontos.push(vertice)
  else if (vertice) pontos.find((p) => perto(p.x, vertice.x)).rotulo = 'vértice e raiz'
  if (Number.isFinite(c) && !pontos.some((p) => perto(p.x, 0))) pontos.push(ponto(0, c, 'corta o eixo y'))

  // Janela: todos os pontos com folga, pelo menos de -5 a 5 em volta deles.
  const xs = [...pontos.map((p) => p.x), 0]
  let xmin = Math.min(...xs) - 2
  let xmax = Math.max(...xs) + 2
  if (xmax - xmin < 8) {
    const meio = (xmin + xmax) / 2
    xmin = meio - 4
    xmax = meio + 4
  }
  xmin = Math.floor(xmin)
  xmax = Math.ceil(xmax)
  const amostras = []
  const passos = 120
  for (let i = 0; i <= passos; i++) {
    const x = xmin + ((xmax - xmin) * i) / passos
    const y = f(x)
    if (Number.isFinite(y)) amostras.push({ x: arredondar(x), y: arredondar(y) })
  }
  const ysPontos = [...pontos.map((p) => p.y), 0]
  // O eixo y mostra os pontos com folga; a curva pode sair por cima ou por baixo (é cortada no desenho).
  let ymin = Math.min(...ysPontos)
  let ymax = Math.max(...ysPontos)
  const ysCurva = amostras.map((p) => p.y).sort((p, q) => p - q)
  const ate = Math.max(Math.abs(ymax - ymin), 4) * 0.5
  ymin = Math.max(Math.min(ymin, ysCurva[0] ?? ymin), ymin - ate)
  ymax = Math.min(Math.max(ymax, ysCurva.at(-1) ?? ymax), ymax + ate)
  const folga = Math.max(1, (ymax - ymin) * 0.12)
  return {
    grau,
    a: arredondar(a),
    b: arredondar(b),
    c: arredondar(c),
    pontos,
    amostras,
    janela: { xmin, xmax, ymin: Math.floor(ymin - folga), ymax: Math.ceil(ymax + folga) },
  }
}

const num = (n) => formatarNumero(Math.abs(n) < 1e-9 ? 0 : n)

// Frase para leitor de tela e legenda: "Parábola com a boca para cima. Raízes em x = 1 e x = 5. Vértice em (3, -4)."
export function descreverFuncao(nome, analise) {
  const partes = []
  if (analise.grau === 2) partes.push(`${nome} é uma parábola com a concavidade para ${analise.a > 0 ? 'cima' : 'baixo'}.`)
  else if (analise.grau === 1) partes.push(`${nome} é uma reta ${analise.b > 0 ? 'que sobe' : analise.b < 0 ? 'que desce' : 'horizontal'}.`)
  const raizes = analise.pontos.filter((p) => p.rotulo.includes('raiz'))
  if (raizes.length) partes.push(`${raizes.length === 1 ? 'Raiz em' : 'Raízes em'} ${raizes.map((r) => `x = ${num(r.x)}`).join(' e ')}.`)
  else if (analise.grau === 2) partes.push('Não corta o eixo x (sem raízes reais).')
  const v = analise.pontos.find((p) => p.rotulo.startsWith('vértice'))
  if (v) partes.push(`Vértice em (${num(v.x)}; ${num(v.y)}).`)
  const y0 = analise.pontos.find((p) => p.rotulo === 'corta o eixo y')
  if (y0) partes.push(`Corta o eixo y em y = ${num(y0.y)}.`)
  return partes.join(' ')
}

export const numeroDoGrafico = num
