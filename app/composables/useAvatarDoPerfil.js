// Entrega a foto da pessoa logada, já pronta para mostrar. Se existe uma foto esperando do cadastro, envia agora.
// Chamar no navegador (onMounted) com a linha do perfil.

export function useAvatarDoPerfil() {
  const supabase = useSupabaseClient()
  const usuario = useSupabaseUser()
  const avatar = useState('pgc-avatar', () => null)

  async function carregar(perfil) {
    if (!perfil) return
    let caminho = perfil.avatar_caminho
    if (!caminho && usuario.value?.sub) {
      const pendente = lerAvatarPendente(usuario.value.email)
      if (pendente) {
        try {
          caminho = await enviarAvatar(supabase, usuario.value.sub, dataUrlParaBlob(pendente))
          limparAvatarPendente()
        }
        catch {
          // Tenta de novo no próximo acesso.
        }
      }
    }
    if (!caminho) {
      avatar.value = null
      return
    }
    try {
      avatar.value = await baixarAvatar(supabase, caminho)
    }
    catch {
      avatar.value = null
    }
  }

  return { avatar, carregar }
}
