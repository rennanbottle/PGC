// Destino dos links enviados por e-mail (confirmar cadastro e recuperar senha).
// O link traz um token_hash; o servidor confere com o Supabase e já grava a sessão nos cookies.
// Funciona mesmo se a pessoa abrir o e-mail em outro aparelho, diferente do usado no cadastro.
import { serverSupabaseClient } from '#supabase/server'
import { destinoSeguro } from '#shared/regras/redirecionamento.js'

const TIPOS = new Set(['email', 'signup', 'recovery', 'email_change'])

export default defineEventHandler(async (event) => {
  const { token_hash: tokenHash, type: tipo, next: proximo } = getQuery(event)
  const recuperacao = tipo === 'recovery'
  const telaDeErro = recuperacao ? '/recuperar-senha' : '/entrar'

  if (typeof tokenHash !== 'string' || tokenHash.length < 10 || !TIPOS.has(tipo)) {
    return sendRedirect(event, `${telaDeErro}?link=invalido`, 302)
  }

  const supabase = await serverSupabaseClient(event)
  const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: tipo })

  if (error) {
    const motivo = error.code === 'otp_expired' ? 'expirado' : 'invalido'
    return sendRedirect(event, `${telaDeErro}?link=${motivo}`, 302)
  }

  const padrao = recuperacao ? '/redefinir-senha' : '/inicio?bem_vindo=1'
  return sendRedirect(event, destinoSeguro(proximo, padrao), 302)
})
