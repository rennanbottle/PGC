// Leitura de banco de questões importado (prova antiga, lista de exercícios ou planilha), sem IA.
// Reconhece numeração ("1.", "Questão 1"), alternativas ("a)", "(A)", "A -"), a fonte ("(UFPR 2019)")
// e o gabarito no fim ("1-C, 2-A", "01. C" ou tabela com números numa linha e letras na de baixo).
// O que não reconhece fica de fora; a pessoa confere tudo na tela de importação antes de entrar no banco.

const RE_QUESTAO = /^\s*(?:quest[ãa]o\s*(?:n[º°o.]\s*)?(\d{1,3})\b[\s.:)\-–]*|(\d{1,3})\s*(?:[.)]|\s[-–]\s|[-–](?=\s))\s*)(.*)$/i
const RE_ALTERNATIVA = /^\s*(?:\(([A-Ea-e])\)|([A-Ea-e])\s*[).]|([A-E])\s+[-–]\s)\s*(.*)$/
const RE_ALT_EM_LINHA = /(?:^|\s)\(?([a-eA-E])\)\s*/g
const RE_GABARITO_TITULO = /^\s*(gabarito|respostas|resposta das quest[õo]es)\b[^\p{L}]*$/iu
const RE_FONTE = /^\(([^()]{2,50})\)\s*/
const RE_FIGURA = /\b(figura|gr[áa]fico|imagem|esquema|ilustra[çc][ãa]o|charge|tirinha|mapa|diagrama|foto|fotografia|quadrinho|tabela)\b/i
const RE_APONTA = /\b(abaixo|acima|a seguir|ao lado|seguinte|mostrad[oa]|representad[oa]|observe|analise|indicad[oa]|apresentad[oa])\b/i
const LETRAS = ['A', 'B', 'C', 'D', 'E']

const limpar = (t) => String(t ?? '').replace(/\s+/g, ' ').trim()
const semAcento = (t) => String(t ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

// Valor do gabarito: letra, certo/errado ou verdadeiro/falso.
export function lerResposta(valor) {
  const v = semAcento(limpar(valor)).replace(/[().]/g, '')
  if (/^[a-e]$/.test(v)) return v.toUpperCase()
  if (['certo', 'certa', 'c/certo'].includes(v)) return 'CERTO'
  if (['errado', 'errada'].includes(v)) return 'ERRADO'
  if (['v', 'verdadeiro', 'verdadeira'].includes(v)) return 'V'
  if (['f', 'falso', 'falsa'].includes(v)) return 'F'
  return null
}

// Gabarito em texto: pares "1-C", "01. C", "1) C", "1 C" e tabela (números numa linha, respostas na seguinte).
export function lerGabarito(linhas) {
  const respostas = new Map()
  const textos = linhas.map(limpar).filter(Boolean)
  for (let i = 0; i < textos.length; i++) {
    const nums = textos[i].split(/[\s|;]+/)
    const prox = textos[i + 1]?.split(/[\s|;]+/)
    if (prox && nums.length >= 2 && nums.every((n) => /^\d{1,3}$/.test(n)) && prox.length === nums.length && prox.every((r) => lerResposta(r))) {
      nums.forEach((n, k) => respostas.set(Number(n), lerResposta(prox[k])))
      i++
      continue
    }
    for (const m of textos[i].matchAll(/(\d{1,3})\s*[-–.:)=]?\s*\(?(certo|errado|verdadeir[oa]|fals[oa]|[A-Ea-eVF])\)?(?![\p{L}\d])/giu)) {
      const r = lerResposta(m[2])
      if (r && !respostas.has(Number(m[1]))) respostas.set(Number(m[1]), r)
    }
  }
  return respostas
}

// Alternativas escritas na mesma linha: "a) 2   b) 4   c) 8".
function alternativasNaLinha(texto) {
  const marcas = [...texto.matchAll(RE_ALT_EM_LINHA)]
  if (marcas.length < 3) return null
  const letras = marcas.map((m) => m[1].toUpperCase())
  if (letras.some((l, i) => l !== LETRAS[i])) return null
  return marcas.map((m, i) => limpar(texto.slice(m.index + m[0].length, marcas[i + 1]?.index ?? texto.length)))
}

