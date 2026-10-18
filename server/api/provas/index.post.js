// POST /api/provas
// Montar uma prova. Corpo: a configuração (lerConfigProva) e mais:
//   acao: 'previa'  devolve o caderno sorteado (ou o da prévia com as trocas: caderno + trocar) e os números;
//   acao: 'criar'   grava a prova com o caderno da prévia (caderno) e liga o relógio. Devolve { id }.
import { lerConfigProva } from '#shared/regras/provas.js'
import { estaLiberado } from '#shared/regras/desbloqueios.js'
import { RITMO_PADRAO } from '#shared/regras/ritmo.js'
import { criarExecucao, pessoa } from '../../utils/revisoes.js'
import { configDoBlocoDaProva, montarCaderno, previaDaProva } from '../../utils/provas.js'
import { UUID } from '../../utils/consultas.js'

const ids = (lista, max) => (Array.isArray(lista) ? lista.filter((x) => UUID.test(String(x ?? ''))).slice(0, max) : [])

export default defineEventHandler(async (event) => {
  const { usuario, supabase, admin } = await pessoa(event)
  const corpo = (await readBody(event).catch(() => null)) ?? {}
  const { config, erro } = lerConfigProva(corpo)
  if (erro) throw createError({ statusCode: 400, statusMessage: erro })
  const semente = String(corpo.semente ?? '').slice(0, 40) || String(Date.now())
  const caderno = ids(corpo.caderno, 60)

  // A Prova abre pelos mesmos requisitos da tela (shared/regras/desbloqueios.js), conferidos aqui também.
  const { data: e } = await supabase.rpc('resumo_estudo')
  const liberada = estaLiberado('prova', { revisoesCom10: e?.revisoes_com10 ?? 0, questoesRespondidas: e?.respondidas ?? 0, tiposUsados: e?.tipos_usados ?? 0 })
  if (!liberada) throw createError({ statusCode: 403, statusMessage: 'A Prova ainda está fechada. A tela da Prova mostra o que falta.' })

  if (corpo.acao !== 'criar') return previaDaProva(supabase, config, { semente, caderno, trocar: ids(corpo.trocar, 10) })

  const { count: andando } = await admin.from('revisoes').select('id', { count: 'exact', head: true }).eq('usuario_id', usuario.sub).eq('tipo', 'prova').in('status', ['em_andamento', 'pausada'])
  if ((andando ?? 0) >= 1) throw createError({ statusCode: 409, statusMessage: 'Você já tem uma prova em andamento. Entregue antes de começar outra.' })
  const { itens } = await montarCaderno(supabase, config, { semente, caderno })
  if (!itens.length) throw createError({ statusCode: 409, statusMessage: 'Nenhuma questão desses assuntos serve para este formato. Escolha outros assuntos ou outro formato.' })
  const { data: perfil } = await admin.from('perfis').select('ritmo').eq('id', usuario.sub).maybeSingle()
  const blocoConfig = configDoBlocoDaProva({ ...config, quantas: itens.length }, perfil?.ritmo ?? RITMO_PADRAO)
  const id = await criarExecucao({
    admin, supabase, usuario, titulo: config.titulo, modelo: 'personalizada', tipo: 'prova',
    prova: { formato: config.formato, minutos: config.minutos, relogio: config.relogio, ordem: config.ordem, fracos: config.fracos, quantas: config.quantas, assuntos: config.assuntos },
    terminaEm: new Date(Date.now() + config.minutos * 60000).toISOString(),
    blocos: [{ tipo: 'revisao', nome: 'Prova', config: blocoConfig, itens: itens.map((q) => ({ id: q.id })) }],
  })
  return { id }
})
