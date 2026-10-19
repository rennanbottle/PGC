// Requisitos e força da senha. O mesmo mínimo deve estar configurado no Supabase
// (Authentication, Providers, Email: tamanho mínimo 10 e exigir letras e números).

export const SENHA_MINIMA = 10

const COMUNS = new Set(['1234567890', '12345678910', 'senha12345', 'senha123456', 'abc1234567', 'qwerty1234', 'password12', 'estudar123', 'brasil1234', 'mudar12345'])

export function avaliarSenha(senha = '') {
  const s = String(senha)
  const requisitos = [
    { id: 'tamanho', texto: `${SENHA_MINIMA} caracteres ou mais`, obrigatorio: true, ok: s.length >= SENHA_MINIMA },
    { id: 'mistura', texto: 'Letras e números', obrigatorio: true, ok: /\p{L}/u.test(s) && /\d/.test(s) },
    { id: 'simbolo', texto: 'Um símbolo deixa mais forte', obrigatorio: false, ok: /[^\p{L}\d\s]/u.test(s) },
  ]
  const comum = COMUNS.has(s.toLowerCase())
  const valida = !comum && requisitos.filter((r) => r.obrigatorio).every((r) => r.ok)
  let nivel = 0
  if (s.length > 0) {
    nivel = 1
    if (valida) nivel = 2
    if (valida && (requisitos[2].ok || s.length >= 14)) nivel = 3
  }
  return {
    requisitos,
    valida,
    comum,
    nivel,
    nome: comum ? 'Senha muito comum' : ['', 'Senha fraca', 'Senha média', 'Senha forte'][nivel],
  }
}

export function emailValido(email = '') {
  const e = String(email).trim()
  return e.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e)
}

export function nomeValido(nome = '') {
  const n = String(nome).trim()
  return n.length >= 1 && n.length <= 60
}
