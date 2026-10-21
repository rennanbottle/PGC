// Agenda da pessoa logada: os itens (agenda_eventos), as revisões que vencem em cada dia (agenda_revisoes) e os
// estudos concluídos (revisoes), para os dias que já passaram. Os itens vêm todos de uma vez (o banco limita a
// 3000 por pessoa): assim o calendário troca de mês sem esperar e a prova mostra o progresso do plano.
import { datasDaSerie, diaDoInstante } from '#shared/regras/agenda.js'

const COLUNAS = 'id, tipo, titulo, data, hora, duracao_min, materia_id, assuntos, notas, concluido_em, serie, origem, plano_de, criado_em'
// Colunas que a pessoa pode mudar (as outras o banco recusa).
const EDITAVEIS = ['tipo', 'titulo', 'data', 'hora', 'duracao_min', 'materia_id', 'assuntos', 'notas', 'concluido_em', 'serie']

function traduzir(erro) {
  if (erro?.code === 'P0001') return erro.message
  if (erro?.code === '23503') return 'A matéria escolhida não existe mais. Recarregue a página.'
  if (erro?.code === '23514') return 'Algum valor não foi aceito. Confira os campos.'
  return 'Não deu para salvar agora. Confira a internet e tente de novo.'
}

const soEditaveis = (campos) => Object.fromEntries(EDITAVEIS.filter((k) => k in campos).map((k) => [k, campos[k]]))
const novoId = () => (globalThis.crypto?.randomUUID ? globalThis.crypto.randomUUID() : null)

export function useAgenda() {
  const supabase = useSupabaseClient()
  const usuario = useSupabaseUser()

  const consulta = useAsyncData(
    'agenda',
    async () => {
      if (!usuario.value) return []
      const { data, error } = await supabase.from('agenda_eventos').select(COLUNAS).order('data').limit(3000)
      if (error) throw error
      return data ?? []
    },
    { watch: [() => usuario.value?.sub], default: () => [] },
  )
  const recarregar = () => refreshNuxtData('agenda')

  async function executar(pedido) {
    const { data, error } = await pedido
    if (error) throw new Error(traduzir(error))
    return data
  }

  // Cria um item; com "repetirAte", uma linha por semana, todas com a mesma "serie".
  async function criar(evento, repetirAte = null) {
    const base = soEditaveis(evento)
    const datas = repetirAte ? datasDaSerie(evento.data, repetirAte) : [evento.data]
    const serie = datas.length > 1 ? novoId() : null
    const criados = await executar(supabase.from('agenda_eventos').insert(datas.map((data) => ({ ...base, data, serie }))).select(COLUNAS))
    await recarregar()
    return criados ?? []
  }

  // modo 'proximos' muda este e os próximos da mesma série; a data muda só neste.
  async function atualizar(evento, campos, modo = 'so') {
    const mudar = soEditaveis(campos)
    if (modo === 'proximos' && evento.serie) {
      const { data, ...comuns } = mudar
      await executar(supabase.from('agenda_eventos').update(comuns).eq('serie', evento.serie).gte('data', evento.data))
      if (data && data !== evento.data) await executar(supabase.from('agenda_eventos').update({ data }).eq('id', evento.id))
    }
    else {
      await executar(supabase.from('agenda_eventos').update(mudar).eq('id', evento.id))
    }
    await recarregar()
  }

  async function concluir(evento, sim = true) {
    await executar(supabase.from('agenda_eventos').update({ concluido_em: sim ? new Date().toISOString() : null }).eq('id', evento.id))
    await recarregar()
  }

  // Apaga e devolve as linhas apagadas, para o "Desfazer". Apagar a prova apaga o plano dela (no banco também).
  async function excluir(evento, modo = 'so') {
    const todos = consulta.data.value ?? []
    const alvo = modo === 'proximos' && evento.serie ? todos.filter((e) => e.serie === evento.serie && e.data >= evento.data) : [evento]
    const ids = alvo.map((e) => e.id)
    const plano = todos.filter((e) => e.plano_de && ids.includes(e.plano_de))
    await executar(supabase.from('agenda_eventos').delete().in('id', ids))
    await recarregar()
    return [...alvo, ...plano]
  }

  // Põe de volta o que "excluir" devolveu (provas antes do plano, que aponta para elas).
  async function restaurar(linhas) {
    const ordem = [...linhas].sort((a, b) => Number(a.origem === 'plano') - Number(b.origem === 'plano'))
    await executar(supabase.from('agenda_eventos').insert(ordem.map(({ usuario_id, atualizado_em, ...resto }) => resto)))
    await recarregar()
  }

  // Troca o plano da prova pelas sessões novas.
  async function salvarPlano(prova, sessoes) {
    await executar(supabase.from('agenda_eventos').delete().eq('plano_de', prova.id))
    if (sessoes.length) {
      await executar(supabase.from('agenda_eventos').insert(sessoes.map((s) => ({
        tipo: 'estudo', titulo: s.titulo, data: s.data, duracao_min: s.duracao_min, materia_id: prova.materia_id ?? null,
        assuntos: s.assuntos, origem: 'plano', plano_de: prova.id,
      }))))
    }
    await recarregar()
  }

  return {
    data: consulta.data,
    pending: consulta.pending,
    error: consulta.error,
    pronto: consulta,
    recarregar,
    criar,
    atualizar,
    concluir,
    excluir,
    restaurar,
    salvarPlano,
  }
}

// Revisões que vencem por dia no período (até 120 dias): { 'AAAA-MM-DD': { total, materias: [{ materia_id, n }] } }.
export function useRevisoesDaAgenda(periodo) {
  const supabase = useSupabaseClient()
  return useAsyncData(
    'agenda-revisoes',
    async () => {
      const { inicio, fim } = periodo.value
      const { data, error } = await supabase.rpc('agenda_revisoes', { p_inicio: inicio, p_fim: fim })
      if (error) throw error
      return Object.fromEntries((data ?? []).map((d) => [d.dia, d]))
    },
    { watch: [periodo], default: () => ({}) },
  )
}

// Estudos concluídos no período, por dia de Brasília: { 'AAAA-MM-DD': [{ id, total, pontos }] }.
export function useEstudosDaAgenda(periodo) {
  const supabase = useSupabaseClient()
  return useAsyncData(
    'agenda-estudos',
    async () => {
      const { inicio, fim } = periodo.value
      const { data, error } = await supabase
        .from('revisoes')
        .select('id, tipo, total, pontos, concluida_em')
        .eq('status', 'concluida')
        .gte('concluida_em', `${inicio}T00:00:00-03:00`)
        .lte('concluida_em', `${fim}T23:59:59-03:00`)
        .order('concluida_em')
      if (error) throw error
      const mapa = {}
      for (const r of data ?? []) if (r.concluida_em) (mapa[diaDoInstante(r.concluida_em)] ??= []).push(r)
      return mapa
    },
    { watch: [periodo], default: () => ({}) },
  )
}
