// GET /api/ia/diagnostico
// Só para quem está em sistema_donos (o banco confere em ia_diagnostico). Junta o que o banco sabe com o que só o
// servidor sabe: se a variável da chave existe no ambiente. O valor da chave nunca sai daqui.
import { serverSupabaseClient, serverSupabaseUser } from '#supabase/server'
import { COTAS } from '#shared/regras/ia.js'
import { temChave } from '../../utils/ia.js'

export default defineEventHandler(async (event) => {
  const usuario = await serverSupabaseUser(event).catch(() => null)
  if (!usuario?.sub) throw createError({ statusCode: 401, statusMessage: 'Entre de novo para continuar.' })
  const supabase = await serverSupabaseClient(event)
  const { data, error } = await supabase.rpc('ia_diagnostico')
  if (error) throw createError({ statusCode: error.code === '42501' ? 404 : 500, statusMessage: error.code === '42501' ? 'Página não encontrada.' : 'Não deu para ler o diagnóstico.' })
  const cotas = Object.fromEntries(Object.entries(COTAS).map(([provedor, c]) => {
    const t = data.tokens_hoje?.[provedor] ?? { entrada: 0, saida: 0 }
    return [provedor, { rotulo: c.rotulo, limite: c.limite, gasto: Math.round(c.gasto(Number(t.entrada), Number(t.saida))) }]
  }))
  return { ...data, cotas, modelos: data.modelos.map((m) => ({ ...m, temChave: temChave(m) })) }
})
