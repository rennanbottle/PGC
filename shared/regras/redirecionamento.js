// Só aceita destinos internos depois do login ou de um link de e-mail.
// Evita "redirecionamento aberto": alguém mandar um link do PGC que leva para outro site.

export function destinoSeguro(valor, padrao = '/inicio') {
  if (typeof valor !== 'string') return padrao
  const v = valor.trim()
  if (!v.startsWith('/') || v.startsWith('//') || v.startsWith('/\\')) return padrao
  if (/[\u0000-\u001f\\]/.test(v)) return padrao
  if (/^\/(entrar|criar-conta|recuperar-senha)(\/|\?|$)/.test(v)) return padrao
  return v.slice(0, 300)
}