function montarQuestao(bloco) {
  const linhasTexto = []
  const alternativas = []
  for (const l of bloco.linhas) {
    const t = limpar(l)
    if (!t) {
      if (!alternativas.length && linhasTexto.length) linhasTexto.push('')
      continue
    }
    const naLinha = !alternativas.length ? alternativasNaLinha(t) : null
    if (naLinha) {
      alternativas.push(...naLinha)
      continue
    }
    const m = t.match(RE_ALTERNATIVA)
    const letra = m ? (m[1] || m[2] || m[3]).toUpperCase() : null
    if (m && letra === LETRAS[alternativas.length]) {
      alternativas.push(limpar(m[4]))
      continue
    }
    if (alternativas.length) alternativas[alternativas.length - 1] = limpar(`${alternativas.at(-1)} ${t}`)
    else linhasTexto.push(t)
  }
  let enunciado = linhasTexto.join('\n').replace(/([^\n])\n(?!\n)/g, '$1 ').replace(/\n{2,}/g, '\n\n').trim()
  let fonte = null
  const f = enunciado.match(RE_FONTE)
  if (f && /\p{Lu}|\d{4}/u.test(f[1])) {
    fonte = limpar(f[1])
    enunciado = enunciado.slice(f[0].length).trim()
  }
  const texto = `${enunciado} ${alternativas.join(' ')}`
  return {
    numero: bloco.numero,
    pagina: bloco.pagina,
    enunciado,
    fonte,
    alternativas: alternativas.length >= 2 ? alternativas : [],
    precisaImagem: RE_FIGURA.test(texto) && RE_APONTA.test(texto),
    trechoOriginal: bloco.original.join('\n').trim().slice(0, 6000),
  }
}

// Converte o que foi lido + a resposta do gabarito no formato da tabela de questões.
export function questaoImportada(q, resposta) {
  const base = { numero: q.numero, pagina: q.pagina, fonte: q.fonte, enunciado: q.enunciado, precisaImagem: q.precisaImagem, trechoOriginal: q.trechoOriginal, gabarito: resposta ?? null }
  if (q.alternativas.length >= 2) {
    const certa = resposta && LETRAS.includes(resposta) ? LETRAS.indexOf(resposta) : -1
    return { ...base, tipo: 'multipla_escolha', conteudo: { alternativas: q.alternativas.map((texto, i) => ({ texto, correta: i === certa })) }, gabaritoConfirmado: certa >= 0 && certa < q.alternativas.length }
  }
  if (resposta === 'CERTO' || resposta === 'ERRADO' || resposta === 'C' || resposta === 'E') {
    return { ...base, tipo: 'certo_errado', conteudo: { certo: resposta === 'CERTO' || resposta === 'C' }, gabaritoConfirmado: true }
  }
  if (resposta === 'V' || resposta === 'F') {
    return { ...base, tipo: 'verdadeiro_falso', conteudo: { verdadeira: resposta === 'V', justificativa: '' }, gabaritoConfirmado: true }
  }
  // Sem alternativas e sem gabarito: questão aberta, para resolver e comparar.
  return { ...base, tipo: 'resposta_curta', conteudo: { resposta: '', pontos: [] }, gabaritoConfirmado: false, aberta: true }
}

