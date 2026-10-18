// POST /api/conta/email
// Cadastro, passo 1: diz se o e-mail já tem conta, para avisar antes dos outros passos (o Supabase também recusa no
// fim, então isso não revela nada que o cadastro já não revele). Usa a função email_tem_conta, que só a chave
// secreta chama. Para não virar uma lista de e-mails, cada endereço de internet pode perguntar 10 vezes a cada 10
// minutos; passou disso, responde "não sei" e o cadastro segue (o aviso volta a aparecer no fim).
// Corpo: { email }. Resposta: { temConta: true | false | null }.
import { serverSupabaseServiceRole } from '#supabase/server'

const JANELA_MS = 10 * 60 * 1000
const LIMITE = 10
const pedidos = new Map()

function podePerguntar(ip) {
  const agora = Date.now()
  const lista = (pedidos.get(ip) ?? []).filter((t) => agora - t < JANELA_MS)
  if (lista.length >= LIMITE) {
    pedidos.set(ip, lista)
    return false
  }
  lista.push(agora)
  pedidos.set(ip, lista)
  if (pedidos.size > 5000) for (const [chave, l] of pedidos) if (!l.some((t) => agora - t < JANELA_MS)) pedidos.delete(chave)
  return true
}

export default defineEventHandler(async (event) => {
  const corpo = await readBody(event).catch(() => ({}))
  const email = String(corpo?.email ?? '').trim().toLowerCase()
  if (!email || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw createError({ statusCode: 400, statusMessage: 'E-mail inválido.' })
  const ip = getRequestIP(event, { xForwardedFor: true }) ?? 'sem-ip'
  if (!podePerguntar(ip)) return { temConta: null }
  try {
    const admin = await serverSupabaseServiceRole(event)
    const { data, error } = await admin.rpc('email_tem_conta', { p_email: email })
    if (error) return { temConta: null }
    return { temConta: data === true }
  }
  catch {
    return { temConta: null }
  }
})
