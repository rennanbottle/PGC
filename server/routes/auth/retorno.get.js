// Volta dos links de e-mail do Supabase (confirmar cadastro e recuperar senha) no modelo padrão de e-mail.
// O Supabase confere o link e manda a pessoa para cá com um "code". Aqui o servidor troca o code por uma sessão.
// Se isso falhar (e-mail aberto em outro navegador, por exemplo), o e-mail já foi confirmado pelo Supabase:
// a pessoa só precisa entrar, e a tela de entrada avisa isso.
import { serverSupabaseClient } from '#supabase/server'
import { destinoSeguro } from '#shared/regras/redirecionamento.js'

export default defineEventHandler(async (event) => {
  const { code: codigo, next: proximo, error_code: codigoErro } = getQuery(event)
  const recuperacao = proximo === '/redefinir-senha'

  if (codigoErro) {
    return sendRedirect(event, recuperacao ? '/recuperar-senha?link=expirado' : '/entrar?link=expirado', 302)
  }
  if (typeof codigo !== 'string' || codigo.length < 10) {
    return sendRedirect(event, recuperacao ? '/recuperar-senha?link=invalido' : '/entrar?link=invalido', 302)
  }

  const supabase = await serverSupabaseClient(event)
  const { error } = await supabase.auth.exchangeCodeForSession(codigo)

  if (error) {
    return sendRedirect(event, recuperacao ? '/recuperar-senha?link=expirado' : '/entrar?link=confirmado', 302)
  }
  const padrao = recuperacao ? '/redefinir-senha' : '/inicio?bem_vindo=1'
  return sendRedirect(event, destinoSeguro(typeof proximo === 'string' ? proximo : undefined, padrao), 302)
})
