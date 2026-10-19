// Uma questão durante a revisão: o que vai para a tela, como corrigir e as dicas em degraus.
// O servidor guarda a questão inteira e uma "semente" por item. Com a mesma semente, servidor e tela embaralham do
// mesmo jeito: a tela recebe só as posições (sem gabarito, sem explicação, sem o erro de cada alternativa) e o
// servidor corrige refazendo o embaralhamento. Funções puras, sem rede.
import { LETRAS, OPCOES_ASSERCAO, RE_LACUNA, TIPOS_ESCOLHA } from './questoes.js'

export const TIPOS_ALTERNATIVAS = [...TIPOS_ESCOLHA, 'multipla_resposta']
// Tipos corrigidos pela própria pessoa: primeiro escreve, depois vê a resposta e se avalia.
export const TIPOS_AUTOAVALIACAO = ['cartao', 'resposta_curta', 'explicar']
// Resposta curta e explicar: autoavaliação não conta pontos nem proficiência (correção com confiança baixa).
export const TIPOS_CONFIANCA_BAIXA = ['resposta_curta', 'explicar']

// Gerador de números com semente (mulberry32 sobre um hash do texto).
export function sorteador(semente) {
  let h = 1779033703
  for (const ch of String(semente)) h = Math.imul(h ^ ch.charCodeAt(0), 3432918353) ^ (h >>> 13)
  let a = h >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// Índices 0..n-1 embaralhados. "evitarIdentidade": nunca devolve a ordem original (para ordenar).
export function permutacao(n, rng, evitarIdentidade = false) {
  const p = Array.from({ length: n }, (_, i) => i)
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[p[i], p[j]] = [p[j], p[i]]
  }
  if (evitarIdentidade && n > 1 && p.every((v, i) => v === i)) [p[0], p[1]] = [p[1], p[0]]
  return p
}

const lista = (v) => (Array.isArray(v) ? v : [])

// Ordem de exibição de cada parte embaralhável. Sempre na mesma sequência de sorteios.
function ordens(q, semente) {
  const rng = sorteador(semente)
  const c = q.conteudo ?? {}
  const o = {}
  if (TIPOS_ALTERNATIVAS.includes(q.tipo)) o.alternativas = permutacao(lista(c.alternativas).length, rng)
  if (q.tipo === 'lacuna_opcoes') o.lacunas = lista(c.lacunas).map((l) => permutacao(lista(l.opcoes).length, rng))
  if (q.tipo === 'associar') o.direita = permutacao(lista(c.pares).length, rng, true)
  if (q.tipo === 'ordenar') o.itens = permutacao(lista(c.itens).length, rng, true)
  if (q.tipo === 'classificar') o.itens = permutacao(itensClassificar(c).length, rng)
  return o
}
const itensClassificar = (c) => lista(c.grupos).flatMap((g, gi) => lista(g.itens).filter((t) => String(t).trim()).map((texto) => ({ texto, grupo: gi })))

// O que a tela recebe para responder: nada que entregue a resposta.
export function paraResponder(q, semente) {
  const c = q.conteudo ?? {}
  const o = ordens(q, semente)
  const base = { tipo: q.tipo, enunciado: q.enunciado }
  switch (q.tipo) {
    case 'multipla_escolha':
    case 'prever_resultado':
    case 'multipla_resposta':
    case 'texto_base':
      return {
        ...base,
        ...(q.tipo === 'texto_base' ? { textoBase: c.textoBase ?? '' } : {}),
        alternativas: o.alternativas.map((i) => c.alternativas[i].texto),
      }
    case 'verdadeiro_falso':
      return { ...base, pedeJustificativa: true }
    case 'certo_errado':
      return base
    case 'assercao_razao':
      return { ...base, assercao: c.assercao, razao: c.razao, opcoes: OPCOES_ASSERCAO }
    case 'lacuna_opcoes':
      return { ...base, lacunas: lista(c.lacunas).map((l, k) => o.lacunas[k].map((i) => l.opcoes[i])) }
    case 'lacuna_digitada':
      return { ...base, lacunas: lista(c.lacunas).length }
    case 'associar':
      return { ...base, esquerda: lista(c.pares).map((p) => p.a), direita: o.direita.map((i) => c.pares[i].b) }
    case 'ordenar':
      return { ...base, itens: o.itens.map((i) => c.itens[i]) }
    case 'classificar': {
      const itens = itensClassificar(c)
      return { ...base, grupos: lista(c.grupos).map((g) => g.nome), itens: o.itens.map((i) => itens[i].texto) }
    }
    case 'numerica':
      return { ...base, unidade: c.unidade ?? '', rotulo: rotuloNumerico(q), campos: camposNumericos(c) }
    case 'encontrar_erro':
      return { ...base, linhas: lista(c.linhas) }
    case 'cartao':
    case 'resposta_curta':
    case 'explicar':
      return base
    default:
      return base
  }
}

