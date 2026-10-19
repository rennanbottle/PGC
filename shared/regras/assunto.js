// Contas da página do assunto: a linha da proficiência ao longo dos estudos, a curva de quanto a pessoa ainda lembra
// nos próximos dias, o acerto por nível de pensamento e por tipo, e o que fazer para cumprir cada critério de domínio.
// Funções puras (sem banco), com teste.
import { retencao } from './retencao.js'
import { BLOOM } from './dominio.js'
import { nomeDoTipo } from './questoes.js'

// Proficiência depois de cada estudo ou prova que teve o assunto (revisoes.resultado.assuntos, em ordem de data).
// revisoes: [{ id, concluida_em, tipo, assuntos: [{ id, depois }] }]. Devolve [{ id, data, valor, prova }].
export function linhaDeProficiencia(revisoes, assuntoId) {
  const pontos = []
  for (const r of revisoes ?? []) {
    const a = (r.assuntos ?? []).find((x) => x?.id === assuntoId)
    if (!a || a.depois === null || a.depois === undefined) continue
    pontos.push({ id: r.id, data: r.concluida_em, valor: Number(a.depois), prova: r.tipo === 'prova' })
  }
  return pontos.sort((a, b) => String(a.data).localeCompare(String(b.data)))
}

// Quanto a pessoa ainda lembra do assunto de hoje até "dias" à frente (FSRS: estabilidade S em dias, desde o último
// estudo). Devolve [{ dia, r }], com r de 0 a 1.
export function curvaDeRetencao({ estabilidade, desde = 0, dias = 30 }) {
  if (!(estabilidade > 0)) return []
  return Array.from({ length: dias + 1 }, (_, d) => ({ dia: d, r: retencao(Math.max(0, desde + d), estabilidade) }))
}

// Daqui a quantos dias a chance de lembrar cai para 90% (a revisão é marcada para esse dia). 0 = já passou.
export function diasAteRevisao({ estabilidade, desde = 0 }) {
  if (!(estabilidade > 0)) return null
  return Math.max(0, Math.round(estabilidade) - Math.floor(desde))
}

// Acerto agrupado (por nível de Bloom ou por tipo): [{ chave, rotulo, certas, parciais, erradas, total }].
// respostas: [{ bloom, tipo, resultado }]. Só os grupos que têm resposta, na ordem natural (Bloom) ou do maior total.
export function acertoAgrupado(respostas, por) {
  const grupos = new Map()
  for (const r of respostas ?? []) {
    const chave = por === 'bloom' ? Number(r.bloom) || 0 : r.tipo
    if (por === 'bloom' && !chave) continue
    const g = grupos.get(chave) ?? { chave, certas: 0, parciais: 0, erradas: 0, total: 0 }
    g.total++
    if (r.resultado === 'correta') g.certas++
    else if (r.resultado === 'parcial') g.parciais++
    else g.erradas++
    grupos.set(chave, g)
  }
  const lista = [...grupos.values()].map((g) => ({ ...g, rotulo: por === 'bloom' ? BLOOM[g.chave] ?? `Nível ${g.chave}` : nomeDoTipo(g.chave) }))
  return por === 'bloom' ? lista.sort((a, b) => a.chave - b.chave) : lista.sort((a, b) => b.total - a.total)
}

// O que fazer para cumprir cada critério de domínio (ids de dominio.js), em uma frase.
export const DICAS_CRITERIO = {
  proficiencia: 'Acerte questões mais difíceis: a nota sobe mais com elas.',
  respostas: 'Responda mais questões do assunto nos estudos.',
  dias: 'Estude o assunto em outro dia. Vários dias contam mais que um dia longo.',
  periodo: 'Volte ao assunto daqui a alguns dias: o domínio pede tempo entre o primeiro e o último estudo.',
  dificeis: 'Inclua questões de nível difícil ou acima.',
  muito_dificeis: 'Acerte, sem dica, questões de nível muito difícil.',
  bloom: 'Varie o tipo de pensamento: lembrar, entender, aplicar e analisar.',
  analisar: 'Faça questões de analisar, como encontrar o erro ou asserção e razão.',
  tipos: 'Responda tipos de questão diferentes.',
  retencao: 'Faça a revisão do dia: ela traz a lembrança de volta.',
  ultimas: 'Acerte mais nas próximas questões do assunto.',
  estabilidade: 'Evite errar três seguidas: leia a correção antes de continuar.',
  recente: 'Estude o assunto de novo: faz tempo desde o último estudo.',
  prova: 'Faça a prova de domínio quando os outros critérios estiverem cumpridos.',
}

