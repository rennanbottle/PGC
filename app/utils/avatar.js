// Foto de perfil.
// No cadastro ainda não existe sessão (falta confirmar o e-mail), então a foto escolhida espera neste navegador
// e é enviada no primeiro acesso depois do login. Só vale para o mesmo e-mail e por 7 dias.

const CHAVE = 'pgc-avatar-pendente'
const SETE_DIAS = 7 * 24 * 60 * 60 * 1000
const normalizar = (email) => String(email ?? '').trim().toLowerCase()

export function guardarAvatarPendente(email, dataUrl) {
  try {
    localStorage.setItem(CHAVE, JSON.stringify({ email: normalizar(email), dados: dataUrl, em: Date.now() }))
  }
  catch {
    // Sem espaço ou bloqueado: a foto entra depois, pelo perfil.
  }
}

export function lerAvatarPendente(email) {
  try {
    const bruto = localStorage.getItem(CHAVE)
    if (!bruto) return null
    const pendente = JSON.parse(bruto)
    if (Date.now() - pendente.em > SETE_DIAS) {
      localStorage.removeItem(CHAVE)
      return null
    }
    return pendente.email === normalizar(email) ? pendente.dados : null
  }
  catch {
    return null
  }
}

export function limparAvatarPendente() {
  try {
    localStorage.removeItem(CHAVE)
  }
  catch {
    // Nada a fazer.
  }
}

// A pasta da pessoa é o id dela: o banco só deixa mexer na própria (migração 0003).
export async function enviarAvatar(supabase, idUsuario, blob) {
  const caminho = `${idUsuario}/avatar.jpg`
  const { error } = await supabase.storage.from('avatares').upload(caminho, blob, {
    upsert: true,
    contentType: 'image/jpeg',
    cacheControl: '3600',
  })
  if (error) throw error
  const { error: erroPerfil } = await supabase.from('perfis').update({ avatar_caminho: caminho }).eq('id', idUsuario)
  if (erroPerfil) throw erroPerfil
  return caminho
}

// O bucket é privado. A foto vem como dados da imagem (data URL), que a política de segurança do site já aceita.
export async function baixarAvatar(supabase, caminho) {
  const { data, error } = await supabase.storage.from('avatares').download(caminho)
  if (error) throw error
  return blobParaDataUrl(data)
}

export async function removerAvatar(supabase, idUsuario, caminho) {
  const { error } = await supabase.from('perfis').update({ avatar_caminho: null }).eq('id', idUsuario)
  if (error) throw error
  if (caminho) await supabase.storage.from('avatares').remove([caminho])
}
