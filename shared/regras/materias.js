// Matérias e assuntos: validação, contagem de estados, filtros, ordem e o caminho de cada matéria. Funções puras.
// O banco repete as validações (migração 0004): a tela avisa antes, o banco garante.
import { ESTADOS } from './dominio.js'
import { AREAS } from './perfil.js'

export const AREAS_MATERIA = [...AREAS, { id: 'outra', nome: 'Outra' }]

export const CORES = [
  { id: 'azul', nome: 'Azul' },
  { id: 'verde', nome: 'Verde' },
  { id: 'laranja', nome: 'Laranja' },
  { id: 'roxo', nome: 'Roxo' },
  { id: 'vermelho', nome: 'Vermelho' },
  { id: 'amarelo', nome: 'Amarelo' },
  { id: 'rosa', nome: 'Rosa' },
  { id: 'cinza', nome: 'Cinza' },
]

export const LIMITES = { nomeMateria: 80, nomeAssunto: 120, assuntosDeUmaVez: 50 }

// Questões no banco para liberar "Estudar esta matéria".
export const MINIMO_ESTUDO = 10

export const nomeDaArea = (id) => AREAS_MATERIA.find((a) => a.id === id)?.nome ?? 'Outra'

export function validarNome(nome, maximo) {
  const n = String(nome ?? '').trim()
  if (!n) return 'Informe o nome.'
  if ([...n].length > maximo) return `Use no máximo ${maximo} caracteres.`
  return ''
}

// "Assuntos, um por linha": tira marcadores de lista ("- ", "1. ", "2) "), linhas vazias e repetidos.
export function separarAssuntos(texto) {
  const vistos = new Set()
  const lista = []
  for (const linha of String(texto ?? '').split(/\r?\n/)) {
    const nome = [...linha.replace(/^\s*(?:[-*•]|\d+[.)])\s+/, '').trim()].slice(0, LIMITES.nomeAssunto).join('')
    if (!nome) continue
    const chave = nome.toLocaleLowerCase('pt-BR')
    if (vistos.has(chave)) continue
    vistos.add(chave)
    lista.push(nome)
  }
  return lista.slice(0, LIMITES.assuntosDeUmaVez)
}

export const assuntosAtivos = (materia) => (materia?.assuntos ?? []).filter((a) => !a.arquivado_em)
export const assuntosArquivados = (materia) => (materia?.assuntos ?? []).filter((a) => a.arquivado_em)

// Estado de cada assunto vem do motor de domínio (tabela proficiencias). Sem respostas, "não iniciado".
export const estadoDe = (assunto, estados = {}) => estados[assunto.id]?.estado ?? 'nao_iniciado'

export const ORDEM_ESTADOS = ['dominado', 'pronto_para_prova', 'proficiente', 'em_desenvolvimento', 'iniciando', 'relembrar', 'com_dificuldade', 'nao_iniciado']

// Cor do selo de cada estado (sempre com o nome do estado escrito).
export const TIPO_SELO_ESTADO = {
  dominado: 'ok',
  pronto_para_prova: 'ok',
  proficiente: 'ok',
  em_desenvolvimento: 'acento',
  iniciando: 'acento',
  relembrar: 'aviso',
  com_dificuldade: 'aviso',
  nao_iniciado: '',
}

// Quatro grupos para a barra de progresso da matéria.
export const GRUPOS_ESTADO = [
  { id: 'bem', nome: 'Bem', estados: ['dominado', 'pronto_para_prova', 'proficiente'] },
  { id: 'estudando', nome: 'Estudando', estados: ['em_desenvolvimento', 'iniciando'] },
  { id: 'atencao', nome: 'Pedem atenção', estados: ['relembrar', 'com_dificuldade'] },
  { id: 'nao_iniciado', nome: 'Não iniciados', estados: ['nao_iniciado'] },
]

export function contarEstados(assuntos, estados = {}) {
  const contagem = {}
  for (const a of assuntos) {
    const e = estadoDe(a, estados)
    contagem[e] = (contagem[e] ?? 0) + 1
  }
  return contagem
}

export function contarGrupos(assuntos, estados = {}) {
  const contagem = contarEstados(assuntos, estados)
  return Object.fromEntries(GRUPOS_ESTADO.map((g) => [g.id, g.estados.reduce((s, e) => s + (contagem[e] ?? 0), 0)]))
}

const PLURAIS = {
  nao_iniciado: 'não iniciados',
  iniciando: 'iniciando',
  com_dificuldade: 'com dificuldade',
  em_desenvolvimento: 'em desenvolvimento',
  proficiente: 'proficientes',
  pronto_para_prova: 'prontos para a prova de domínio',
  dominado: 'dominados',
  relembrar: 'precisam relembrar',
}

export function textoEstados(contagem) {
  return ORDEM_ESTADOS.filter((e) => contagem[e])
    .map((e) => `${contagem[e]} ${contagem[e] === 1 ? ESTADOS[e].toLowerCase() : PLURAIS[e]}`)
    .join(', ')
}

