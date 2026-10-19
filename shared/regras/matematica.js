// Matemática no texto: acha as expressões e escreve cada uma em LaTeX para o KaTeX desenhar (fração em pé,
// índice embaixo, potência em cima, raiz de verdade). Vale para tudo o que passa por <TextoRico>: enunciado,
// alternativa, explicação, dica, correção e comentário.
//
// Dois jeitos de uma expressão entrar:
//  1. Entre cifrões: $x_v = -b/(2a)$ (o pedido às IAs manda escrever assim). "R$ 5,00" continua sendo dinheiro.
//     Também valem \( ... \), \[ ... \] e $$ ... $$ (este em linha própria).
//  2. Sem cifrões, como as questões antigas: "xv=-b/(2a)", "Δ=b²-4ac", "x² - 9x + 20 = 0". O PGC reconhece pelo
//     sinal (=, <, ≤, ², √, ±...) e só quando a palavra inteira é de matemática; o resto do texto fica igual.
// Dentro da expressão a escrita é a de sempre: ^ ou ² para potência, _ ou x1 para índice, / para fração (com
// parênteses quando precisa), √ ou sqrt( ) para raiz. Quem já escreve LaTeX (\frac{b}{2a}) também é aceito.

// ---------- Símbolos ----------
const GREGAS = {
  α: '\\alpha', β: '\\beta', γ: '\\gamma', δ: '\\delta', ε: '\\varepsilon', θ: '\\theta', λ: '\\lambda', μ: '\\mu',
  π: '\\pi', ρ: '\\rho', σ: '\\sigma', τ: '\\tau', φ: '\\varphi', ω: '\\omega', Δ: '\\Delta', '∆': '\\Delta', Ω: '\\Omega',
  Σ: '\\Sigma', Φ: '\\Phi', Θ: '\\Theta', Λ: '\\Lambda', Γ: '\\Gamma',
}
const OPERADORES = {
  '+': '+', '-': '-', '−': '-', '–': '-', '=': '=', '<': '<', '>': '>', '≤': '\\le ', '≥': '\\ge ', '≠': '\\ne ',
  '≈': '\\approx ', '≡': '\\equiv ', '±': '\\pm ', '∓': '\\mp ', '×': '\\times ', '·': '\\cdot ', '⋅': '\\cdot ',
  '*': '\\cdot ', '÷': '\\div ', '∈': '\\in ', '∉': '\\notin ', '⊂': '\\subset ', '⊆': '\\subseteq ', '⊃': '\\supset ',
  '⊇': '\\supseteq ', '∪': '\\cup ', '∩': '\\cap ', '→': '\\to ', '⇒': '\\Rightarrow ', '⇔': '\\Leftrightarrow ',
  '∧': '\\land ', '∨': '\\lor ', '¬': '\\neg ', '∥': '\\parallel ', '⊥': '\\perp ', '∠': '\\angle ', '|': '|', ':': ':',
  ';': ';', '!': '!', "'": "'",
}
const CONSTANTES = { '∞': '\\infty ', '∅': '\\emptyset ', '∂': '\\partial ', '∇': '\\nabla ', '∑': '\\sum ', '∏': '\\prod ', '∫': '\\int ', '%': '\\%', '°': '^{\\circ}' }
const SOBRESCRITOS = { '⁰': '0', '¹': '1', '²': '2', '³': '3', '⁴': '4', '⁵': '5', '⁶': '6', '⁷': '7', '⁸': '8', '⁹': '9', '⁻': '-', '⁺': '+', 'ⁿ': 'n', 'ˣ': 'x' }
const SUBSCRITOS = { '₀': '0', '₁': '1', '₂': '2', '₃': '3', '₄': '4', '₅': '5', '₆': '6', '₇': '7', '₈': '8', '₉': '9', 'ₙ': 'n', 'ₓ': 'x' }
// Nomes que viram função (sen x, log x). O resto das letras juntas é produto de variáveis (ac, bx).
const FUNCOES = {
  sen: '\\operatorname{sen}', sin: '\\sin', cos: '\\cos', tg: '\\operatorname{tg}', tan: '\\tan', cotg: '\\operatorname{cotg}',
  sec: '\\sec', log: '\\log', ln: '\\ln', exp: '\\exp', max: '\\max', min: '\\min', lim: '\\lim', mdc: '\\operatorname{mdc}', mmc: '\\operatorname{mmc}',
}

