// GET /api/provas/:id
// A prova para a tela: cada questão sem gabarito (embaralhada com a semente do item), a resposta guardada e se está
// marcada para voltar, e quanto falta no relógio. Se o tempo acabou sem entregar, entrega antes e avisa.
import { paraResponder } from '#shared/regras/sessao.js'
import { pessoa } from '../../../utils/revisoes.js'
import { assuntosDaProva, provaEmDia, restanteDe } from '../../../utils/provas.js'

export default defineEventHandler(async (event) => {
  const { usuario, supabase, admin } = await pessoa(event)
  const { revisao, itens } = await provaEmDia({ admin, supabase, usuarioId: usuario.sub, id: getRouterParam(event, 'id') })
  if (revisao.status !== 'em_andamento') return { prova: { id: revisao.id, titulo: revisao.titulo, status: revisao.status === 'concluida' ? 'entregue' : 'entregando' } }
  return {
    prova: {
      id: revisao.id, titulo: revisao.titulo, formato: revisao.prova?.formato ?? 'enem', status: 'em_andamento', total: itens.length,
      restante: restanteDe(revisao), relogio: revisao.prova?.relogio ?? 'sempre', atual: Math.min(revisao.atual ?? 0, Math.max(0, itens.length - 1)),
    },
    assuntos: await assuntosDaProva(supabase, itens),
    itens: itens.map((i) => ({
      id: i.id, ordem: i.ordem, tipo: i.tipo, assuntoId: i.assunto_id, nivelMostrado: null,
      questao: paraResponder(i.snapshot, i.semente), imagem: i.snapshot?.imagem_caminho ?? null,
      marcada: i.marcada, resposta: i.rascunho?.resposta ?? {}, respondida: false, segundos: i.segundos ?? 0,
    })),
  }
})
