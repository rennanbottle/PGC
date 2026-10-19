// Página "Gerar questões": do que estudar, quem escreve, como as questões ficam e o pedido opcional.
// Aqui ficam as regras puras (lidas pelo app e pelo servidor): os jeitos de gerar, os estilos, os tipos, a divisão por
// nível e por tipo, o corpo enviado ao servidor, a leitura da configuração e a escolha das questões sem IA.
// Nada aqui chama a rede.
import { TIPO } from './questoes.js'

// Até 20 questões por geração em todos os jeitos. A IA do PGC escreve em lotes de até 10 (uma chamada por lote).
export const MAX_GERAR = 20
export const MAX_GERAR_IA = 20
export const LOTE_IA = 10
export const QUANTIDADES_RAPIDAS = [5, 10, 15, 20]
export const MAX_INSTRUCOES = 500
export const MAX_TEXTOS = 5
export const maxQuantidade = (modo) => (modo === 'ia' || modo === 'misto' ? MAX_GERAR_IA : MAX_GERAR)

// "misto" não aparece como jeito na tela: é a IA do PGC com "Usar primeiro o que sai do texto" marcado.
export const MODOS_GERAR = [
  { id: 'local', nome: 'Do texto, sem IA', descricao: 'Lacunas, cartões e contas tiradas do próprio texto. Sai na hora e não gasta nada.', ia: false, custo: 'grátis', precisaMaterial: true },
  { id: 'ia', nome: 'IA do PGC', descricao: 'A IA escreve, e o PGC confere cada questão antes de salvar.', ia: true, custo: '1 geração do dia', precisaMaterial: false },
  { id: 'misto', nome: 'IA do PGC, começando pelo texto', descricao: 'Primeiro o que sai do texto, sem IA. A IA escreve só o que faltar.', ia: true, custo: '1 geração do dia, se faltar', precisaMaterial: true },
  { id: 'externa', nome: 'Outra IA que você usa', descricao: 'O PGC monta o pedido completo. Você cola no ChatGPT, Gemini ou Claude e traz a resposta.', ia: true, custo: 'não gasta a cota', precisaMaterial: false },
]
export const MODO_GERAR = Object.fromEntries(MODOS_GERAR.map((m) => [m.id, m]))

// Estilo da prova. "alternativas" obriga a quantidade nas questões de escolha; "tipos" é a sugestão ao escolher.
export const ESTILOS = [
  { id: 'livre', nome: 'Livre', descricao: 'Sem formato de prova. Segue só o nível e os tipos.', instrucao: '', alternativas: null, tipos: null },
  { id: 'escola', nome: 'Prova da escola', descricao: 'Linguagem simples, perguntas diretas, 4 alternativas.', instrucao: 'Estilo prova escolar: linguagem simples, perguntas diretas sobre o conteúdo e 4 alternativas.', alternativas: 4, tipos: ['multipla_escolha', 'verdadeiro_falso', 'lacuna_digitada'] },
  { id: 'enem', nome: 'Enem', descricao: 'Situação real ou texto-base, 5 alternativas.', instrucao: 'Estilo Enem: parta de uma situação real ou de um texto-base curto, cobre interpretação e aplicação (não decoreba) e use 5 alternativas.', alternativas: 5, tipos: ['texto_base', 'multipla_escolha', 'prever_resultado'] },
  { id: 'vestibular', nome: 'Vestibular', descricao: 'Enunciado direto e mais fundo, 5 alternativas.', instrucao: 'Estilo vestibular: enunciado direto, conteúdo do ensino médio com profundidade e 5 alternativas.', alternativas: 5, tipos: ['multipla_escolha', 'numerica', 'assercao_razao'] },
  { id: 'cebraspe', nome: 'Concurso (certo ou errado)', descricao: 'Itens para julgar, uma ideia por item.', instrucao: 'Estilo Cebraspe: cada item é uma afirmação para julgar como certa ou errada, com uma ideia só, e o erro, quando houver, está num detalhe que quem estudou percebe.', alternativas: null, tipos: ['certo_errado'] },
]
export const ESTILO = Object.fromEntries(ESTILOS.map((e) => [e.id, e]))

