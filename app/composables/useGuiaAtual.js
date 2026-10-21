// O guia que aparece nas telas: o pronto escolhido (arquivo em public/guias) ou o próprio (baixado do Storage uma
// vez por versão). Sem conta (apresentação, entrar, cadastro), aparece o guia padrão.
import { GUIAS_PRONTOS, guiaDoPerfil } from '#shared/regras/guias.js'

export function useGuiaAtual() {
  const { data: perfil } = usePerfil()
  const supabase = useSupabaseClient()
  const proprio = useState('pgc-guia-proprio', () => ({ chave: '', url: null }))
  const escolha = computed(() => guiaDoPerfil(perfil.value))
  const chave = computed(() => (escolha.value.tipo === 'proprio' && perfil.value?.id ? `${perfil.value.id}:${perfil.value.guia_versao ?? 0}` : ''))

  if (import.meta.client) {
    watch(chave, async (c) => {
      if (!c || proprio.value.chave === c) return
      proprio.value = { chave: c, url: null }
      try {
        const url = await baixarGuia(supabase, perfil.value.id)
        if (proprio.value.chave === c) proprio.value = { chave: c, url }
      }
      catch {
        // Sem a imagem (apagada ou sem conexão): fica o guia padrão.
        if (proprio.value.chave === c) proprio.value = { chave: c, url: GUIAS_PRONTOS[0].arquivo }
      }
    }, { immediate: true })
  }

  const url = computed(() => (escolha.value.tipo === 'proprio' ? proprio.value.url : escolha.value.arquivo))
  return { escolha, url, nome: computed(() => escolha.value.nome) }
}