// ---------- Resposta numérica com rótulo ----------
// O que se calcula aparece antes do campo ("x_v ="). Vem da questão ou, nas antigas, do enunciado (xv, yv, Δ).
export function rotuloNumerico(q) {
  const c = q?.conteudo ?? {}
  if (String(c.rotulo ?? '').trim()) return String(c.rotulo).trim().slice(0, 20)
  if (lista(c.respostas).length) return ''
  const e = String(q?.enunciado ?? '')
  const achados = new Set()
  for (const m of e.matchAll(/(?:^|[^A-Za-z])([xy])\s?_?\{?[vV]\}?(?![A-Za-z])/g)) achados.add(`${m[1].toLowerCase()}_v`)
  if (/[Δ∆]|\bdelta\b|\bdiscriminante\b/i.test(e)) achados.add('Δ')
  return achados.size === 1 ? [...achados][0] : ''
}
// Mais de um número na resposta (as duas raízes): um campo para cada, com o rótulo (x_1, x_2).
export function camposNumericos(c) {
  const r = lista(c?.respostas)
  return r.length >= 2 ? r.slice(0, 4).map((x, i) => String(x?.rotulo ?? '').trim().slice(0, 12) || `x_${i + 1}`) : null
}

// ---------- Correção ----------
export function normalizarTexto(t) {
  return String(t ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim().replace(/[.;:!?]+$/g, '').trim()
}
// Para conta digitada: x² e x^2 valem igual, sinal de menos de qualquer tipo, vezes de qualquer tipo, sem espaços.
const SOBRE = { '⁰': '0', '¹': '1', '²': '2', '³': '3', '⁴': '4', '⁵': '5', '⁶': '6', '⁷': '7', '⁸': '8', '⁹': '9' }
const SUB = { '₀': '0', '₁': '1', '₂': '2', '₃': '3', '₄': '4', '₅': '5', '₆': '6', '₇': '7', '₈': '8', '₉': '9' }
export function normalizarConta(t) {
  return normalizarTexto(t)
    .replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹]+/g, (m) => `^${[...m].map((c) => SOBRE[c]).join('')}`)
    .replace(/[₀₁₂₃₄₅₆₇₈₉]+/g, (m) => [...m].map((c) => SUB[c]).join(''))
    .replace(/[−–]/g, '-').replace(/[×·⋅]/g, '*').replace(/\$/g, '').replace(/\s+/g, '')
}
export function lerNumero(v) {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null
  let t = String(v ?? '').trim().replace(/\s+/g, '').replace(/[−–]/g, '-')
  if (!t) return null
  if (t.includes(',')) t = t.replace(/\./g, '').replace(',', '.')
  const n = Number(t)
  return Number.isFinite(n) ? n : null
}
export function dentroDaTolerancia(valor, certo, tolerancia = 1) {
  if (valor === null || certo === null || certo === undefined) return false
  const margem = Math.abs(Number(certo)) * (Number(tolerancia) || 0) / 100
  return Math.abs(valor - certo) <= Math.max(margem, 1e-9)
}
const porFracao = (f) => (f >= 0.999 ? 'correta' : f >= 0.5 ? 'parcial' : 'incorreta')
const creditoDe = (r) => (r === 'correta' ? 1 : r === 'parcial' ? 0.5 : 0)
const fim = (resultado, detalhe = {}, extra = {}) => ({ resultado, credito: creditoDe(resultado), confianca: 'alta', detalhe, ...extra })