// Tipos que a IA escreve, numa lista só (na ordem da tela), e os que só saem do texto (entram no misto).
export const TIPOS_GERAR = ['multipla_escolha', 'verdadeiro_falso', 'numerica', 'texto_base', 'assercao_razao', 'certo_errado', 'multipla_resposta', 'lacuna_digitada', 'encontrar_erro', 'prever_resultado']
export const GRUPOS_TIPOS_IA = [
  { nome: 'Escolher', tipos: ['multipla_escolha', 'multipla_resposta', 'verdadeiro_falso', 'certo_errado', 'assercao_razao', 'texto_base'] },
  { nome: 'Escrever', tipos: ['numerica', 'lacuna_digitada'] },
  { nome: 'Raciocinar', tipos: ['encontrar_erro', 'prever_resultado'] },
]
export const TIPOS_SO_MATERIAL = ['cartao', 'associar', 'ordenar', 'classificar']
export const DESCRICAO_TIPO = {
  multipla_escolha: 'Quatro ou cinco alternativas, uma certa.',
  verdadeiro_falso: 'Uma afirmação para julgar, com o porquê.',
  numerica: 'A resposta é um número, com unidade.',
  texto_base: 'Um texto curto e uma pergunta sobre ele.',
  assercao_razao: 'Duas afirmações ligadas por PORQUE.',
  certo_errado: 'Item para julgar, como nos concursos.',
  multipla_resposta: 'Mais de uma alternativa certa.',
  lacuna_digitada: 'Escrever a palavra que falta na frase.',
  encontrar_erro: 'Uma resolução com um passo errado.',
  prever_resultado: 'Uma situação: o que acontece depois?',
  cartao: 'Frente e verso.',
  associar: 'Ligar termo e definição.',
  ordenar: 'Passos ou datas em ordem.',
  classificar: 'Itens em grupos.',
}
const TODOS_TIPOS = [...TIPOS_GERAR, ...TIPOS_SO_MATERIAL]

// Tipos sugeridos quando a página abre, pela área da matéria.
export function tiposPadrao(area) {
  return ['matematica', 'exatas', 'natureza', 'programacao'].includes(area)
    ? ['multipla_escolha', 'numerica', 'verdadeiro_falso', 'encontrar_erro']
    : ['multipla_escolha', 'verdadeiro_falso', 'assercao_razao', 'texto_base']
}

export const NOMES_NIVEL_PLURAL = { 1: ['fácil', 'fáceis'], 2: ['normal', 'normais'], 3: ['difícil', 'difíceis'] }

// Divide "total" em partes inteiras proporcionais aos pesos (maior resto), somando exatamente "total".
export function distribuir(total, pesos) {
  const soma = pesos.reduce((s, p) => s + Math.max(0, p), 0)
  if (!soma) return pesos.map((_, i) => (i === 0 ? total : 0))
  const brutas = pesos.map((p) => (Math.max(0, p) / soma) * total)
  const partes = brutas.map(Math.floor)
  let falta = total - partes.reduce((s, n) => s + n, 0)
  const ordem = brutas.map((b, i) => [b - Math.floor(b), i]).sort((a, b) => b[0] - a[0] || a[1] - b[1])
  for (const [, i] of ordem) {
    if (falta <= 0) break
    partes[i]++
    falta--
  }
  return partes
}

// Quantas questões de cada nível. "uma": todas no mesmo nível; "distribuir": as contas da pessoa (refeitas se não somarem).
export function niveisDoPedido(dificuldade, quantidade) {
  if (dificuldade?.modo === 'distribuir') {
    const contas = [1, 2, 3].map((n) => Math.max(0, Math.floor(Number(dificuldade.contas?.[n]) || 0)))
    const partes = contas.reduce((s, n) => s + n, 0) === quantidade ? contas : distribuir(quantidade, contas)
    return { 1: partes[0], 2: partes[1], 3: partes[2] }
  }
  const nivel = [1, 2, 3].includes(dificuldade?.nivel) ? dificuldade.nivel : 2
  return { 1: 0, 2: 0, 3: 0, [nivel]: quantidade }
}

// Quantas de cada tipo, na ordem marcada (o pedido diz isso à IA; o resumo mostra a mesma divisão).
export function tiposDoPedido(tipos, quantidade) {
  const lista = [...new Set(tipos ?? [])]
  if (!lista.length || !(quantidade > 0)) return []
  const partes = distribuir(quantidade, lista.map(() => 1))
  return lista.map((tipo, i) => ({ tipo, n: partes[i] })).filter((x) => x.n > 0)
}

