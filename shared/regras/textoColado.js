// Conserta o texto colado (ou de arquivo TXT) antes de ele virar texto da Biblioteca. Função pura.
// A matemática chega quebrada de três jeitos:
//   1. Copiada de página (Wikipédia, resposta do Google): a fórmula se parte em linhas ("ax", "2", "+bx+c"), o
//      índice e a fração viram linhas soltas marcadas por um caractere invisível, e o "≠" vira um caractere
//      privado mais "=".
//   2. Em LaTeX, como as IAs escrevem: \( x^2 \), \[ x_v = -\dfrac{b}{2a} \], $$\Delta$$. Vira texto legível:
//      x², xᵥ = −b/(2a), Δ.
//   3. Com a marcação de Markdown das IAs (### título, **negrito**, - item): vira texto simples.
// Código (blocos entre ``` ou texto que parece código) não é mexido: só perde os caracteres invisíveis.

const INVISIVEIS = /[​-‍⁠-⁤﻿]/g
const ESPACO_ZERO = '​'

// Parece código: muitas linhas com recuo, chaves ou palavras de linguagem.
export function pareceCodigo(texto) {
  const linhas = String(texto ?? '').split('\n').filter((l) => l.trim())
  if (linhas.length < 3) return false
  const tipicas = linhas.filter((l) => /^( {2,}|\t)\S/.test(l) || /^[{}]\s*$/.test(l.trim()) || /[;{]\s*$/.test(l) || /^\s*(def|class|for|while|if|elif|else|return|import|print|function|const|let|var|public|#include)\b/.test(l))
  return tipicas.length / linhas.length >= 0.3
}

// ---------- Expoente e índice em Unicode ----------
const SOBRE = { 0: '⁰', 1: '¹', 2: '²', 3: '³', 4: '⁴', 5: '⁵', 6: '⁶', 7: '⁷', 8: '⁸', 9: '⁹', '+': '⁺', '-': '⁻', '−': '⁻', '=': '⁼', '(': '⁽', ')': '⁾', a: 'ᵃ', b: 'ᵇ', c: 'ᶜ', d: 'ᵈ', e: 'ᵉ', f: 'ᶠ', g: 'ᵍ', h: 'ʰ', i: 'ⁱ', j: 'ʲ', k: 'ᵏ', l: 'ˡ', m: 'ᵐ', n: 'ⁿ', o: 'ᵒ', p: 'ᵖ', r: 'ʳ', s: 'ˢ', t: 'ᵗ', u: 'ᵘ', v: 'ᵛ', w: 'ʷ', x: 'ˣ', y: 'ʸ', z: 'ᶻ' }
const SOB = { 0: '₀', 1: '₁', 2: '₂', 3: '₃', 4: '₄', 5: '₅', 6: '₆', 7: '₇', 8: '₈', 9: '₉', '+': '₊', '-': '₋', '−': '₋', '=': '₌', '(': '₍', ')': '₎', a: 'ₐ', e: 'ₑ', h: 'ₕ', i: 'ᵢ', j: 'ⱼ', k: 'ₖ', l: 'ₗ', m: 'ₘ', n: 'ₙ', o: 'ₒ', p: 'ₚ', r: 'ᵣ', s: 'ₛ', t: 'ₜ', u: 'ᵤ', v: 'ᵥ', x: 'ₓ' }
const MARCAS = new Set([...Object.values(SOBRE), ...Object.values(SOB), '°', '′'])
const trocar = (s, mapa) => ([...s].every((c) => mapa[c]) ? [...s].map((c) => mapa[c]).join('') : null)
const sobrescrito = (s) => (s === '∘' || s === '°' ? '°' : trocar(s, SOBRE))
const subscrito = (s) => trocar(s, SOB)

// Parte de uma fração que dispensa parênteses: um número ou uma letra (com expoente ou índice).
const simples = (s) => /^−?\d+([.,]\d+)?$/.test(s) || (/^\p{L}/u.test(s) && [...s].slice(1).every((c) => MARCAS.has(c)))
function entreParenteses(s) {
  const t = s.trim()
  if (!t || simples(t)) return t
  if (/^\(.*\)$/.test(t) && !/\)\s*\(/.test(t.slice(1, -1))) return t
  return `(${t})`
}
const fracao = (num, den) => `${entreParenteses(num)}/${entreParenteses(den)}`

// ---------- 1. Fórmula copiada de página (KaTeX) ----------
// Peça de fórmula numa linha só, sem espaço nas pontas: o índice "v", o "2a" e o "b" de uma fração.
const peca = (l) => l.length > 0 && l.length <= 8 && l === l.trim() && !l.includes(ESPACO_ZERO)
function desfazerFormulasCopiadas(texto) {
  if (!texto.includes(ESPACO_ZERO)) return texto
  const saida = []
  for (const linha of texto.split('\n')) {
    if (!linha.includes(ESPACO_ZERO) || linha.replace(/[​\s]/g, '')) {
      saida.push(linha)
      continue
    }
    // Linha só com o caractere invisível: fecha um índice (uma peça antes) ou uma fração (duas peças: a de baixo
    // vem primeiro na cópia). A linha de antes delas é a base (o "x" do índice, o "=−" da fração).
    let n = 0
    while (n < 3 && n < saida.length && peca(saida[saida.length - 1 - n])) n++
    const fim = saida.length
    if (n === 1 && fim >= 2) {
      const ind = saida[fim - 1]
      saida.splice(fim - 2, 2, saida[fim - 2].replace(/\s+$/, '') + (subscrito(ind) ?? `_${ind}`))
    }
    else if (n === 2) {
      const [den, num] = [saida[fim - 2], saida[fim - 1]]
      const base = fim >= 3 ? saida[fim - 3].replace(/\s+$/, '') : ''
      saida.splice(Math.max(0, fim - 3), fim >= 3 ? 3 : 2, base + fracao(num, den))
    }
  }
  return saida.join('\n')
}

// ---------- 2. LaTeX ----------
const GREGAS = { alpha: 'α', beta: 'β', gamma: 'γ', delta: 'δ', epsilon: 'ε', varepsilon: 'ε', zeta: 'ζ', eta: 'η', theta: 'θ', vartheta: 'θ', iota: 'ι', kappa: 'κ', lambda: 'λ', mu: 'μ', nu: 'ν', xi: 'ξ', pi: 'π', rho: 'ρ', sigma: 'σ', tau: 'τ', upsilon: 'υ', phi: 'φ', varphi: 'φ', chi: 'χ', psi: 'ψ', omega: 'ω', Gamma: 'Γ', Delta: 'Δ', Theta: 'Θ', Lambda: 'Λ', Xi: 'Ξ', Pi: 'Π', Sigma: 'Σ', Phi: 'Φ', Psi: 'Ψ', Omega: 'Ω' }
const SIMBOLOS = {
  neq: '≠', ne: '≠', leq: '≤', le: '≤', geq: '≥', ge: '≥', pm: '±', mp: '∓', times: '×', cdot: '·', div: '÷', ast: '*',
  infty: '∞', to: '→', rightarrow: '→', leftarrow: '←', Rightarrow: '⇒', Leftarrow: '⇐', Leftrightarrow: '⇔', iff: '⇔', implies: '⇒', mapsto: '↦',
  in: '∈', notin: '∉', ni: '∋', subset: '⊂', subseteq: '⊆', supset: '⊃', cup: '∪', cap: '∩', setminus: '∖', emptyset: '∅', varnothing: '∅',
  approx: '≈', equiv: '≡', cong: '≅', sim: '~', propto: '∝', forall: '∀', exists: '∃', neg: '¬', land: '∧', lor: '∨', perp: '⊥', parallel: '∥',
  angle: '∠', degree: '°', circ: '∘', ldots: '…', cdots: '⋯', dots: '…', vdots: '⋮', partial: '∂', nabla: '∇', sum: 'Σ', prod: 'Π', int: '∫',
  prime: '′', langle: '⟨', rangle: '⟩', lfloor: '⌊', rfloor: '⌋', lceil: '⌈', rceil: '⌉', vert: '|', Vert: '‖', mid: '|', lbrace: '{', rbrace: '}',
  quad: ' ', qquad: ' ', ',': ' ', ';': ' ', ':': ' ', '!': '', ' ': ' ', '%': '%', '$': '$', '{': '{', '}': '}', '_': '_', '&': '&', '#': '#', '|': '‖',
}
const SO_O_TEXTO = new Set(['text', 'textbf', 'textit', 'textrm', 'textsf', 'texttt', 'mathrm', 'mathbf', 'mathit', 'mathsf', 'mathtt', 'mathcal', 'boldsymbol', 'bm', 'operatorname', 'mbox', 'hbox', 'emph', 'underline'])
const IGNORAR = new Set(['left', 'right', 'big', 'Big', 'bigg', 'Bigg', 'bigl', 'bigr', 'Bigl', 'Bigr', 'displaystyle', 'textstyle', 'scriptstyle', 'limits', 'nolimits', 'nonumber', 'notag'])
const CONJUNTOS = { R: 'ℝ', N: 'ℕ', Z: 'ℤ', Q: 'ℚ', C: 'ℂ', I: 'I' }
const ACENTOS = { bar: '̄', overline: '̄', vec: '⃗', overrightarrow: '⃗', hat: '̂', widehat: '̂', dot: '̇', tilde: '̃', widetilde: '̃' }

export function latexParaTexto(fonte) {
  const src = String(fonte ?? '')
  let i = 0
  const pular = () => {
    while (src[i] === ' ' || src[i] === '\n') i++
  }
  function ate(fecho) {
    let out = ''
    while (i < src.length && src[i] !== fecho) out += item()
    i++
    return out
  }
  function argumento() {
    pular()
    if (src[i] === '{') {
      i++
      return ate('}')
    }
    if (src[i] === '\\') return comando()
    return src[i++] ?? ''
  }
  // \text{...}: o que está dentro é texto comum, sem trocar o hífen pelo sinal de menos.
  function textoCru() {
    pular()
    if (src[i] !== '{') return argumento()
    let nivel = 0
    const inicio = i + 1
    for (; i < src.length; i++) {
      if (src[i] === '{') nivel++
      else if (src[i] === '}' && --nivel === 0) break
    }
    return src.slice(inicio, i++).replace(/\\([{}%$&#_ ])/g, '$1')
  }
  function comando() {
    i++
    let nome = ''
    if (/[a-zA-Z]/.test(src[i] ?? '')) while (i < src.length && /[a-zA-Z]/.test(src[i])) nome += src[i++]
    else nome = src[i++] ?? ''
    if (nome === '\\') return '; '
    if (['frac', 'dfrac', 'tfrac', 'cfrac'].includes(nome)) {
      const num = argumento()
      return fracao(num, argumento())
    }
    if (nome === 'sqrt') {
      pular()
      let indice = ''
      if (src[i] === '[') {
        i++
        indice = ate(']')
      }
      const r = argumento()
      return `${indice ? (sobrescrito(indice) ?? indice) : ''}√${entreParenteses(r)}`
    }
    if (SO_O_TEXTO.has(nome)) return textoCru()
    if (nome === 'mathbb' || nome === 'Bbb') {
      const g = argumento()
      return CONJUNTOS[g] ?? g
    }
    if (ACENTOS[nome]) return [...argumento()].map((c) => c + ACENTOS[nome]).join('')
    if (nome === 'begin' || nome === 'end') {
      argumento()
      return nome === 'end' ? ' ' : ''
    }
    if (IGNORAR.has(nome)) {
      if ((nome === 'left' || nome === 'right') && src[i] === '.') i++
      return ''
    }
    return GREGAS[nome] ?? SIMBOLOS[nome] ?? nome
  }
  function item() {
    const c = src[i]
    if (c === '\\') return comando()
    if (c === '{') {
      i++
      return ate('}')
    }
    i++
    if (c === '}') return ''
    if (c === '^' || c === '_') {
      const g = argumento().trim()
      const pronto = c === '^' ? sobrescrito(g) : subscrito(g)
      return pronto ?? (g.length === 1 ? `${c}${g}` : `${c}(${g})`)
    }
    if (c === '-') return '−'
    if (c === '~' || c === '&') return ' '
    return c
  }
  let out = ''
  while (i < src.length) out += item()
  return out.replace(/[ \t]{2,}/g, ' ').trim()
}

// Acha as fórmulas em LaTeX no meio do texto: \[...\], $$...$$, \(...\) e $...$ (este só quando parece fórmula,
// para não confundir com preço, como "R$ 80,00").
function converterLatex(texto) {
  return texto
    .replace(/\\\[([\s\S]+?)\\\]/g, (m, x) => latexParaTexto(x))
    .replace(/\$\$([\s\S]+?)\$\$\$?/g, (m, x) => latexParaTexto(x))
    .replace(/\\\(([\s\S]+?)\\\)/g, (m, x) => latexParaTexto(x))
    .replace(/(?<![R\\$\w])\$(?=\S)([^$\n]{1,200}?)(?<=\S)\$(?![\d$])/g, (m, x) => (/[\\^_{}=<>+]/.test(x) || /^[A-Za-zΔ]{1,2}$/.test(x) ? latexParaTexto(x) : m))
}

// ---------- 3. Markdown ----------
function limparMarkdown(texto) {
  return texto.split('\n').map((linha) => {
    if (/^\s*([-*_])(\s*\1){2,}\s*$/.test(linha)) return ''
    let l = linha.replace(/^\s{0,3}#{1,6}\s+/, '').replace(/\s+#+\s*$/, '')
    l = l.replace(/^(\s*)[-*]\s+(?=\S)/, '$1• ').replace(/^\s*>\s?/, '')
    l = l.replace(/\*\*(?=\S)(.+?)(?<=\S)\*\*/g, '$1').replace(/__(?=\S)(.+?)(?<=\S)__/g, '$1')
    l = l.replace(/(^|[\s(“"])\*(?=\S)([^*\n]+?)(?<=\S)\*(?=[\s).,;:!?”"]|$)/g, '$1$2')
    return l.replace(/\[([^\]\n]+)\]\((?:https?:)?[^)\s]+\)/g, '$1')
  }).join('\n')
}

// ---------- Linhas partidas ----------
const curta = (l) => {
  const t = l.trim()
  return t.length > 0 && t.length <= 4
}
function juntarLinhas(texto) {
  // Expoente que caiu sozinho numa linha: "ax \n2\n +bx" vira "ax² +bx".
  const t = texto.replace(/([A-Za-z)\]])[ \t]*\n[ \t]*(\d{1,2})[ \t]*(?=\n|$)/g, (m, base, exp) => base + sobrescrito(exp))
  const saida = []
  let ultimaCurta = false
  for (const linha of t.split('\n')) {
    const anterior = saida.at(-1)
    // A linha continua a anterior quando é um pedaço curto, começa com sinal ou com uma variável seguida de sinal
    // ("a>0", "f(x)=", "x,"), ou quando a anterior terminou com espaço ou sinal (a cópia quebrou no meio da frase).
    const juntar = linha.trim() && anterior?.trim() && !/[.!?:]\s*$/.test(anterior) && !/^\s*•/.test(linha)
      && (curta(linha) || ultimaCurta || /^\s*[+\-−=≠<>≤≥,.;:)²³]/.test(linha) || /^\s*[A-Za-zΔ](\(\w\))?\s*[:=<>≤≥≠,;)+\-−]/.test(linha)
        || /[=+\-−(]\s*$/.test(anterior) || / $/.test(anterior))
    if (juntar) saida[saida.length - 1] = `${anterior.replace(/\s+$/, '')} ${linha.trim()}`
    else saida.push(linha)
    ultimaCurta = curta(linha)
  }
  return saida.join('\n')
}

function arrumarEspacos(texto) {
  return texto
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/ +([,;)\]])/g, '$1')
    .replace(/([([]) +/g, '$1')
    .replace(/,(?=[^\s\d"”')\]])/g, ', ')
    .replace(/ ([=≠≤≥])(?=[^\s=])/g, ' $1 ')
    .replace(/[ \t]+$/gm, '')
}

function limparProsa(trecho) {
  // "≠" que a cópia partiu em um caractere privado mais "=" (KaTeX) ou "=" com a barra combinada.
  let t = trecho.replace(/\s*=/g, '≠').replace(/=\s*̸/g, '≠').replace(/[-]/g, '')
  t = desfazerFormulasCopiadas(t).replace(INVISIVEIS, '')
  if (pareceCodigo(t)) return t
  t = limparMarkdown(converterLatex(t)).replace(/ {2,}$/gm, '')
  return arrumarEspacos(juntarLinhas(t))
}

export function limparTextoColado(texto) {
  const t = String(texto ?? '').replace(/\r\n?/g, '\n')
  // Blocos de código entre ``` ficam como estão.
  return t.split(/(^```[^\n]*\n[\s\S]*?^```[ \t]*$)/m)
    .map((parte, i) => (i % 2 ? parte.replace(INVISIVEIS, '') : limparProsa(parte)))
    .join('')
    .replace(/\n{3,}/g, '\n\n')
}