// Corrige a resposta. Devolve { resultado, credito, confianca, detalhe } ou { pendente: true, revelar } quando a
// pessoa ainda precisa se avaliar (cartão, resposta curta, explicar).
export function corrigir(q, semente, resposta) {
  const c = q.conteudo ?? {}
  const r = resposta && typeof resposta === 'object' ? resposta : {}
  const o = ordens(q, semente)
  switch (q.tipo) {
    case 'multipla_escolha':
    case 'prever_resultado':
    case 'texto_base': {
      const pos = Number(r.escolha)
      const orig = o.alternativas[pos]
      const certa = o.alternativas.findIndex((i) => c.alternativas[i]?.correta)
      if (orig === undefined) return fim('incorreta', { certa, escolhida: null })
      return fim(c.alternativas[orig].correta ? 'correta' : 'incorreta', { certa, escolhida: pos, erro: c.alternativas[orig].correta ? null : c.alternativas[orig].erro || null })
    }
    case 'multipla_resposta': {
      const marcadas = new Set(lista(r.marcadas).map(Number).filter((p) => o.alternativas[p] !== undefined))
      const certas = o.alternativas.map((i, p) => (c.alternativas[i].correta ? p : -1)).filter((p) => p >= 0)
      const acertos = [...marcadas].filter((p) => certas.includes(p)).length
      const errados = marcadas.size - acertos
      const f = certas.length ? Math.max(0, (acertos - errados) / certas.length) : 0
      return fim(porFracao(f), { certas, marcadas: [...marcadas].sort((a, b) => a - b) })
    }
    case 'verdadeiro_falso':
      return fim(r.valor === !!c.verdadeira ? 'correta' : 'incorreta', { certa: !!c.verdadeira, escolhida: r.valor ?? null, justificativa: c.justificativa || null })
    case 'certo_errado':
      return fim(r.valor === !!c.certo ? 'correta' : 'incorreta', { certa: !!c.certo, escolhida: r.valor ?? null })
    case 'assercao_razao':
      return fim(r.opcao === c.resposta ? 'correta' : 'incorreta', { certa: c.resposta, escolhida: r.opcao ?? null })
    case 'lacuna_opcoes': {
      const ls = lista(c.lacunas)
      const certas = ls.map((l, k) => o.lacunas[k].indexOf(l.certa ?? 0))
      const esc = lista(r.escolhas).map(Number)
      const ok = certas.filter((p, k) => esc[k] === p).length
      return fim(porFracao(ls.length ? ok / ls.length : 0), { certas, escolhas: esc })
    }
    case 'lacuna_digitada': {
      const ls = lista(c.lacunas)
      const textos = lista(r.textos)
      const acertos = ls.map((l, k) => lista(l.respostas).some((a) => normalizarTexto(a) === normalizarTexto(textos[k]) || (String(textos[k] ?? '').trim() !== '' && normalizarConta(a) === normalizarConta(textos[k]))))
      return fim(porFracao(ls.length ? acertos.filter(Boolean).length / ls.length : 0), { acertos, aceitas: ls.map((l) => lista(l.respostas)) })
    }
    case 'associar': {
      const n = lista(c.pares).length
      const ligacoes = r.ligacoes && typeof r.ligacoes === 'object' ? r.ligacoes : {}
      const certas = Array.from({ length: n }, (_, i) => o.direita.indexOf(i))
      const ok = certas.filter((p, i) => Number(ligacoes[i]) === p).length
      return fim(porFracao(n ? ok / n : 0), { certas })
    }
    case 'ordenar': {
      const n = lista(c.itens).length
      const ordem = lista(r.ordem).map(Number)
      const certa = Array.from({ length: n }, (_, i) => o.itens.indexOf(i))
      const ok = certa.filter((p, i) => ordem[i] === p).length
      return fim(porFracao(n ? ok / n : 0), { certa })
    }
    case 'classificar': {
      const itens = itensClassificar(c)
      const grupos = r.grupos && typeof r.grupos === 'object' ? r.grupos : {}
      const certos = o.itens.map((i) => itens[i].grupo)
      const ok = certos.filter((g, p) => Number(grupos[p]) === g).length
      return fim(porFracao(itens.length ? ok / itens.length : 0), { certos })
    }
    case 'numerica': {
      const varios = lista(c.respostas).slice(0, 4)
      if (varios.length >= 2) {
        // Em qualquer ordem: cada número certo casa com um que a pessoa escreveu.
        const lidos = lista(r.valores).slice(0, 4).map(lerNumero)
        const usados = new Set()
        let ok = 0
        for (const certo of varios) {
          const k = lidos.findIndex((v, i) => !usados.has(i) && dentroDaTolerancia(v, certo?.valor, c.tolerancia))
          if (k >= 0) {
            usados.add(k)
            ok++
          }
        }
        return fim(porFracao(ok / varios.length), { certas: varios.map((x) => x?.valor), rotulos: camposNumericos(c), unidade: c.unidade ?? '', tolerancia: Number(c.tolerancia) || 0, lidos })
      }
      const v = lerNumero(r.valor)
      return fim(dentroDaTolerancia(v, c.resposta, c.tolerancia) ? 'correta' : 'incorreta', { certa: c.resposta, unidade: c.unidade ?? '', lido: v })
    }
    case 'encontrar_erro':
      return fim(Number(r.linha) === Number(c.errada) ? 'correta' : 'incorreta', { certa: Number(c.errada), escolhida: r.linha ?? null, correcao: c.correcao || null })
    case 'cartao': {
      const revelar = { verso: c.verso ?? '' }
      const nota = { sabia: 'correta', quase: 'parcial', nao: 'incorreta' }[r.autoavaliacao]
      if (!nota) return { pendente: true, revelar }
      return fim(nota, revelar)
    }
    case 'resposta_curta':
    case 'explicar': {
      const pontos = lista(c.pontos).filter((p) => String(p).trim())
      const revelar = { resposta: c.resposta ?? '', pontos }
      if (!Array.isArray(r.pontos)) return { pendente: true, revelar }
      const marcados = pontos.filter((_, i) => r.pontos[i] === true).length
      const f = pontos.length ? marcados / pontos.length : r.pontos[0] === true ? 1 : 0
      return fim(porFracao(f), revelar, { confianca: 'baixa' })
    }
    default:
      return fim('incorreta')
  }
}

