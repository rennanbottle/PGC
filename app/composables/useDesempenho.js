// Ranking: o desempenho da própria pessoa (parte "Você", desempenho_resumo) e o ranking geral por período
// (parte "Geral", ranking_periodo). As duas funções do banco estão na migração 0014.

export const DESEMPENHO_VAZIO = {
  hoje: null,
  por_dia: [],
  semanas: [],
  por_tipo: [],
  por_nivel: [],
  por_materia: [],
  sessoes: [],
  proficiencias: {},
  totais: { respondidas: 0, acerto: null, dias_estudados: 0, melhor_sequencia: 0, minutos: 0, sessoes: 0, pontos: 0 },
}

export function useDesempenho() {
  const supabase = useSupabaseClient()
  const usuario = useSupabaseUser()
  return useAsyncData('desempenho', async () => {
    if (!usuario.value) return DESEMPENHO_VAZIO
    const { data, error } = await supabase.rpc('desempenho_resumo')
    if (error) throw error
    return { ...DESEMPENHO_VAZIO, ...(data ?? {}), totais: { ...DESEMPENHO_VAZIO.totais, ...(data?.totais ?? {}) } }
  }, { default: () => DESEMPENHO_VAZIO, watch: [() => usuario.value?.sub] })
}

// periodo: ref ou getter com 'semana' | 'mes' | 'geral'. Busca de novo quando o período muda.
export function useRankingGeral(periodo) {
  const supabase = useSupabaseClient()
  const usuario = useSupabaseUser()
  return useAsyncData('ranking-geral', async () => {
    if (!usuario.value) return null
    const { data, error } = await supabase.rpc('ranking_periodo', { p_periodo: toValue(periodo) })
    if (error) throw error
    return data
  }, { default: () => null, watch: [() => toValue(periodo), () => usuario.value?.sub] })
}
