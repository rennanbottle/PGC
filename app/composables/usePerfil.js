// Perfil da pessoa logada, num lugar só: o menu, o cabeçalho, o início e o perfil leem daqui.
// Mesma chave em todos ("perfil"), então o Nuxt busca uma vez e compartilha.
// O banco (RLS) só devolve a linha da própria pessoa, por isso não precisa filtrar pelo id.

export const COLUNAS_PERFIL = 'id, nome_exibicao, apelido, avatar_caminho, ritmo, ritmo_trocado_em, objetivo, areas_interesse, movimento_reduzido, sair_inativo_min, ia_permitida_padrao, ranking_participa, paleta, nivel_na_questao, guia, guia_nome, guia_versao'

export function usePerfil() {
  const supabase = useSupabaseClient()
  const usuario = useSupabaseUser()
  return useAsyncData(
    'perfil',
    async () => {
      if (!usuario.value) return null
      const { data, error } = await supabase.from('perfis').select(COLUNAS_PERFIL).maybeSingle()
      if (error) throw error
      return data
    },
    { watch: [() => usuario.value?.sub] },
  )
}