// ---------- Dicas em degraus ----------
// Primeiro degrau: o trecho do material, quando a questão saiu de um. Depois, dicas do próprio tipo que estreitam
// o caminho sem entregar a resposta (tirar alternativas, mostrar o começo da palavra, fixar um item).
// Cada degrau tira 25% do crédito. Fácil tem até 3 degraus, Normal 2, Difícil 1; Muito difícil e Desafio extremo, nenhum.
export const maxDicasDoNivel = (nivel) => (nivel <= 1 ? 3 : nivel === 2 ? 2 : nivel === 3 ? 1 : 0)

export function dicas(q, semente, { trecho = null } = {}) {
  const c = q.conteudo ?? {}
  const o = ordens(q, semente)
  const saida = []
  if (trecho?.texto) saida.push({ texto: `No material${trecho.pagina ? `, página ${trecho.pagina}` : ''}: "${String(trecho.texto).slice(0, 400)}"` })
  const rng = sorteador(`${semente}:dica`)
  switch (q.tipo) {
    case 'multipla_escolha':
    case 'prever_resultado':
    case 'texto_base': {
      const erradas = o.alternativas.map((i, p) => (c.alternativas[i].correta ? -1 : p)).filter((p) => p >= 0)
      const ordem = permutacao(erradas.length, rng).map((i) => erradas[i])
      const tirar = []
      for (let k = 0; k < Math.min(2, erradas.length - 1); k++) {
        tirar.push(ordem[k])
        saida.push({ texto: `Não é a ${LETRAS[ordem[k]]}.`, eliminar: [...tirar] })
      }
      break
    }
    case 'multipla_resposta': {
      const n = c.alternativas.filter((a) => a.correta).length
      saida.push({ texto: `São ${n} alternativas certas.` })
      const erradas = o.alternativas.map((i, p) => (c.alternativas[i].correta ? -1 : p)).filter((p) => p >= 0)
      if (erradas.length) saida.push({ texto: `A ${LETRAS[erradas[0]]} está errada.`, eliminar: [erradas[0]] })
      break
    }
    case 'assercao_razao': {
      const verdadeiraI = ['a', 'b', 'c'].includes(c.resposta)
      const verdadeiraII = ['a', 'b', 'd'].includes(c.resposta)
      saida.push({ texto: `A primeira afirmação é ${verdadeiraI ? 'verdadeira' : 'falsa'}.` })
      saida.push({ texto: `A segunda afirmação é ${verdadeiraII ? 'verdadeira' : 'falsa'}.` })
      break
    }
    case 'lacuna_digitada': {
      const primeira = String(lista(c.lacunas)[0]?.respostas?.[0] ?? '')
      if (primeira) {
        saida.push({ texto: `A primeira lacuna tem ${primeira.replace(/\s/g, '').length} letras.` })
        saida.push({ texto: `Começa com "${primeira.slice(0, Math.max(1, Math.floor(primeira.length / 3)))}".` })
      }
      break
    }
    case 'lacuna_opcoes': {
      const l = lista(c.lacunas)[0]
      if (l) {
        const errada = o.lacunas[0].findIndex((i) => i !== (l.certa ?? 0))
        if (errada >= 0) saida.push({ texto: `Na primeira lacuna, não é "${l.opcoes[o.lacunas[0][errada]]}".` })
      }
      break
    }
    case 'numerica': {
      const r = Number(c.resposta)
      if (Number.isFinite(r) && r !== 0) {
        const ordem = Math.floor(Math.log10(Math.abs(r)))
        const de = 10 ** ordem
        const fmt = (n) => n.toLocaleString('pt-BR', { maximumFractionDigits: 4 })
        saida.push({ texto: `A resposta ${r < 0 ? 'é negativa e ' : ''}fica entre ${fmt(r < 0 ? -de * 10 : de)} e ${fmt(r < 0 ? -de : de * 10)}${c.unidade ? `, em ${c.unidade}` : ''}.` })
      }
      break
    }
    case 'encontrar_erro': {
      const n = lista(c.linhas).length
      const e = Number(c.errada)
      if (n > 2) {
        const metade = e < n / 2 ? [1, Math.ceil(n / 2)] : [Math.floor(n / 2) + 1, n]
        saida.push({ texto: `O passo errado está entre o ${metade[0]} e o ${metade[1]}.` })
      }
      break
    }
    case 'ordenar': {
      const itens = lista(c.itens)
      if (itens.length > 2) {
        saida.push({ texto: `O primeiro é "${itens[0]}".` })
        saida.push({ texto: `O último é "${itens.at(-1)}".` })
      }
      break
    }
    case 'associar': {
      const pares = lista(c.pares)
      pares.slice(0, 2).forEach((p) => saida.push({ texto: `"${p.a}" vai com "${p.b}".` }))
      break
    }
    case 'classificar': {
      const itens = itensClassificar(c)
      const g = lista(c.grupos)
      itens.slice(0, 2).forEach((it) => saida.push({ texto: `"${it.texto}" fica em ${g[it.grupo]?.nome || `grupo ${it.grupo + 1}`}.` }))
      break
    }
    case 'resposta_curta':
    case 'explicar': {
      const p = lista(c.pontos).find((x) => String(x).trim())
      if (p) saida.push({ texto: `Um ponto que a resposta precisa ter: ${p}.` })
      break
    }
    default:
      break
  }
  return saida.slice(0, 3)
}

