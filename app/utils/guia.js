// Guia próprio: a imagem com as 12 expressões (sprite) fica no Storage, na pasta da pessoa (bucket privado "guias",
// migração 0017). No cadastro ainda não há sessão, então o guia criado espera neste navegador e é enviado no
// primeiro acesso depois do login (como a foto de perfil). Só vale para o mesmo e-mail e por 7 dias.

const CHAVE = 'pgc-guia-pendente'
const SETE_DIAS = 7 * 24 * 60 * 60 * 1000
const normalizar = (email) => String(email ?? '').trim().toLowerCase()

export function guardarGuiaPendente(email, dataUrl, nome) {
  try {
    localStorage.setItem(CHAVE, JSON.stringify({ email: normalizar(email), dados: dataUrl, nome: nome || null, em: Date.now() }))
    return true
  }
  catch {
    return false
  }
}

export function lerGuiaPendente(email) {
  try {
    const bruto = localStorage.getItem(CHAVE)
    if (!bruto) return null
    const pendente = JSON.parse(bruto)
    if (Date.now() - pendente.em > SETE_DIAS) {
      localStorage.removeItem(CHAVE)
      return null
    }
    return pendente.email === normalizar(email) ? pendente : null
  }
  catch {
    return null
  }
}

export function limparGuiaPendente() {
  try {
    localStorage.removeItem(CHAVE)
  }
  catch {
    // Nada a fazer.
  }
}

// Envia o sprite e marca o perfil com o guia próprio. guia_versao muda a cada envio, para as telas baixarem de novo.
export async function enviarGuia(supabase, idUsuario, blob, { nome = null, versao = 0 } = {}) {
  const { error } = await supabase.storage.from('guias').upload(`${idUsuario}/guia`, blob, {
    upsert: true,
    contentType: blob.type === 'image/png' ? 'image/png' : 'image/webp',
    cacheControl: '3600',
  })
  if (error) throw error
  const { error: erroPerfil } = await supabase.from('perfis').update({ guia: 'proprio', guia_nome: nome || null, guia_versao: (versao % 100000) + 1 }).eq('id', idUsuario)
  if (erroPerfil) throw erroPerfil
}

// O bucket é privado. A imagem vem como dados (data URL), que a política de segurança do site aceita.
export async function baixarGuia(supabase, idUsuario) {
  const { data, error } = await supabase.storage.from('guias').download(`${idUsuario}/guia`)
  if (error) throw error
  return await new Promise((resolve, reject) => {
    const leitor = new FileReader()
    leitor.onload = () => resolve(leitor.result)
    leitor.onerror = () => reject(leitor.error)
    leitor.readAsDataURL(data)
  })
}