// Páginas lidas do arquivo ([{ numero, linhas: [{ texto }] }]) viram questões.
export function lerBancoDeTexto(paginas, { repetidas = new Set() } = {}) {
  const linhas = []
  for (const p of paginas) {
    for (const l of p.linhas) {
      const t = String(l.texto ?? '')
      // Cabeçalho e rodapé repetidos saem; alternativa e número de questão nunca (o "a) Apenas I." se repete de verdade).
      if (repetidas.has(limpar(t).toLowerCase().replace(/\d+/g, '#')) && !RE_ALTERNATIVA.test(t) && !RE_QUESTAO.test(limpar(t))) continue
      linhas.push({ texto: t, pagina: p.numero })
    }
  }
  // O gabarito fica do título "Gabarito" até o fim.
  const inicioGabarito = linhas.findIndex((l, i) => RE_GABARITO_TITULO.test(l.texto) || (/^\s*gabarito\b/i.test(l.texto) && i > linhas.length * 0.5))
  const corpo = inicioGabarito >= 0 ? linhas.slice(0, inicioGabarito) : linhas
  const respostas = inicioGabarito >= 0 ? lerGabarito(linhas.slice(inicioGabarito).map((l) => l.texto.replace(/^\s*gabarito\s*:?/i, ''))) : new Map()

  const blocos = []
  let atual = null
  for (const l of corpo) {
    const m = limpar(l.texto).match(RE_QUESTAO)
    const numero = m ? Number(m[1] ?? m[2]) : null
    const esperado = atual ? atual.numero + 1 : null
    if (m && (esperado === null ? numero <= 200 : numero === esperado)) {
      if (atual) blocos.push(atual)
      atual = { numero, pagina: l.pagina, linhas: [m[3] ?? ''], original: [l.texto] }
      continue
    }
    if (atual) {
      atual.linhas.push(l.texto)
      atual.original.push(l.texto)
    }
  }
  if (atual) blocos.push(atual)

  const questoes = blocos.map(montarQuestao).filter((q) => q.enunciado.length >= 8).map((q) => questaoImportada(q, respostas.get(q.numero)))
  return {
    questoes,
    gabaritoPagina: inicioGabarito >= 0 ? linhas[inicioGabarito].pagina : null,
    gabaritoAte: respostas.size ? Math.max(...respostas.keys()) : null,
  }
}

// ---------- Planilha (CSV ou XLSX) ----------

// CSV com aspas, separado por vírgula, ponto e vírgula ou tabulação (o Excel em português usa ponto e vírgula).
export function lerCsv(texto) {
  const t = String(texto ?? '').replace(/^﻿/, '')
  const primeira = t.split('\n')[0] ?? ''
  const separador = [';', '\t', ','].sort((a, b) => primeira.split(b).length - primeira.split(a).length)[0]
  const linhas = []
  let linha = []
  let campo = ''
  let aspas = false
  for (let i = 0; i < t.length; i++) {
    const c = t[i]
    if (aspas) {
      if (c === '"' && t[i + 1] === '"') {
        campo += '"'
        i++
      }
      else if (c === '"') aspas = false
      else campo += c
    }
    else if (c === '"') aspas = true
    else if (c === separador) {
      linha.push(campo)
      campo = ''
    }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && t[i + 1] === '\n') i++
      linha.push(campo)
      linhas.push(linha)
      linha = []
      campo = ''
    }
    else campo += c
  }
  if (campo || linha.length) {
    linha.push(campo)
    linhas.push(linha)
  }
  return linhas.filter((l) => l.some((x) => x.trim()))
}

