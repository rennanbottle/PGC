// POST /api/assuntos/:id/relacao
// Aceita, recusa ou desfaz uma sugestão de assunto relacionado.
// Corpo: { outro: uuid, status: 'aceito' | 'recusado' | null }. null apaga o que foi escolhido (a sugestão pode voltar).
// Os dois assuntos precisam ser da pessoa (o banco confere de novo pela chave estrangeira e pelas regras de acesso).
import { parDaRelacao } from '#shared/regras/assunto.js'
import { pessoa } from '../../../utils/revisoes.js'
import { UUID } from '../../../utils/consultas.js'

export default defineEventHandler(async (event) => {
  const { supabase } = await pessoa(event)
  const id = String(getRouterParam(event, 'id') ?? '')
  const corpo = await readBody(event).catch(() => ({}))
  const outro = String(corpo?.outro ?? '')
  const status = corpo?.status === 'aceito' || corpo?.status === 'recusado' ? corpo.status : null
  if (!UUID.test(id) || !UUID.test(outro) || id === outro) throw createError({ statusCode: 400, statusMessage: 'Assunto inválido.' })

  const { data: donos } = await supabase.from('assuntos').select('id').in('id', [id, outro])
  if ((donos ?? []).length !== 2) throw createError({ statusCode: 404, statusMessage: 'Assunto não encontrado.' })

  const par = parDaRelacao(id, outro)
  // Troca a escolha: apaga a anterior do par e grava a nova (se houver).
  const apagou = await supabase.from('assunto_relacoes').delete().eq('assunto_a', par.assunto_a).eq('assunto_b', par.assunto_b)
  const gravou = status && !apagou.error ? await supabase.from('assunto_relacoes').insert({ ...par, status }) : { error: null }
  if (apagou.error || gravou.error) throw createError({ statusCode: 500, statusMessage: 'Não deu para salvar agora. Tente de novo.' })
  return { ok: true, status }
})