export function textoNiveis(niveis) {
  const partes = [1, 2, 3].filter((n) => niveis?.[n] > 0).map((n) => `${niveis[n]} ${NOMES_NIVEL_PLURAL[n][niveis[n] === 1 ? 0 : 1]}`)
  if (!partes.length) return 'nenhuma'
  return partes.length === 1 ? partes[0] : `${partes.slice(0, -1).join(', ')} e ${partes.at(-1)}`
}

// O nível com mais questões (para quando a IA não diz o nível de uma questão).
export function nivelPrincipal(niveis) {
  return [2, 1, 3].reduce((m, n) => ((niveis?.[n] ?? 0) > (niveis?.[m] ?? 0) ? n : m), 2)
}

// Instruções da pessoa: entram no pedido como preferência, sem marcadores e com tamanho limitado.
export function limparInstrucoes(t) {
  return String(t ?? '')
    .replace(/<{2,}|>{2,}/g, '')
    .replace(/[\u0000-\u0008\u000B-\u001F]/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .slice(0, MAX_INSTRUCOES)
}

// Tempo esperado: gerar (texto curto) e estudar (minutos, ~1,2 por questão).
export function tempoEstimado(modo, quantidade) {
  const n = Math.max(0, Number(quantidade) || 0)
  const estudarMin = Math.max(1, Math.round(n * 1.2))
  if (modo === 'local') return { gerar: 'na hora', estudarMin }
  if (modo === 'externa') return { gerar: 'depende da outra IA', estudarMin }
  return { gerar: `cerca de ${Math.max(10, Math.round((8 + n * 2.5) / 5) * 5)} s`, estudarMin }
}

// Corpo enviado ao servidor a partir do estado da tela. Textos marcados viram "materiais" (o texto inteiro;
// o servidor usa só as páginas conferidas). "Usar primeiro o que sai do texto" na IA do PGC vira o modo misto.
export function corpoGerar(estado) {
  const e = estado ?? {}
  const textos = [...new Set(e.textos ?? [])].slice(0, MAX_TEXTOS)
  const modo = e.modo === 'ia' && e.aproveitarTexto && textos.length ? 'misto' : e.modo
  return {
    modo,
    materiaId: e.materiaId,
    fonte: textos.length ? 'materiais' : 'assunto',
    materiais: textos.map((id) => ({ id, de: 1, ate: 5000 })),
    assuntoIds: [...(e.assuntoIds ?? [])],
    quantidade: e.quantidade,
    dificuldade: e.dificuldade,
    estilo: e.estilo,
    tipos: [...(e.tipos ?? [])],
    tecnicas: [...(e.tecnicas ?? [])],
    instrucoes: e.instrucoes ?? '',
    semente: e.semente ?? '',
  }
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const inteiro = (v, min, max, padrao) => {
  const n = Math.floor(Number(v))
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : padrao
}

// Lê e confere a configuração enviada pela página. Devolve { config } ou { erro } com a mensagem para a pessoa.
// Sem texto e sem assunto marcado, a IA escreve sobre a matéria toda.
export function lerConfigGerar(corpo) {
  const c = corpo && typeof corpo === 'object' ? corpo : {}
  const modo = MODO_GERAR[c.modo] ? c.modo : null
  if (!modo) return { erro: 'Escolha quem escreve as questões.' }
  if (!UUID.test(c.materiaId ?? '')) return { erro: 'Escolha a matéria.' }
  const fonte = c.fonte === 'assunto' ? 'assunto' : 'materiais'
  if (fonte === 'assunto' && MODO_GERAR[modo].precisaMaterial) return { erro: 'Sem texto, só a IA consegue escrever. Escolha "IA do PGC" ou "Outra IA".' }
  const vistos = new Set()
  const materiais = (Array.isArray(c.materiais) ? c.materiais : [])
    .filter((m) => UUID.test(m?.id ?? '') && !vistos.has(m.id) && vistos.add(m.id))
    .slice(0, MAX_TEXTOS)
    .map((m) => {
      const de = inteiro(m.de, 1, 5000, 1)
      const ate = inteiro(m.ate, 1, 5000, 5000)
      return { id: m.id, de: Math.min(de, ate), ate: Math.max(de, ate) }
    })
  if (fonte === 'materiais' && !materiais.length) return { erro: 'Marque pelo menos um texto.' }
  const assuntoIds = [...new Set((Array.isArray(c.assuntoIds) ? c.assuntoIds : []).filter((x) => UUID.test(x)))].slice(0, 20)
  const maximo = maxQuantidade(modo)
  const quantidade = inteiro(c.quantidade, 1, maximo, Math.min(10, maximo))
  const estilo = ESTILO[c.estilo] ? c.estilo : 'livre'
  const tipos = [...new Set((Array.isArray(c.tipos) ? c.tipos : []).filter((t) => TODOS_TIPOS.includes(t)))]
  const tecnicas = [...new Set((Array.isArray(c.tecnicas) ? c.tecnicas : []).filter((t) => typeof t === 'string').slice(0, 10))]
  if (modo !== 'local' && !tipos.some((t) => !TIPOS_SO_MATERIAL.includes(t))) return { erro: 'Marque pelo menos um tipo de questão.' }
  return {
    config: {
      modo,
      fonte,
      materiaId: c.materiaId,
      materiais: fonte === 'materiais' ? materiais : [],
      assuntoIds,
      quantidade,
      niveis: niveisDoPedido(c.dificuldade, quantidade),
      estilo,
      tipos,
      tecnicas,
      instrucoes: limparInstrucoes(c.instrucoes),
      // Semente da tabela do gabarito em código (jeito "Outra IA"); vem da página e é igual na prévia e ao colar.
      semente: /^[a-z0-9]{6,24}$/i.test(c.semente ?? '') ? c.semente : '',
    },
  }
}

// Sem IA: até "quantidade" questões das técnicas marcadas, uma de cada técnica por vez (para variar).
// porTecnica: { lacuna: { questoes: [...] }, ... } (como sai de questoesLocais no servidor).
export function escolherLocais(porTecnica, tecnicas, quantidade) {
  const filas = (tecnicas ?? []).map((t) => [...(porTecnica?.[t]?.questoes ?? [])]).filter((f) => f.length)
  const escolhidas = []
  while (escolhidas.length < quantidade && filas.some((f) => f.length)) {
    for (const fila of filas) {
      if (escolhidas.length >= quantidade) break
      if (fila.length) escolhidas.push(fila.shift())
    }
  }
  return escolhidas
}

// Modo misto: escolhe as questões sem IA que cabem no pedido (tipo marcado e vaga no nível), variando o tipo.
// Devolve as escolhidas e quantas faltam de cada nível para a IA escrever.
export function escolherMisto(locais, niveis, tipos) {
  const faltam = { 1: niveis?.[1] ?? 0, 2: niveis?.[2] ?? 0, 3: niveis?.[3] ?? 0 }
  const porTipo = new Map()
  for (const q of locais) {
    if (!tipos.includes(q.tipo)) continue
    if (!porTipo.has(q.tipo)) porTipo.set(q.tipo, [])
    porTipo.get(q.tipo).push(q)
  }
  const filas = [...porTipo.values()]
  const escolhidas = []
  let andou = true
  while (andou) {
    andou = false
    for (const fila of filas) {
      while (fila.length) {
        const q = fila.shift()
        const n = [1, 2, 3].includes(q.nivel) ? q.nivel : 2
        if (faltam[n] > 0) {
          faltam[n]--
          escolhidas.push(q)
          andou = true
          break
        }
      }
    }
  }
  return { escolhidas, faltam }
}

export const somaNiveis = (n) => (n?.[1] ?? 0) + (n?.[2] ?? 0) + (n?.[3] ?? 0)
export const nomeDoTipoCurto = (t) => TIPO[t]?.nome ?? t

// Divide as questões pedidas por nível em lotes de até "tamanho", distribuindo cada nível entre os lotes
// (uma questão para cada lote, em rodízio). Ex.: { 1: 4, 2: 10, 3: 6 } em lotes de 10 vira dois lotes de 10.
export function dividirNiveis(niveis, tamanho = LOTE_IA) {
  const total = somaNiveis(niveis)
  const quantos = Math.max(1, Math.ceil(total / tamanho))
  const lotes = Array.from({ length: quantos }, () => ({}))
  let u = 0
  for (const [nivel, n] of Object.entries(niveis ?? {})) {
    for (let k = 0; k < n; k++) {
      const lote = lotes[u % quantos]
      lote[nivel] = (lote[nivel] ?? 0) + 1
      u += 1
    }
  }
  return lotes.filter((l) => somaNiveis(l) > 0)
}