const COLUNAS = {
  enunciado: ['enunciado', 'pergunta', 'questao', 'texto', 'comando'],
  alternativas: ['alternativas', 'opcoes'],
  gabarito: ['gabarito', 'resposta', 'correta', 'certa', 'resposta certa'],
  assunto: ['assunto', 'topico', 'tema'],
  explicacao: ['explicacao', 'comentario', 'resolucao'],
  fonte: ['fonte', 'banca', 'origem', 'prova'],
  numero: ['numero', 'n', 'no', 'num', '#'],
}
const chaveDaColuna = (nome) => semAcento(nome).replace(/[^a-z0-9# ]/g, ' ').replace(/\s+/g, ' ').trim()

// Linhas da planilha (a primeira é o cabeçalho) viram questões.
export function lerBancoDePlanilha(linhas) {
  if (linhas.length < 2) return { questoes: [], colunasFaltando: ['enunciado'] }
  const cab = linhas[0].map(chaveDaColuna)
  const achar = (nomes) => cab.findIndex((c) => nomes.includes(c))
  const col = Object.fromEntries(Object.entries(COLUNAS).map(([k, nomes]) => [k, achar(nomes)]))
  // Alternativas em colunas próprias: "a", "b", "alternativa a", "opcao_b"...
  const colAlt = LETRAS.map((l) => cab.findIndex((c) => [l.toLowerCase(), `alternativa ${l.toLowerCase()}`, `opcao ${l.toLowerCase()}`, `alt ${l.toLowerCase()}`].includes(c)))
  if (col.enunciado < 0) return { questoes: [], colunasFaltando: ['enunciado'] }
  const questoes = []
  linhas.slice(1).forEach((l, i) => {
    const pegar = (k) => (col[k] >= 0 ? limpar(l[col[k]]) : '')
    const enunciado = String(l[col.enunciado] ?? '').trim()
    if (enunciado.length < 8) return
    let alternativas = colAlt.filter((c) => c >= 0).map((c) => limpar(l[c])).filter(Boolean)
    if (!alternativas.length && col.alternativas >= 0) alternativas = String(l[col.alternativas] ?? '').split(/\s*[|\n]\s*|\s*;\s*/).map(limpar).filter(Boolean)
    let resposta = lerResposta(pegar('gabarito'))
    if (!resposta && pegar('gabarito') && alternativas.length) {
      const k = alternativas.findIndex((a) => semAcento(a) === semAcento(pegar('gabarito')))
      if (k >= 0) resposta = LETRAS[k]
    }
    const numero = Number(pegar('numero')) || i + 1
    const q = questaoImportada({
      numero,
      pagina: null,
      enunciado,
      fonte: pegar('fonte') || null,
      alternativas: alternativas.slice(0, 5),
      precisaImagem: RE_FIGURA.test(enunciado) && RE_APONTA.test(enunciado),
      trechoOriginal: l.map((x) => limpar(x)).filter(Boolean).join(' | ').slice(0, 6000),
    }, resposta)
    q.assuntoNome = pegar('assunto') || null
    q.explicacao = pegar('explicacao') || null
    questoes.push(q)
  })
  return { questoes, colunasFaltando: [] }
}

// ---------- Assunto sugerido ----------

const PARADAS = new Set('para com sem que qual quais como mais menos entre sobre este esta esse essa isso isto aquele aquela pelo pela pelos pelas quando onde cada todo toda todos todas outro outra seus suas sendo sido pode podem deve devem foram valor alternativa alternativas correta afirmativa assinale questao figura abaixo acima seguinte'.split(' '))
const raizes = (texto) => new Set((semAcento(texto).match(/[a-z]{4,}/g) ?? []).filter((p) => !PARADAS.has(p)).map((p) => p.slice(0, 6)))

// assuntos: [{ id, nome, palavras: [termos do material ligados ao assunto] }].
// Devolve { id, nome, motivo: ['abandonada', ...] } ou null. Palavras do nome do assunto valem o dobro.
export function sugerirAssunto(texto, assuntos) {
  const doTexto = raizes(texto)
  const palavrasDoTexto = semAcento(texto).match(/[a-z]{4,}/g) ?? []
  let melhor = null
  for (const a of assuntos) {
    const nome = raizes(a.nome)
    const extras = raizes((a.palavras ?? []).join(' '))
    let pontos = 0
    const motivo = new Set()
    for (const r of doTexto) {
      if (nome.has(r)) pontos += 2
      else if (extras.has(r)) pontos += 1
      else continue
      const exemplo = palavrasDoTexto.find((p) => p.startsWith(r))
      if (exemplo) motivo.add(exemplo)
    }
    if (pontos > 0 && (!melhor || pontos > melhor.pontos)) melhor = { id: a.id, nome: a.nome, pontos, motivo: [...motivo].slice(0, 3) }
  }
  return melhor
}