// Parte dos assuntos já proficientes ou acima (usada para ordenar por domínio).
function fracaoDominada(materia, estados) {
  const ativos = assuntosAtivos(materia)
  if (!ativos.length) return 0
  return contarGrupos(ativos, estados).bem / ativos.length
}

const semAcento = (t) => String(t ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()
const porNome = (a, b) => a.nome.localeCompare(b.nome, 'pt-BR', { sensitivity: 'base' })
const ORDENS = {
  manual: (a, b) => a.ordem - b.ordem || porNome(a, b),
  nome: porNome,
  atividade: (a, b) => new Date(b.atualizado_em) - new Date(a.atualizado_em) || porNome(a, b),
}

export const OPCOES_ORDEM = [
  { id: 'manual', nome: 'Sua ordem' },
  { id: 'nome', nome: 'Nome' },
  { id: 'atividade', nome: 'Mais recentes' },
  { id: 'revisar', nome: 'Mais para revisar' },
  { id: 'dominio', nome: 'Mais dominadas' },
]

// filtros: { busca, area, estado, arquivadas, ordem }. numeros: { [materiaId]: { vencidas } } (ordem "revisar").
export function filtrarMaterias(lista, filtros = {}, estados = {}, numeros = {}) {
  const { busca = '', area = '', estado = '', arquivadas = false, ordem = 'manual' } = filtros
  let resultado = (lista ?? []).filter((m) => (arquivadas ? !!m.arquivada_em : !m.arquivada_em))
  const termo = semAcento(busca)
  if (termo) {
    resultado = resultado.filter((m) => semAcento(m.nome).includes(termo) || assuntosAtivos(m).some((a) => semAcento(a.nome).includes(termo)))
  }
  if (area) resultado = resultado.filter((m) => m.area === area)
  if (estado) resultado = resultado.filter((m) => assuntosAtivos(m).some((a) => estadoDe(a, estados) === estado))
  let comparar = ORDENS[ordem] ?? ORDENS.manual
  if (ordem === 'dominio') comparar = (a, b) => fracaoDominada(b, estados) - fracaoDominada(a, estados) || porNome(a, b)
  if (ordem === 'revisar') comparar = (a, b) => (numeros[b.id]?.vencidas ?? 0) - (numeros[a.id]?.vencidas ?? 0) || ORDENS.manual(a, b)
  return [...resultado].sort(comparar)
}

// Move um id dentro da lista (para cima: passo -1; para baixo: passo 1). Devolve uma lista nova.
export function moverNaLista(ids, id, passo) {
  const i = ids.indexOf(id)
  const destino = i + passo
  if (i === -1 || destino < 0 || destino >= ids.length) return [...ids]
  const nova = [...ids]
  nova.splice(i, 1)
  nova.splice(destino, 0, id)
  return nova
}

// Cor para a próxima matéria: a primeira que ainda não está em uso (ou a menos usada).
export function proximaCor(materias = []) {
  const uso = Object.fromEntries(CORES.map((c) => [c.id, 0]))
  for (const m of materias) if (!m.arquivada_em && uso[m.cor] !== undefined) uso[m.cor]++
  return CORES.reduce((melhor, c) => (uso[c.id] < uso[melhor.id] ? c : melhor), CORES[0]).id
}

// Caminho da matéria: assuntos, textos (opcional), questões e estudar, com o estado de cada passo.
// estado: 'feito' | 'agora' (o próximo a fazer) | 'depois' | 'opcional'.
export function passosDaMateria({ assuntos = 0, textos = 0, noBanco = 0 } = {}) {
  const temAssuntos = assuntos > 0
  const temQuestoes = noBanco >= MINIMO_ESTUDO
  const passos = [
    { id: 'assuntos', estado: temAssuntos ? 'feito' : 'agora' },
    { id: 'textos', estado: textos > 0 ? 'feito' : 'opcional' },
    { id: 'questoes', estado: temQuestoes ? 'feito' : temAssuntos ? 'agora' : 'depois' },
    { id: 'estudar', estado: temQuestoes ? 'agora' : 'depois' },
  ]
  return passos
}

// O que falta para estudar a matéria, em frase curta (vazio quando já dá).
export function faltaParaEstudar(noBanco = 0) {
  const falta = MINIMO_ESTUDO - noBanco
  if (falta <= 0) return ''
  return falta === 1 ? 'Falta 1 questão no banco desta matéria.' : `Faltam ${falta} questões no banco desta matéria.`
}

// Situação curta de cada matéria na lista: o próximo passo ou o que vence hoje.
export function situacaoDaMateria({ assuntos = 0, questoes = 0, vencidas = 0 } = {}) {
  if (!assuntos) return { id: 'sem_assuntos', texto: 'Sem assuntos', tipo: 'aviso' }
  if (!questoes) return { id: 'sem_questoes', texto: 'Sem questões', tipo: '' }
  if (vencidas > 0) return { id: 'revisar', texto: vencidas === 1 ? '1 para revisar' : `${vencidas} para revisar`, tipo: 'acento' }
  return { id: 'em_dia', texto: 'Em dia', tipo: 'ok' }
}