// Assuntos relacionados: sugestões a partir do que a pessoa já tem, sem IA.
// Sinais: conceitos do material com o mesmo termo (o mais forte), o mesmo texto da Biblioteca e nomes parecidos.
// Entrada: assuntos [{ id, nome, materia_id, materia }], conceitos [{ assunto_id, termo, versao_id }],
// textos { versao_id: { id, titulo } }, relacoes [{ assunto_a, assunto_b, status }].
// Saída: { aceitos: [...], sugeridos: [...] } com { id, nome, materia, motivo, fonte } (até 4 sugeridos).
const PALAVRAS_FRACAS = new Set(['de', 'do', 'da', 'dos', 'das', 'e', 'em', 'no', 'na', 'nos', 'nas', 'a', 'o', 'as', 'os', 'com', 'para', 'por', 'um', 'uma', 'sobre', 'grau', 'parte', 'introdução', 'noções'])
const normalizarTermo = (t) => String(t ?? '').toLowerCase().normalize('NFC').replace(/\s+/g, ' ').trim()
const palavrasDoNome = (nome) => new Set(normalizarTermo(nome).split(/[^\p{L}]+/u).filter((p) => p.length >= 4 && !PALAVRAS_FRACAS.has(p)))
const listaComE = (l) => (l.length <= 1 ? l.join('') : `${l.slice(0, -1).join(', ')} e ${l.at(-1)}`)

export function sugerirRelacionados({ assuntoId, assuntos = [], conceitos = [], textos = {}, relacoes = [], maximo = 4 }) {
  const porId = Object.fromEntries(assuntos.map((a) => [a.id, a]))
  const atual = porId[assuntoId]
  if (!atual) return { aceitos: [], sugeridos: [] }
  const marcado = {}
  for (const r of relacoes) {
    const outro = r.assunto_a === assuntoId ? r.assunto_b : r.assunto_b === assuntoId ? r.assunto_a : null
    if (outro) marcado[outro] = r.status
  }
  const termosDe = {}
  const versoesDe = {}
  for (const c of conceitos) {
    const t = normalizarTermo(c.termo)
    if (t.length < 3 || !c.assunto_id) continue
    ;(termosDe[c.assunto_id] ??= new Map()).set(t, c.termo.trim())
    if (c.versao_id) (versoesDe[c.assunto_id] ??= new Set()).add(c.versao_id)
  }
  const meusTermos = termosDe[assuntoId] ?? new Map()
  const minhasVersoes = versoesDe[assuntoId] ?? new Set()
  const meuNome = palavrasDoNome(atual.nome)

  const aceitos = []
  const candidatos = []
  for (const a of assuntos) {
    if (a.id === assuntoId) continue
    const comuns = [...(termosDe[a.id] ?? new Map())].filter(([t]) => meusTermos.has(t)).map(([t]) => meusTermos.get(t))
    const versao = [...(versoesDe[a.id] ?? [])].find((v) => minhasVersoes.has(v)) ?? null
    const nomeParecido = [...palavrasDoNome(a.nome)].some((p) => meuNome.has(p))
    const motivos = []
    if (comuns.length) motivos.push(`${comuns.length === 1 ? 'Têm o conceito' : `Têm ${comuns.length} conceitos em comum:`} ${listaComE(comuns.slice(0, 3))}${comuns.length > 3 ? ' e outros' : ''}.`)
    if (versao && textos[versao]) motivos.push('Aparecem no mesmo texto da Biblioteca.')
    if (nomeParecido && !motivos.length) motivos.push('Têm nomes parecidos.')
    const item = { id: a.id, nome: a.nome, materia: a.materia ?? null, motivo: motivos.join(' '), fonte: versao ? textos[versao] ?? null : null }
    if (marcado[a.id] === 'aceito') {
      aceitos.push(item)
      continue
    }
    if (marcado[a.id] === 'recusado' || a.arquivado) continue
    const pontos = 3 * Math.min(comuns.length, 3) + (versao ? 2 : 0) + (nomeParecido ? 2 : 0)
    if (pontos >= 2) candidatos.push({ ...item, pontos })
  }
  candidatos.sort((x, y) => y.pontos - x.pontos || x.nome.localeCompare(y.nome, 'pt-BR'))
  return {
    aceitos: aceitos.sort((x, y) => x.nome.localeCompare(y.nome, 'pt-BR')),
    sugeridos: candidatos.slice(0, maximo).map(({ pontos, ...resto }) => resto),
  }
}

// O par guardado no banco: o menor id primeiro.
export const parDaRelacao = (a, b) => (a < b ? { assunto_a: a, assunto_b: b } : { assunto_a: b, assunto_b: a })
