// GET /api/revisoes/:id
// A execução para a tela em modo foco: os blocos (com a configuração de cada um), cada questão sem gabarito (o
// servidor embaralha com a semente do item), as dicas já abertas, a correção das respondidas quando ela já pode
// aparecer (a cada questão, no fim do bloco ou só no fim) e o formulário dos assuntos.
import { blocosDaExecucao } from '#shared/regras/conjuntos.js'
import { blocosCompletos, carregarRevisao, itemParaTela, pessoa } from '../../../utils/revisoes.js'

const PARA_TELA = ['cronometro', 'correcao', 'avancar', 'formulario', 'nivelNaQuestao', 'dicas', 'origem', 'quantidade', 'dificuldade']

export default defineEventHandler(async (event) => {
  const { usuario, supabase, admin } = await pessoa(event)
  const { revisao, itens } = await carregarRevisao(admin, usuario.sub, getRouterParam(event, 'id'))
  const blocos = blocosDaExecucao(revisao)
  const idsDosBlocos = blocos.flatMap((b) => (b.config?.assuntos ?? []).map((a) => a.id))
  const assuntoIds = [...new Set([...itens.map((i) => i.assunto_id).filter(Boolean), ...idsDosBlocos])].slice(0, 120)
  const { data: assuntos } = assuntoIds.length ? await supabase.from('assuntos').select('id, nome, materias(nome, cor)').in('id', assuntoIds) : { data: [] }
  let formulario = []
  if (blocos.some((b) => b.config?.formulario !== false) && assuntoIds.length) {
    const { data } = await supabase.from('conceitos').select('assunto_id, termo').eq('tipo', 'formula').eq('status', 'aprovado').in('assunto_id', assuntoIds).limit(60)
    formulario = (data ?? []).map((c) => ({ assuntoId: c.assunto_id, formula: c.termo }))
  }
  const completos = blocosCompletos(itens)
  return {
    revisao: {
      id: revisao.id, titulo: revisao.titulo, status: revisao.status, total: revisao.total, respondidas: revisao.respondidas,
      atual: revisao.atual, segundos: revisao.segundos, modelo: revisao.modelo, blocoAtual: revisao.bloco_atual ?? 0, conjuntoId: revisao.conjunto_id,
      blocos: blocos.map((b, k) => ({
        tipo: b.tipo, nome: b.nome, quantidade: b.quantidade, preparado: b.preparado !== false, pulado: !!b.pulado, esgotado: !!b.esgotado, completo: completos.has(k),
        assuntos: (b.config?.assuntos ?? []).map((a) => a.id),
        config: Object.fromEntries(PARA_TELA.map((c) => [c, b.config?.[c]])),
      })),
    },
    assuntos: Object.fromEntries((assuntos ?? []).map((a) => [a.id, { nome: a.nome, materia: a.materias?.nome ?? '', cor: a.materias?.cor ?? 'cinza' }])),
    formulario,
    itens: await Promise.all(itens.map((i) => itemParaTela(admin, usuario.sub, revisao, i, { completos }))),
  }
})
