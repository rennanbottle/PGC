// Chaves do servidor (arquivo .env). Mensagens e terminal mostram só os nomes, nunca os valores.

const chaveSecreta = () => String(process.env.SUPABASE_SECRET_KEY || process.env.NUXT_SUPABASE_SECRET_KEY || '').trim()
const chavePublica = () => String(process.env.SUPABASE_KEY || process.env.NUXT_PUBLIC_SUPABASE_KEY || '').trim()

// Papel da chave sem mostrar a chave: as novas dizem no começo (sb_secret_, sb_publishable_); as antigas são JWT e
// trazem o papel dentro (anon ou service_role).
function papelDaChave(chave) {
  if (chave.startsWith('sb_secret_')) return 'service_role'
  if (chave.startsWith('sb_publishable_')) return 'anon'
  const partes = chave.split('.')
  if (partes.length !== 3) return ''
  try {
    return String(JSON.parse(Buffer.from(partes[1], 'base64url').toString('utf8')).role ?? '')
  }
  catch {
    return ''
  }
}

// '' (tudo certo), 'falta' ou 'publica' (colaram a chave pública no lugar da secreta).
export function problemaDaChaveSecreta() {
  const chave = chaveSecreta()
  if (!chave) return 'falta'
  const papel = papelDaChave(chave)
  if (chave === chavePublica() || papel === 'anon' || papel === 'authenticated') return 'publica'
  return ''
}
export const temChaveSecreta = () => !problemaDaChaveSecreta()

export const AVISO_CHAVE = {
  falta: 'Falta a chave secreta do Supabase no arquivo .env (SUPABASE_SECRET_KEY).',
  publica: 'A SUPABASE_SECRET_KEY do arquivo .env é a chave pública (anon ou publishable), não a secreta. Troque pela chave que começa com sb_secret_ (Supabase, Project Settings, API Keys, parte Secret keys) e reinicie o npm run dev.',
}

// Antes de usar o cliente com a chave secreta (serverSupabaseServiceRole). Sem a chave certa, o Supabase recusa
// com um erro genérico; aqui a pessoa lê o que está errado e onde pegar a chave.
export function exigirChaveSecreta(para) {
  const problema = problemaDaChaveSecreta()
  if (!problema) return
  throw createError({
    statusCode: 503,
    statusMessage: problema === 'falta' ? `${AVISO_CHAVE.falta} Sem ela, ${para} não funciona. O README mostra onde pegar a chave.` : AVISO_CHAVE.publica,
  })
}