// ---------- Textos da correção ----------
// A resposta certa e a da pessoa em texto curto, para a lista de correções do resultado.
export function textoDaCerta(q, semente) {
  const c = q.conteudo ?? {}
  const o = ordens(q, semente)
  switch (q.tipo) {
    case 'multipla_escolha':
    case 'prever_resultado':
    case 'texto_base': {
      const p = o.alternativas.findIndex((i) => c.alternativas[i]?.correta)
      return p >= 0 ? `${LETRAS[p]}, ${c.alternativas[o.alternativas[p]].texto}` : ''
    }
    case 'multipla_resposta':
      return o.alternativas.map((i, p) => (c.alternativas[i].correta ? LETRAS[p] : null)).filter(Boolean).join(', ')
    case 'verdadeiro_falso':
      return c.verdadeira ? 'Verdadeira' : 'Falsa'
    case 'certo_errado':
      return c.certo ? 'Certo' : 'Errado'
    case 'assercao_razao':
      return OPCOES_ASSERCAO.find((x) => x.id === c.resposta)?.texto ?? ''
    case 'lacuna_opcoes':
      return lista(c.lacunas).map((l) => l.opcoes?.[l.certa ?? 0]).join('; ')
    case 'lacuna_digitada':
      return lista(c.lacunas).map((l) => l.respostas?.[0] ?? '').join('; ')
    case 'associar':
      return lista(c.pares).map((p) => `${p.a}: ${p.b}`).join('; ')
    case 'ordenar':
      return lista(c.itens).join(', ')
    case 'classificar':
      return lista(c.grupos).map((g) => `${g.nome}: ${lista(g.itens).join(', ')}`).join('; ')
    case 'numerica': {
      const numero = (n) => Number(n).toLocaleString('pt-BR', { maximumFractionDigits: 4 })
      const campos = camposNumericos(c)
      if (campos) return lista(c.respostas).slice(0, 4).map((x, i) => `$${campos[i]}$ = ${numero(x?.valor)}`).join('; ') + (c.unidade ? ` ${c.unidade}` : '')
      const rotulo = rotuloNumerico(q)
      return `${rotulo ? `$${rotulo}$ = ` : ''}${numero(c.resposta)}${c.unidade ? ` ${c.unidade}` : ''}`
    }
    case 'encontrar_erro':
      return `Passo ${Number(c.errada) + 1}${c.correcao ? `: ${c.correcao}` : ''}`
    case 'cartao':
      return c.verso ?? ''
    default:
      return c.resposta ?? ''
  }
}

