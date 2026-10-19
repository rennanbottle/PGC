// Traduz os erros do Supabase Auth para mensagens claras. Na entrada e na senha nova, a mensagem não revela se um
// e-mail tem conta. No cadastro revela (pedido do R em 13/10): o Supabase não cria a conta de novo, mas antes a tela
// dizia "enviamos o link" e a pessoa achava que tinha criado outra.
// Códigos: https://supabase.com/docs/guides/auth/debugging/error-codes

const MENSAGENS = {
  invalid_credentials: 'E-mail ou senha não conferem. Confira os dados ou recupere a senha.',
  email_not_confirmed: 'Falta confirmar o e-mail. Abra o link que enviamos ou peça outro.',
  over_request_rate_limit: 'Muitas tentativas seguidas. Espere alguns minutos e tente de novo.',
  over_email_send_rate_limit: 'Muitos e-mails pedidos agora. Espere alguns minutos para pedir outro.',
  weak_password: 'A senha não atende aos requisitos.',
  same_password: 'A senha nova precisa ser diferente da atual.',
  email_address_invalid: 'Esse e-mail não parece válido.',
  validation_failed: 'Confira os campos e tente de novo.',
  captcha_failed: 'A verificação de segurança falhou. Tente de novo.',
  signup_disabled: 'O cadastro está fechado no momento.',
  otp_expired: 'O link expirou ou já foi usado. Peça outro.',
  session_not_found: 'Sua sessão terminou. Entre de novo.',
  refresh_token_not_found: 'Sua sessão terminou. Entre de novo.',
  reauthentication_needed: 'Por segurança, entre de novo antes de trocar a senha.',
  user_already_exists: 'Este e-mail já tem conta no PGC.',
  email_exists: 'Este e-mail já tem conta no PGC.',
}

// Erros que não aparecem como erro geral (hoje nenhum: o e-mail já cadastrado ganhou mensagem própria no cadastro).
const SILENCIOSOS = new Set()

// O cadastro bateu num e-mail que já tem conta? Sem confirmação de e-mail, o Supabase devolve o erro
// user_already_exists. Com confirmação (o caso da nuvem), ele não dá erro: devolve um usuário de mentira, sem
// nenhuma identidade, e não manda e-mail nenhum. Os dois casos contam como "já tem conta".
export function contaJaExiste({ data, error } = {}) {
  if (error) return error.code === 'user_already_exists' || error.code === 'email_exists'
  const identidades = data?.user?.identities
  return !!data?.user && Array.isArray(identidades) && identidades.length === 0
}

export function erroSilencioso(erro) {
  return !!erro && SILENCIOSOS.has(erro.code)
}

export function mensagemDeErro(erro) {
  if (!erro) return null
  if (SILENCIOSOS.has(erro.code)) return null
  if (erro.code && MENSAGENS[erro.code]) return MENSAGENS[erro.code]
  if (erro.status === 429) return MENSAGENS.over_request_rate_limit
  const texto = String(erro.message ?? '')
  if (erro.name === 'AuthRetryableFetchError' || /fetch|network|rede/i.test(texto)) {
    return 'Sem conexão com o servidor. Confira a internet e tente de novo.'
  }
  return 'Algo deu errado. Tente de novo em instantes.'
}

// Depois de 5 tentativas erradas seguidas, a tela pede uma pausa que dobra a cada erro (até 15 minutos).
// É só conforto de tela: a proteção de verdade são os limites do Supabase e a verificação anti-robô.
export function esperaAposFalhas(falhas) {
  if (falhas < 5) return 0
  return Math.min(900, 30 * 2 ** (falhas - 5))
}
