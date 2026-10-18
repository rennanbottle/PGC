// POST /api/revisoes/:id/estado
// Corpo: { acao: 'marcar' | 'leu' | 'atual' | 'pausar' | 'continuar' | 'bloco', itemId?, valor?, ordem?, bloco? }.
// Marcar para voltar, registrar que leu a correção (1 ponto por errada, uma vez a cada 20 horas), guardar a questão
// atual e pausar (guarda rascunhos e o tempo da questão aberta) ou continuar. "bloco" passa para o próximo bloco
// de um conjunto (montando o bloco de erros, se for o caso, e pulando bloco que ficou sem questões).
import { blocosDaExecucao } from '#shared/regras/conjuntos.js'
import { atualizarContagem, carregarRevisao, lerRascunhos, pessoa, prepararBloco } from '../../../utils/revisoes.js'

export default defineEventHandler(async (event) => {
  const { usuario, admin, supabase } = await pessoa(event)
  const corpo = (await readBody(event).catch(() => null)) ?? {}
  const { revisao, itens } = await carregarRevisao(admin, usuario.sub, getRouterParam(event, 'id'))
  if (revisao.status === 'concluida' && corpo.acao !== 'leu') throw createError({ statusCode: 409, statusMessage: 'Esta revisão já terminou.' })
  const item = itens.find((i) => i.id === corpo.itemId)
  const agora = new Date().toISOString()
  switch (corpo.acao) {
    case 'marcar':
      if (!item) throw createError({ statusCode: 404, statusMessage: 'Questão não encontrada.' })
      await admin.from('revisao_itens').update({ marcada: corpo.valor === true }).eq('id', item.id).eq('usuario_id', usuario.sub)
      return { ok: true }
    case 'leu':
      if (!item) throw createError({ statusCode: 404, statusMessage: 'Questão não encontrada.' })
      if (item.resultado === 'incorreta' && !item.leu_correcao && revisao.status !== 'concluida') {
        await admin.from('revisao_itens').update({ leu_correcao: true, pontos: item.recente ? 0 : 1 }).eq('id', item.id).eq('usuario_id', usuario.sub)
      }
      return { ok: true }
    case 'atual': {
      const ordem = Math.max(0, Math.min(revisao.total - 1, Math.round(Number(corpo.ordem) || 0)))
      await admin.from('revisoes').update({ atual: ordem, atualizado_em: agora }).eq('id', revisao.id).eq('usuario_id', usuario.sub)
      return { ok: true }
    }
    case 'pausar': {
      // Rascunho: o que estava escrito numa questão ainda não enviada. Fica guardado para continuar, mas não é
      // corrigido nem conta no resultado; se a revisão for encerrada, a questão fica como não respondida.
      for (const [itemId, rascunho] of lerRascunhos(corpo.rascunhos, itens)) {
        await admin.from('revisao_itens').update({ rascunho }).eq('id', itemId).eq('usuario_id', usuario.sub)
      }
      const seg = Math.max(0, Math.min(3600, Math.round(Number(corpo.segundos) || 0)))
      if (item && !item.resultado && !item.pendente && seg) {
        await admin.from('revisao_itens').update({ segundos: item.segundos + seg }).eq('id', item.id).eq('usuario_id', usuario.sub)
      }
      await atualizarContagem(admin, usuario.sub, revisao.id, { status: 'pausada', pausada_em: agora })
      return { ok: true }
    }
    case 'bloco': {
      const blocos = [...blocosDaExecucao(revisao)]
      let k = Math.round(Number(corpo.bloco))
      if (!(k >= 1 && k < blocos.length)) throw createError({ statusCode: 400, statusMessage: 'Bloco inválido.' })
      // Cronômetro do bloco que acabou: as que ficaram sem resposta ficam em branco e o estudo segue.
      const ant = k - 1
      if (corpo.esgotou === true && blocos[ant]?.config?.cronometro?.modo === 'sessao' && !blocos[ant].esgotado) {
        const seg = Math.max(0, Math.min(3600, Math.round(Number(corpo.segundos) || 0)))
        if (item && (item.bloco ?? 0) === ant && !item.resultado && seg) {
          await admin.from('revisao_itens').update({ segundos: item.segundos + seg }).eq('id', item.id).eq('usuario_id', usuario.sub)
        }
        const gasto = itens.filter((i) => (i.bloco ?? 0) === ant).reduce((s, i) => s + (i.segundos ?? 0), 0) + (item && (item.bloco ?? 0) === ant ? seg : 0)
        if (gasto >= blocos[ant].config.cronometro.minutos * 60 - 10) {
          blocos[ant] = { ...blocos[ant], esgotado: true }
          await admin.from('revisoes').update({ blocos }).eq('id', revisao.id).eq('usuario_id', usuario.sub)
          await atualizarContagem(admin, usuario.sub, revisao.id)
        }
      }
      if (itens.some((i) => (i.bloco ?? 0) < k && !i.resultado && !blocos[i.bloco ?? 0]?.esgotado)) throw createError({ statusCode: 409, statusMessage: 'Termine o bloco atual antes de passar para o próximo.' })
      const pulados = []
      let atual = await carregarRevisao(admin, usuario.sub, revisao.id)
      for (;;) {
        const r = await prepararBloco({ admin, supabase, usuario, revisao: atual.revisao, itens: atual.itens, bloco: k })
        atual = await carregarRevisao(admin, usuario.sub, revisao.id)
        if (!r.pulado) break
        pulados.push(k)
        if (k + 1 >= blocos.length) return { ok: true, fim: true, pulados }
        k += 1
      }
      await admin.from('revisoes').update({ bloco_atual: k, status: 'em_andamento', pausada_em: null, atualizado_em: agora }).eq('id', revisao.id).eq('usuario_id', usuario.sub)
      return { ok: true, bloco: k, pulados }
    }
    case 'continuar':
      await admin.from('revisoes').update({ status: 'em_andamento', pausada_em: null, atualizado_em: agora }).eq('id', revisao.id).eq('usuario_id', usuario.sub)
      return { ok: true }
    default:
      throw createError({ statusCode: 400, statusMessage: 'Ação inválida.' })
  }
})
