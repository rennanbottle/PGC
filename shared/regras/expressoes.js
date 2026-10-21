// Leitor de fórmulas simples, sem eval: "v = Δs/Δt", "h = g·t²/2", "s = s0 + vt".
// Aceita + − × · * / ÷ ^ ² ³ √, parênteses, números com vírgula ou ponto e variáveis.
// Variável: um Δ opcional, uma letra e, se houver, números ou índices (s0, v₀, t'). "vt" vira v × t.
// O lado esquerdo do "=" é o nome do resultado (pode ter mais de uma letra, como "Ec").

const SUBSCRITOS = { '₀': '0', '₁': '1', '₂': '2', '₃': '3', '₄': '4', '₅': '5', '₆': '6', '₇': '7', '₈': '8', '₉': '9' }
const RE_VARIAVEL = /^(?:[ΔΔ∆])?\p{L}(?:[0-9₀-₉]+|')?/u

export function tokenizar(texto) {
  const t = String(texto ?? '').replace(/−/g, '-').replace(/[·×∙⋅]/g, '*').replace(/÷/g, '/')
  const tokens = []
  let i = 0
  while (i < t.length) {
    const resto = t.slice(i)
    const c = t[i]
    if (/\s/.test(c)) { i++; continue }
    const num = resto.match(/^\d+(?:[.,]\d+)?/)
    if (num) {
      tokens.push({ tipo: 'num', valor: Number(num[0].replace(',', '.')) })
      i += num[0].length
      continue
    }
    if (c === '²' || c === '³') {
      tokens.push({ tipo: 'op', valor: '^' }, { tipo: 'num', valor: c === '²' ? 2 : 3 })
      i++
      continue
    }
    if ('+-*/^()'.includes(c)) {
      tokens.push({ tipo: c === '(' || c === ')' ? c : 'op', valor: c })
      i++
      continue
    }
    if (c === '√') {
      tokens.push({ tipo: 'raiz' })
      i++
      continue
    }
    const v = resto.match(RE_VARIAVEL)
    if (v) {
      const nome = v[0].replace(/[₀-₉]/g, (s) => SUBSCRITOS[s]).replace(/[Δ∆]/, 'Δ')
      tokens.push(nome === 'π' ? { tipo: 'num', valor: Math.PI } : { tipo: 'var', valor: nome })
      i += v[0].length
      continue
    }
    throw new Error(`Símbolo não reconhecido: ${c}`)
  }
  // Multiplicação implícita: "2t", "vt", "g(t)", ")(" e "t√".
  const saida = []
  for (const tk of tokens) {
    const ant = saida.at(-1)
    const fimDeValor = ant && (ant.tipo === 'num' || ant.tipo === 'var' || ant.tipo === ')')
    const comecoDeValor = tk.tipo === 'num' || tk.tipo === 'var' || tk.tipo === '(' || tk.tipo === 'raiz'
    if (fimDeValor && comecoDeValor) saida.push({ tipo: 'op', valor: '*' })
    saida.push(tk)
  }
  return saida
}

// Gramática: soma > produto > unário > potência > átomo. Devolve uma árvore.
export function analisarExpressao(texto) {
  const tokens = tokenizar(texto)
  let p = 0
  const ver = () => tokens[p]
  const pegar = () => tokens[p++]
  function soma() {
    let no = produto()
    while (ver()?.tipo === 'op' && (ver().valor === '+' || ver().valor === '-')) no = { op: pegar().valor, a: no, b: produto() }
    return no
  }
  function produto() {
    let no = unario()
    while (ver()?.tipo === 'op' && (ver().valor === '*' || ver().valor === '/')) no = { op: pegar().valor, a: no, b: unario() }
    return no
  }
  function unario() {
    if (ver()?.tipo === 'op' && ver().valor === '-') {
      pegar()
      return { op: 'neg', a: unario() }
    }
    if (ver()?.tipo === 'op' && ver().valor === '+') {
      pegar()
      return unario()
    }
    return potencia()
  }
  function potencia() {
    const base = atomo()
    if (ver()?.tipo === 'op' && ver().valor === '^') {
      pegar()
      return { op: '^', a: base, b: unario() }
    }
    return base
  }
  function atomo() {
    const tk = pegar()
    if (!tk) throw new Error('Fórmula incompleta.')
    if (tk.tipo === 'num') return { num: tk.valor }
    if (tk.tipo === 'var') return { var: tk.valor }
    if (tk.tipo === 'raiz') return { op: 'raiz', a: atomo() }
    if (tk.tipo === '(') {
      const no = soma()
      if (pegar()?.tipo !== ')') throw new Error('Parêntese sem fechar.')
      return no
    }
    throw new Error('Fórmula mal escrita.')
  }
  const arvore = soma()
  if (p < tokens.length) throw new Error('Fórmula mal escrita.')
  return arvore
}

export function variaveisDe(arvore, conjunto = new Set()) {
  if (arvore.var) conjunto.add(arvore.var)
  if (arvore.a) variaveisDe(arvore.a, conjunto)
  if (arvore.b) variaveisDe(arvore.b, conjunto)
  return conjunto
}

export function calcular(arvore, valores) {
  if ('num' in arvore) return arvore.num
  if (arvore.var) {
    if (!(arvore.var in valores)) throw new Error(`Falta o valor de ${arvore.var}.`)
    return valores[arvore.var]
  }
  const a = calcular(arvore.a, valores)
  if (arvore.op === 'neg') return -a
  if (arvore.op === 'raiz') return Math.sqrt(a)
  const b = calcular(arvore.b, valores)
  if (arvore.op === '+') return a + b
  if (arvore.op === '-') return a - b
  if (arvore.op === '*') return a * b
  if (arvore.op === '/') return a / b
  if (arvore.op === '^') return a ** b
  throw new Error('Operação desconhecida.')
}

// Separa "h = g·t²/2" em { nome: 'h', arvore, variaveis: ['g', 't'] }. Devolve null se não der.
export function lerFormula(texto) {
  const partes = String(texto ?? '').split('=')
  if (partes.length !== 2) return null
  const nome = partes[0].trim()
  if (!/^[ΔΔ∆]?\p{L}[\p{L}0-9₀-₉']{0,5}$/u.test(nome)) return null
  try {
    const arvore = analisarExpressao(partes[1])
    const variaveis = [...variaveisDe(arvore)]
    if (!variaveis.length || variaveis.length > 4) return null
    return { nome, expressao: partes[1].trim(), arvore, variaveis }
  }
  catch {
    return null
  }
}

// Número em português: vírgula decimal, no máximo 2 casas.
export const formatarNumero = (n) => new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 }).format(n)
