// Leituras do domínio de um assunto, usadas ao concluir um estudo ou prova (concluir.js), na página do assunto e
// ao montar a prova de domínio. Sempre com o usuário no filtro (o cliente admin passa por cima do RLS).
import { avaliarAssunto } from '#shared/regras/dominio.js'
import { provaDoRegistro } from '#shared/regras/provaDominio.js'
import { diaDeBrasilia } from '#shared/regras/revisoes.js'
import { todasAsLinhas } from './consultas.js'
import { diaComFracao } from './revisoes.js'

// Todas as respostas de confiança alta do assunto, no formato de avaliarAssunto.
export async function respostasDoAssunto(admin, usuarioId, assuntoId, { comItem = false } = {}) {
  const historico = await todasAsLinhas((de, ate) => admin.from('revisao_itens')
    .select(`${comItem ? 'id, ' : ''}questao_id, tipo, nivel, bloom, resultado, dicas_usadas, respondida_em, snapshot->conteudo->alternativas`)
    .eq('usuario_id', usuarioId).eq('assunto_id', assuntoId).eq('confianca', 'alta').not('resultado', 'is', null).order('respondida_em').range(de, ate))
  return historico.map((h) => ({
    ...(comItem ? { itemId: h.id } : {}),
    questaoId: h.questao_id ?? `${h.respondida_em}`,
    tipo: h.tipo,
    nivel: h.nivel,
    bloom: h.bloom,
    resultado: h.resultado,
    dicas: h.dicas_usadas,
    dia: diaComFracao(h.respondida_em),
    respondidaEm: h.respondida_em,
    alternativas: Array.isArray(h.alternativas) ? h.alternativas.length : 5,
  }))
}

// Provas de domínio do usuário (concluídas e em andamento), da mais nova para a mais velha.
// Devolve { concluidas: [{ id, assuntoId, dia, certas, total, aprovada, registro }], emAndamento: [{ id, assuntoId }] }.
export async function provasDeDominio(admin, usuarioId, { assuntoId = null } = {}) {
  let q = admin.from('revisoes').select('id, status, total, certas, prova, resultado, concluida_em, criado_em')
    .eq('usuario_id', usuarioId).eq('tipo', 'prova').eq('prova->>formato', 'dominio')
  if (assuntoId) q = q.eq('prova->>assuntoId', assuntoId)
  const { data } = await q.order('criado_em', { ascending: false }).limit(200)
  const concluidas = []
  const emAndamento = []
  for (const r of data ?? []) {
    if (r.status === 'concluida') {
      concluidas.push({
        id: r.id,
        assuntoId: r.prova?.assuntoId ?? null,
        dia: diaDeBrasilia(new Date(r.concluida_em ?? r.criado_em)),
        data: r.concluida_em,
        certas: r.certas ?? 0,
        total: r.total ?? 0,
        aprovada: !!r.resultado?.dominio?.aprovada,
        registro: provaDoRegistro(r),
      })
    }
    else emAndamento.push({ id: r.id, assuntoId: r.prova?.assuntoId ?? null })
  }
  return { concluidas, emAndamento }
}

// Avaliação atual do assunto com todo o histórico e as provas de domínio já feitas. "extra" é uma prova de domínio
// que está sendo concluída agora (ainda não está com status concluída no banco).
export async function avaliarAgora(admin, usuarioId, assuntoId, { ritmo, respostas = null, provas = null, extra = null } = {}) {
  const lista = respostas ?? await respostasDoAssunto(admin, usuarioId, assuntoId)
  const doAssunto = (provas ?? (await provasDeDominio(admin, usuarioId, { assuntoId })).concluidas)
    .filter((p) => p.assuntoId === assuntoId).map((p) => p.registro)
  if (extra) doAssunto.push(extra)
  return avaliarAssunto(lista, diaComFracao(), { ritmo, provasDominio: doAssunto })
}