export function textoDaResposta(q, semente, resposta) {
  const r = resposta ?? {}
  const v = paraResponder(q, semente)
  switch (q.tipo) {
    case 'multipla_escolha':
    case 'prever_resultado':
    case 'texto_base':
      return r.escolha === undefined || r.escolha === null ? 'em branco' : `${LETRAS[r.escolha]}, ${v.alternativas[r.escolha] ?? ''}`
    case 'multipla_resposta':
      return lista(r.marcadas).length ? lista(r.marcadas).map((p) => LETRAS[p]).join(', ') : 'em branco'
    case 'verdadeiro_falso':
      return r.valor === undefined || r.valor === null ? 'em branco' : r.valor ? 'Verdadeira' : 'Falsa'
    case 'certo_errado':
      return r.valor === undefined || r.valor === null ? 'em branco' : r.valor ? 'Certo' : 'Errado'
    case 'assercao_razao':
      return OPCOES_ASSERCAO.find((x) => x.id === r.opcao)?.texto ?? 'em branco'
    case 'lacuna_opcoes':
      return lista(r.escolhas).map((p, k) => v.lacunas[k]?.[p] ?? '').join('; ') || 'em branco'
    case 'lacuna_digitada':
      return lista(r.textos).join('; ') || 'em branco'
    case 'numerica':
      if (v.campos) return lista(r.valores).some((x) => String(x ?? '').trim()) ? v.campos.map((rot, i) => `$${rot}$ = ${String(r.valores?.[i] ?? '').trim() || '?'}`).join('; ') : 'em branco'
      return r.valor === undefined || r.valor === '' ? 'em branco' : `${v.rotulo ? `$${v.rotulo}$ = ` : ''}${r.valor}${v.unidade ? ` ${v.unidade}` : ''}`
    case 'encontrar_erro':
      return r.linha === undefined || r.linha === null ? 'em branco' : `Passo ${Number(r.linha) + 1}`
    case 'cartao':
    case 'resposta_curta':
    case 'explicar':
      return String(r.texto ?? '').trim() || 'em branco'
    default:
      return 'respondida'
  }
}

// Lacunas do enunciado como partes de texto e posições de campo, para a tela montar.
export function partesComLacunas(enunciado) {
  const partes = String(enunciado ?? '').split(RE_LACUNA)
  return partes.flatMap((t, i) => (i < partes.length - 1 ? [{ texto: t }, { lacuna: i }] : [{ texto: t }]))
}