const RE_GREGA = new RegExp(`[${Object.keys(GREGAS).join('')}]`)
const ehDigito = (c) => c >= '0' && c <= '9'
const ehLetra = (c) => /[A-Za-z]/.test(c)

// ---------- Leitura em peças ----------
function pecas(s) {
  const lista = []
  let i = 0
  while (i < s.length) {
    const c = s[i]
    if (/\s/.test(c)) {
      i++
      continue
    }
    if (c === '\\' && ehLetra(s[i + 1] ?? '')) {
      let j = i + 1
      while (j < s.length && ehLetra(s[j])) j++
      lista.push({ t: 'cmd', v: s.slice(i, j) })
      i = j
      continue
    }
    if (ehDigito(c)) {
      const m = /^\d+(?:[.,]\d+)?/.exec(s.slice(i))
      lista.push({ t: 'num', v: m[0] })
      i += m[0].length
      continue
    }
    if (ehLetra(c)) {
      let j = i
      while (j < s.length && ehLetra(s[j])) j++
      lista.push({ t: 'id', v: s.slice(i, j) })
      i = j
      continue
    }
    if (SOBRESCRITOS[c] !== undefined) {
      let j = i
      let v = ''
      while (j < s.length && SOBRESCRITOS[s[j]] !== undefined) v += SOBRESCRITOS[s[j++]]
      lista.push({ t: 'sup', v })
      i = j
      continue
    }
    if (SUBSCRITOS[c] !== undefined) {
      let j = i
      let v = ''
      while (j < s.length && SUBSCRITOS[s[j]] !== undefined) v += SUBSCRITOS[s[j++]]
      lista.push({ t: 'sub', v })
      i = j
      continue
    }
    if (GREGAS[c]) lista.push({ t: 'grega', v: GREGAS[c] })
    else if ('([{'.includes(c)) lista.push({ t: 'abre', v: c })
    else if (')]}'.includes(c)) lista.push({ t: 'fecha', v: c })
    else if (c === '/') lista.push({ t: 'barra' })
    else if (c === '^') lista.push({ t: 'chapeu' })
    else if (c === '_') lista.push({ t: 'baixo' })
    else if (c === '√') lista.push({ t: 'raiz', v: '' })
    else if (c === '∛') lista.push({ t: 'raiz', v: '3' })
    else if (c === '∜') lista.push({ t: 'raiz', v: '4' })
    else if (CONSTANTES[c]) lista.push({ t: 'const', v: CONSTANTES[c] })
    else if (OPERADORES[c] !== undefined) lista.push({ t: 'op', v: OPERADORES[c] })
    else if (c === ',') lista.push({ t: 'op', v: ',\\,' })
    else if (c === '.') lista.push({ t: 'op', v: '.' })
    else lista.push({ t: 'outro', v: c.replace(/[#$&~]/g, (x) => `\\${x}`) })
    i++
  }
  return lista
}

const PARES = { '(': ')', '[': ']', '{': '}' }
const numeroTex = (v) => v.replace(',', '{,}')
const tirarParenteses = (no) => (no.grupo ? no.dentro : no.tex)

// ---------- Montagem ----------
// Cada "átomo" vira { tex, grupo?, dentro?, operando } (operando: entra em fração e produto implícito).
function montar(lista) {
  let k = 0
  const proxima = () => lista[k]

  function atomo() {
    const p = lista[k]
    if (!p) return null
    if (p.t === 'abre') {
      // Procura o fecho do mesmo nível; sem fecho, o parêntese fica sozinho, como texto.
      let nivel = 0
      let fim = -1
      for (let j = k; j < lista.length; j++) {
        if (lista[j].t === 'abre') nivel++
        else if (lista[j].t === 'fecha') {
          nivel--
          if (nivel === 0) {
            fim = j
            break
          }
        }
      }
      if (fim < 0) {
        k++
        return { tex: p.v === '{' ? '\\{' : p.v, operando: false }
      }
      const dentro = montar(lista.slice(k + 1, fim))
      const fecha = lista[fim].v
      k = fim + 1
      const abre = p.v === '{' ? '\\{' : p.v
      const fechaTex = fecha === '}' ? '\\}' : fecha
      // Parênteses que crescem só quando o conteúdo é alto (fração, raiz, potência).
      const alto = /\\frac|\\sqrt|\^|_/.test(dentro)
      return { tex: alto ? `\\left${abre}${dentro}\\right${fechaTex}` : `${abre}${dentro}${fechaTex}`, grupo: true, dentro, operando: true }
    }
    if (p.t === 'num') {
      k++
      return { tex: numeroTex(p.v), operando: true, numero: true }
    }
    if (p.t === 'grega' || p.t === 'const') {
      k++
      return { tex: p.v.endsWith(' ') ? p.v : `${p.v} `, operando: p.t === 'grega' || p.v.startsWith('\\infty') || p.v.startsWith('\\emptyset') }
    }
    if (p.t === 'cmd') {
      k++
      // LaTeX escrito à mão: segue como veio, junto com os {argumentos}.
      let tex = p.v
      while (lista[k]?.t === 'abre' && lista[k].v === '{') {
        const arg = atomo()
        tex += `{${arg.dentro ?? arg.tex}}`
      }
      return { tex: `${tex} `, operando: true }
    }
    if (p.t === 'raiz') {
      k++
      const arg = pos(atomo() ?? { tex: '' })
      return { tex: `\\sqrt${p.v ? `[${p.v}]` : ''}{${tirarParenteses(arg)}}`, operando: true }
    }
    if (p.t === 'id') {
      k++
      const v = p.v
      const minus = v.toLowerCase()
      if (minus === 'sqrt' && lista[k]?.t === 'abre') {
        const arg = atomo()
        return { tex: `\\sqrt{${tirarParenteses(arg)}}`, operando: true }
      }
      if (FUNCOES[minus]) return { tex: `${FUNCOES[minus]} `, operando: false, funcao: true }
      // xv, yv: coordenadas do vértice. x1, a2: índice. O resto: letras em itálico (produto de variáveis).
      if (/^[xy][vV]$/.test(v)) return { tex: `${v[0]}_{${v[1].toLowerCase()}}`, operando: true }
      if (v.length === 1 && lista[k]?.t === 'num' && /^\d{1,2}$/.test(lista[k].v) && lista[k + 1]?.t !== 'id') {
        const indice = lista[k].v
        k++
        return { tex: `${v}_{${indice}}`, operando: true }
      }
      return { tex: v, operando: true, letras: true }
    }
    k++
    if (p.t === 'op') return { tex: p.v, operando: false, op: true }
    if (p.t === 'fecha') return { tex: p.v === '}' ? '\\}' : p.v, operando: false }
    if (p.t === 'barra') return { tex: '/', operando: false, op: true }
    if (p.t === 'chapeu') return { tex: '\\hat{}', operando: false }
    if (p.t === 'baixo') return { tex: '\\_', operando: false }
    if (p.t === 'sup') return { tex: `^{${p.v}}`, operando: false }
    if (p.t === 'sub') return { tex: `_{${p.v}}`, operando: false }
    return { tex: p.v ?? '', operando: false }
  }

  // Potência, índice e sobrescritos depois do átomo (x², a_1, x^(n+1), 5!).
  function pos(no) {
    for (;;) {
      const p = proxima()
      if (!p) return no
      if (p.t === 'sup') {
        k++
        no = { ...no, tex: `{${no.tex}}^{${p.v}}`, grupo: false }
      }
      else if (p.t === 'sub') {
        k++
        no = { ...no, tex: `{${no.tex}}_{${p.v}}`, grupo: false }
      }
      else if ((p.t === 'chapeu' || p.t === 'baixo') && lista[k + 1]) {
        k++
        const arg = sinalEAtomo()
        const marca = p.t === 'chapeu' ? '^' : '_'
        no = { ...no, tex: `{${no.tex}}${marca}{${tirarParenteses(arg)}}`, grupo: false }
      }
      else if (p.t === 'const' && p.v.startsWith('^')) {
        k++
        no = { ...no, tex: `{${no.tex}}${p.v}`, grupo: false }
      }
      else return no
    }
  }
  // Expoente pode ter sinal: x^-1, x^(−2).
  function sinalEAtomo() {
    const p = proxima()
    if (p?.t === 'op' && (p.v === '-' || p.v === '+')) {
      k++
      const a = pos(atomo() ?? { tex: '' })
      return { tex: `${p.v}${tirarParenteses(a)}`, operando: true }
    }
    return pos(atomo() ?? { tex: '' })
  }

  // Depois da barra precisa vir algo que dá para pôr embaixo; "Δ/(" sem fecho fica como barra comum.
  function podeSerDenominador(j) {
    const p = lista[j]
    if (!p) return false
    if (['num', 'id', 'grega', 'cmd', 'raiz'].includes(p.t)) return true
    if (p.t !== 'abre') return false
    let nivel = 0
    for (let x = j; x < lista.length; x++) {
      if (lista[x].t === 'abre') nivel++
      else if (lista[x].t === 'fecha' && --nivel === 0) return true
    }
    return false
  }

  const saida = []
  while (k < lista.length) {
    const no = atomo()
    if (!no) break
    const com = no.operando ? pos(no) : no
    if (proxima()?.t === 'barra' && com.operando && podeSerDenominador(k + 1)) {
      // Fração: o numerador é o produto que vem logo antes (2a, b, (9±1)); o denominador, o próximo produto
      // sem operador no meio (2a em b/2a).
      k++
      let numerador = [com]
      while (saida.length && saida.at(-1).operando && !saida.at(-1).funcao) numerador = [saida.pop(), ...numerador]
      const den = [pos(atomo() ?? { tex: '' })]
      while (proxima() && ['num', 'id', 'grega'].includes(proxima().t) && den[0].numero && den.length < 3) den.push(pos(atomo()))
      const tx = (l) => (l.length === 1 ? tirarParenteses(l[0]) : l.map((x) => x.tex).join(''))
      saida.push({ tex: `\\frac{${tx(numerador)}}{${tx(den)}}`, operando: true })
      continue
    }
    saida.push(com)
  }
  return saida.map((x) => x.tex).join('')
}

// Expressão (sem cifrões) em LaTeX. LaTeX de verdade (com \frac) passa quase como veio.
export function paraTex(expr) {
  const s = String(expr ?? '').trim()
  if (!s) return ''
  return emPe(montar(pecas(s)).replace(/\s+/g, ' ').trim())
}
// Fração de fora (não a que está dentro de expoente ou de outra fração) fica do tamanho do texto, em pé, como no
// caderno: \dfrac. As de dentro continuam pequenas.
function emPe(tex) {
  let nivel = 0
  let saida = ''
  for (let i = 0; i < tex.length; i++) {
    const c = tex[i]
    if (c === '{') nivel++
    else if (c === '}') nivel--
    if (nivel === 0 && tex.startsWith('\\frac', i) && tex[i - 1] !== '\\') {
      saida += '\\dfrac'
      i += 4
      continue
    }
    saida += c
  }
  return saida
}

// ---------- Onde há matemática no texto ----------
const CARACTERES_MAT = /^[A-Za-z0-9ΑαβγδεθλμπρστφωΔ∆ΩΣΦΘΛΓ⁰¹²³⁴⁵⁶⁷⁸⁹⁻⁺ⁿ₀₁₂₃₄₅₆₇₈₉ₙ+\-−–×·⋅*÷/=<>≤≥≠≈≡±∓√∛∜^_()[\]{}|!%°,.'∞∅∂∇∑∏∫∈∉⊂⊆⊃⊇∪∩→⇒⇔∥⊥∠]+$/
const SINAL_FORTE = /[=<>≤≥≠≈≡±∓√∛∜⁰¹²³⁴⁵⁶⁷⁸⁹ⁿ^∞∑∏∫∈∉⊂⊆∪∩⇒⇔]/
const OPERADOR_SOLTO = /^(?:=|<|>|≤|≥|≠|≈|±|\+|-|−|–|×|·|÷|\*)$/
const RELACAO = /[=<>≤≥≠≈±]/
const COMO_CODIGO = /==|!=|\+=|-=|\*=|\/=|\+\+|--|->|=>|<=|>=|&&|\|\|/
const DATA = /^\d{1,2}\/\d{1,2}(?:\/\d{2,4})?$/
// Letras juntas aceitas numa expressão: funções, xv/yv e produtos curtos de variáveis (ac, bx, ax).
function letrasAceitas(t) {
  for (const m of t.matchAll(/[A-Za-z]{2,}/g)) {
    const w = m[0]
    if (FUNCOES[w.toLowerCase()] || w.toLowerCase() === 'sqrt' || /^[xy]v$/i.test(w)) continue
    if (w.length <= 3 && /^[abcxyzkmnpqrstuvw]+$/.test(w)) continue
    return false
  }
  return true
}
// Uma "palavra" (sem espaço) é matemática quando só tem caracteres de matemática, tem um sinal que não aparece
// em texto comum e tem algo para operar (número, letra ou letra grega).
export function palavraMatematica(p) {
  const t = String(p ?? '')
  if (t.length < 2 || !CARACTERES_MAT.test(t) || COMO_CODIGO.test(t) || DATA.test(t)) return false
  if (!/[A-Za-z0-9ΑαβγδεθλμπρστφωΔ∆ΩΣΦΘΛΓ∞]/.test(t) || !letrasAceitas(t)) return false
  if (SINAL_FORTE.test(t)) return true
  if (/\/\(|\)\//.test(t)) return true
  return RE_GREGA.test(t) && /[+\-−×·÷*/]/.test(t)
}
const ehOperando = (p) => palavraMatematica(p) || /^-?\d+(?:[.,]\d+)?$/.test(p) || /^-?\d*[A-Za-zΔπθαβ]$/.test(p) || /^[A-Za-z]\(\w\)$/.test(p) || (/^-?\d*[A-Za-z]{1,2}[²³]?$/.test(p) && letrasAceitas(p))
// Letras sozinhas que em português são palavras: só entram numa conta quando vêm junto de um sinal.
const PALAVRA_DE_UMA_LETRA = /^[aeoAEOé]$/

// Separa pontuação de fora: "(x²+1)." vira "(", "x²+1", ")." quando os parênteses não fecham dentro.
function nucleo(palavra) {
  let ini = 0
  let fim = palavra.length
  while (fim > ini && /[.,;:!?…"”’)\]]/.test(palavra[fim - 1])) {
    const c = palavra[fim - 1]
    if (c === ')' || c === ']') {
      const miolo = palavra.slice(ini, fim)
      const abre = (miolo.match(c === ')' ? /\(/g : /\[/g) ?? []).length
      const fecha = (miolo.match(c === ')' ? /\)/g : /\]/g) ?? []).length
      if (fecha <= abre) break
    }
    fim--
  }
  while (ini < fim && /["“‘(\[]/.test(palavra[ini])) {
    const c = palavra[ini]
    if (c === '(' || c === '[') {
      const miolo = palavra.slice(ini, fim)
      const abre = (miolo.match(c === '(' ? /\(/g : /\[/g) ?? []).length
      const fecha = (miolo.match(c === '(' ? /\)/g : /\]/g) ?? []).length
      if (abre <= fecha) break
    }
    ini++
  }
  return { antes: palavra.slice(0, ini), miolo: palavra.slice(ini, fim), depois: palavra.slice(fim) }
}

// Acha as expressões num texto sem cifrões. Devolve partes { tipo: 'texto' | 'mat', texto | tex, original }.
export function acharExpressoes(texto) {
  const t = String(texto ?? '')
  const tokens = t.split(/(\s+)/)
  const palavras = []
  for (let i = 0; i < tokens.length; i += 2) palavras.push({ i, ...nucleo(tokens[i] ?? '') })
  const ehMat = palavras.map((p) => !!p.miolo && palavraMatematica(p.miolo))
  // Contas com espaço: operando, sinal, operando... com pelo menos um sinal de relação ou uma palavra de matemática.
  const marcar = new Array(palavras.length).fill(false)
  let j = 0
  while (j < palavras.length) {
    const p = palavras[j]
    // Letra logo depois de um número é unidade ("2 h = 60" não é conta de h).
    const unidade = /^[A-Za-z]$/.test(p.miolo ?? '') && /^\d+(?:[.,]\d+)?$/.test(palavras[j - 1]?.miolo ?? '') && !palavras[j - 1]?.depois
    const podeComecar = !p.antes && p.miolo && ehOperando(p.miolo) && !PALAVRA_DE_UMA_LETRA.test(p.miolo)
    if (!unidade && (podeComecar || (p.miolo && ehOperando(p.miolo) && OPERADOR_SOLTO.test(palavras[j + 1]?.miolo ?? '') && !palavras[j + 1]?.antes))) {
      let fim = j
      let temRelacao = RELACAO.test(p.miolo) || ehMat[j]
      let n = j
      while (!palavras[n].depois && OPERADOR_SOLTO.test(palavras[n + 1]?.miolo ?? '') && !palavras[n + 1].antes && !palavras[n + 1].depois
        && palavras[n + 2]?.miolo && !palavras[n + 2].antes && ehOperando(palavras[n + 2].miolo)) {
        if (RELACAO.test(palavras[n + 1].miolo) || ehMat[n + 2]) temRelacao = true
        n += 2
        fim = n
      }
      if (fim > j && temRelacao) {
        for (let x = j; x <= fim; x++) marcar[x] = true
        palavras[j].grupoAte = fim
        j = fim + 1
        continue
      }
    }
    j++
  }

  const partes = []
  const texto_ = (s) => {
    if (!s) return
    if (partes.at(-1)?.tipo === 'texto') partes.at(-1).texto += s
    else partes.push({ tipo: 'texto', texto: s })
  }
  for (let x = 0; x < palavras.length; x++) {
    const p = palavras[x]
    const espaco = tokens[p.i + 1] ?? ''
    if (p.grupoAte !== undefined) {
      const fim = p.grupoAte
      const original = palavras.slice(x, fim + 1).map((w) => w.miolo).join(' ')
      texto_(p.antes)
      partes.push({ tipo: 'mat', tex: paraTex(original), original })
      texto_(palavras[fim].depois + (tokens[palavras[fim].i + 1] ?? ''))
      x = fim
      continue
    }
    if (!marcar[x] && ehMat[x]) {
      texto_(p.antes)
      partes.push({ tipo: 'mat', tex: paraTex(p.miolo), original: p.miolo })
      texto_(p.depois + espaco)
      continue
    }
    texto_(tokens[p.i] + espaco)
  }
  return partes
}

// ---------- Cifrões ----------
// Abre com $ colado no texto da conta e fecha com $ colado; "R$ 5" e "US$ 3" são dinheiro, não conta.
export function dividirMatematica(texto) {
  const t = String(texto ?? '')
  const partes = []
  const empurrarTexto = (s) => {
    for (const p of acharExpressoes(s)) {
      if (p.tipo === 'texto' && partes.at(-1)?.tipo === 'texto') partes.at(-1).texto += p.texto
      else partes.push(p)
    }
  }
  let i = 0
  let inicio = 0
  while (i < t.length) {
    const c = t[i]
    let fim = -1
    let tamanho = 0
    let bloco = false
    if (c === '$' && t[i + 1] === '$') {
      fim = t.indexOf('$$', i + 2)
      tamanho = 2
      bloco = true
    }
    else if (c === '$') {
      const antes = t[i - 1] ?? ''
      const depois = t[i + 1] ?? ''
      if (!/[A-Za-z]/.test(antes) && depois && !/\s/.test(depois) && !/\d/.test(antes)) {
        let j = i + 1
        while (j < t.length) {
          if (t[j] === '$' && !/\s/.test(t[j - 1]) && !/\d/.test(t[j + 1] ?? '') && t[j - 1] !== '\\') break
          if (t[j] === '\n' && t[j + 1] === '\n') {
            j = -1
            break
          }
          j++
        }
        if (j > 0 && j < t.length) {
          fim = j
          tamanho = 1
        }
      }
    }
    else if (c === '\\' && (t[i + 1] === '(' || t[i + 1] === '[')) {
      const fecho = t[i + 1] === '(' ? '\\)' : '\\]'
      fim = t.indexOf(fecho, i + 2)
      tamanho = 2
      bloco = t[i + 1] === '['
    }
    if (fim > i) {
      empurrarTexto(t.slice(inicio, i))
      const dentro = t.slice(i + tamanho, fim)
      if (dentro.trim()) partes.push({ tipo: 'mat', tex: paraTex(dentro), original: dentro, bloco })
      i = fim + tamanho
      inicio = i
      continue
    }
    i++
  }
  empurrarTexto(t.slice(inicio))
  return partes.filter((p) => p.tipo !== 'texto' || p.texto !== '')
}

export const temMatematica = (texto) => dividirMatematica(texto).some((p) => p.tipo === 'mat')

// Texto para lugares que não desenham matemática (título da aba, leitor de tela): tira cifrões.
export const semCifroes = (texto) => dividirMatematica(texto).map((p) => (p.tipo === 'mat' ? p.original : p.texto)).join('')

// Fórmula guardada da conferência ("xv = -b/2a"). Recusa as que saíram quebradas da leitura do PDF ("=- 2a b"):
// precisa de um lado esquerdo, um sinal e um lado direito, sem pedaços soltos separados por espaço.
export function formulaValida(termo) {
  const t = String(termo ?? '').trim().replace(/^\$|\$$/g, '')
  if (!t || t.length > 140) return false
  const m = /^([^=<>≤≥≈]+)(=|<|>|≤|≥|≈)(.+)$/.exec(t)
  if (!m) return false
  const esquerda = m[1].trim()
  const direita = m[3].trim()
  if (!esquerda || !direita || !/[A-Za-z0-9ΑαβγδεθλμπρστφωΔ∆Ω]/.test(esquerda) || /^[+\-−×·÷*/^]/.test(esquerda)) return false
  // Operandos separados só por espaço ("2a b") indicam fração desmontada.
  const juntos = (s) => s.replace(/\s*([=+\-−×·÷*/^<>≤≥≈±(),])\s*/g, '$1')
  if (/[A-Za-z0-9)]\s+[A-Za-z0-9(ΔΑαβπθ]/.test(juntos(direita)) || /[A-Za-z0-9)]\s+[A-Za-z0-9(]/.test(juntos(esquerda))) return false
  const abre = (t.match(/\(/g) ?? []).length
  return abre === (t.match(/\)/g) ?? []).length
}
