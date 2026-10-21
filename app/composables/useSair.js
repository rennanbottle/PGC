// Sair da conta e limpar o que ficou na memória do app (perfil, foto, rascunho de cadastro).
// escopo "local": só este aparelho. "global": todos os aparelhos onde a conta está aberta.
// motivo "inatividade": a tela de entrada explica que a conta saiu sozinha. Sair pelo menu leva à apresentação (/),
// que tem o botão Entrar no topo.

export function useSair() {
  const supabase = useSupabaseClient()
  const { avatar } = useAvatarDoPerfil()

  return async function sair(escopo = 'local', { motivo } = {}) {
    await supabase.auth.signOut({ scope: escopo }).catch(() => {})
    avatar.value = null
    clearNuxtData('perfil')
    clearNuxtState(['pgc-cadastro', 'pgc-cadastro-passo'])
    await navigateTo(motivo === 'inatividade' ? '/entrar?saiu=inatividade' : '/', { replace: true })
  }
}
