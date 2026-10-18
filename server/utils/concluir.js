// Fechar uma revisão: bônus da sessão, estado de cada assunto (recalculado com todo o histórico), marcos
// (proficiente, dominado, recuperou), teto de pontos do dia, eventos de pontos e o resumo do resultado.
import { aplicarTetoDiario, bonusDiasSeguidos, bonusErrosRecuperados, bonusMarco, bonusSessao, nivelPorPontos, pontosParaNivel } from '#shared/regras/pontos.js'
import { blocosDaExecucao } from '#shared/regras/conjuntos.js'
import { resumoDoResultado } from '#shared/regras/revisoes.js'
import { RITMO_PADRAO } from '#shared/regras/ritmo.js'
import { resultadoDaProvaDominio } from '#shared/regras/provaDominio.js'
import { atualizarContagem, diaComFracao } from './revisoes.js'
import { avaliarAgora, provasDeDominio } from './dominio.js'

const PROFICIENTE_OU_MAIS = new Set(['proficiente', 'pronto_para_prova', 'dominado'])
const MOTIVOS = {
  respostas: 'Respostas certas',
  correcoes: 'Correções lidas',
  conclusao: 'Conclusão do estudo',
  erros_recuperados: 'Erros de blocos anteriores acertados depois',
  revisao_no_dia: 'Revisão no dia indicado',
  serie_sem_dica: 'Série de acertos sem dica',
  dias_seguidos: 'Dias seguidos de estudo',
  proficiente: 'ficou Proficiente',
  dominado: 'ficou Dominado',
  recuperou: 'voltou a Proficiente',
  teto: 'Teto do dia (acima de 400 vale metade)',
}

export async function concluirRevisao({ admin, supabase, usuarioId, revisao, itens, encerrar }) {
  const respondidos = itens.filter((i) => i.resultado)
  const { data: perfil } = await admin.from('perfis').select('ritmo').eq('id', usuarioId).maybeSingle()
  const ritmo = perfil?.ritmo ?? RITMO_PADRAO
  const { data: antes } = await supabase.rpc('resumo_estudo')

  // Pontos das respostas (já calculados ao responder) e bônus da sessão.
  const detalhe = []
  const certas = respondidos.filter((i) => i.resultado !== 'incorreta').reduce((s, i) => s + i.pontos, 0)
  const correcoes = respondidos.filter((i) => i.resultado === 'incorreta').reduce((s, i) => s + i.pontos, 0)
  if (certas) detalhe.push({ motivo: 'respostas', texto: `${respondidos.filter((i) => i.resultado !== 'incorreta' && i.pontos).length} respostas certas ou parciais`, pontos: certas })
  if (correcoes) detalhe.push({ motivo: 'correcoes', texto: `${correcoes} ${correcoes === 1 ? 'correção lida' : 'correções lidas'}`, pontos: correcoes })
  const bonus = bonusSessao(itens.map((i) => ({ resultado: i.resultado, dicas: i.dicas_usadas, recente: i.recente, retencaoAntes: i.retencao_antes === null ? null : Number(i.retencao_antes) })), { agendada: revisao.agendada })
  for (const b of bonus.detalhe) {
    const texto = b.motivo === 'conclusao' ? `${revisao.tipo === 'prova' ? 'Prova entregue' : 'Conclusão do estudo'}, ${respondidos.length} respostas` : b.motivo === 'serie_sem_dica' ? 'Série de acertos sem dica' : MOTIVOS[b.motivo]
    detalhe.push({ motivo: b.motivo, texto, pontos: b.pontos })
  }
  // Por bloco, e os erros de um bloco que a pessoa acertou num bloco depois (o bloco "Voltar nos erros").
  // Encerrar antes de chegar a um bloco que ainda não foi montado: ele fica de fora, como pulado.
  const blocosAntes = blocosDaExecucao(revisao)
  const blocos = blocosAntes.map((b) => (b.preparado === false ? { ...b, preparado: true, pulado: true, naoAberto: true, quantidade: 0 } : b))
  const fechouBlocos = blocos.some((b, k) => b !== blocosAntes[k])
  const errouAntes = new Map()
  for (const i of itens) {
    if (i.questao_id && i.resultado && i.resultado !== 'correta' && !errouAntes.has(i.questao_id)) errouAntes.set(i.questao_id, i.bloco ?? 0)
  }
  const porBloco = blocos.map((b, k) => {
    const doBloco = itens.filter((i) => (i.bloco ?? 0) === k)
    const recuperadas = doBloco.filter((i) => i.resultado === 'correta' && i.questao_id && errouAntes.has(i.questao_id) && errouAntes.get(i.questao_id) < k).length
    const voltaram = doBloco.filter((i) => i.questao_id && errouAntes.has(i.questao_id) && errouAntes.get(i.questao_id) < k).length
    return {
      tipo: b.tipo ?? 'revisao', nome: b.nome ?? revisao.titulo, pulado: !!b.pulado, total: doBloco.length,
      certas: doBloco.filter((i) => i.resultado === 'correta').length,
      parciais: doBloco.filter((i) => i.resultado === 'parcial').length,
      erradas: doBloco.filter((i) => i.resultado === 'incorreta').length,
      branco: doBloco.filter((i) => !i.resultado).length,
      incertas: doBloco.filter((i) => i.incerta && i.resultado === 'correta').length,
      segundos: doBloco.reduce((s, i) => s + (i.segundos ?? 0), 0),
      voltaram, recuperadas,
    }
  })
  const recuperadas = porBloco.reduce((s, b) => s + b.recuperadas, 0)
  if (recuperadas) detalhe.push({ motivo: 'erros_recuperados', texto: `${recuperadas} ${recuperadas === 1 ? 'erro de bloco anterior acertado depois' : 'erros de blocos anteriores acertados depois'}`, pontos: bonusErrosRecuperados(recuperadas) })

  // Dias seguidos: uma vez por dia, na primeira revisão concluída do dia.
  const { data: jaHoje } = await admin.from('pontos_eventos').select('id').eq('usuario_id', usuarioId).eq('motivo', 'dias_seguidos')
    .gte('criado_em', new Date(Math.floor(diaComFracao()) * 86400000 + 3 * 3600 * 1000).toISOString()).limit(1)
  if (respondidos.length >= 5 && !(jaHoje ?? []).length && (antes?.dias_seguidos ?? 0) >= 2) {
    detalhe.push({ motivo: 'dias_seguidos', texto: `${antes.dias_seguidos} dias seguidos de estudo`, pontos: bonusDiasSeguidos(antes.dias_seguidos) })
  }

  // Prova de domínio: passou se acertou o mínimo da regra (guardada na prova), sem dica.
  const ehDominio = revisao.tipo === 'prova' && revisao.prova?.formato === 'dominio'
  const dominio = ehDominio ? resultadoDaProvaDominio(itens, revisao.prova.regra) : null

  // Estado de cada assunto com todo o histórico e as provas de domínio já feitas.
  const assuntoIds = [...new Set(itens.map((i) => i.assunto_id).filter(Boolean))]
  const provas = assuntoIds.length ? (await provasDeDominio(admin, usuarioId)).concluidas : []
  const { data: nomes } = assuntoIds.length ? await admin.from('assuntos').select('id, nome, materia_id').in('id', assuntoIds).eq('usuario_id', usuarioId) : { data: [] }
  const { data: anteriores } = assuntoIds.length ? await admin.from('proficiencias').select('*').in('assunto_id', assuntoIds).eq('usuario_id', usuarioId) : { data: [] }
  const assuntos = []
  for (const aid of assuntoIds) {
    const extra = ehDominio && revisao.prova.assuntoId === aid
      ? { assuntoId: aid, questoes: itens.length, certas: dominio.certas, nivelMinimo: Number(revisao.prova.regra?.nivelMinimo ?? 0), usouDica: false }
      : null
    const r = await avaliarAgora(admin, usuarioId, aid, { ritmo, provas, extra })
    const ant = (anteriores ?? []).find((p) => p.assunto_id === aid)
    const estadoAntes = ant?.estado ?? 'nao_iniciado'
    await admin.from('proficiencias').upsert({
      assunto_id: aid, usuario_id: usuarioId, theta: r.theta ?? 0, n: r.n ?? 0, proficiencia: r.proficiencia, estado: r.estado,
      retencao: r.retencao, respostas: r.respostas, faltam: r.faltam ?? null, checklist: r.checklist ?? [],
      proxima_revisao: r.proximaRevisaoEmDias ? new Date(Date.now() + r.proximaRevisaoEmDias * 86400000).toISOString().slice(0, 10) : null,
      atualizado_em: new Date().toISOString(),
    }, { onConflict: 'assunto_id' })
    const nome = (nomes ?? []).find((n) => n.id === aid)?.nome ?? 'Assunto'
    let marco = null
    if (r.estado === 'dominado' && estadoAntes !== 'dominado') marco = 'dominado'
    else if (PROFICIENTE_OU_MAIS.has(r.estado) && !PROFICIENTE_OU_MAIS.has(estadoAntes)) marco = estadoAntes === 'relembrar' ? 'recuperou' : 'proficiente'
    if (marco) detalhe.push({ motivo: marco, texto: `${nome} ${MOTIVOS[marco]}`, pontos: bonusMarco(marco, ritmo) })
    const doAssunto = itens.filter((i) => i.assunto_id === aid)
    assuntos.push({
      id: aid, nome, materiaId: (nomes ?? []).find((n) => n.id === aid)?.materia_id ?? null,
      antes: ant?.proficiencia ?? null, depois: r.proficiencia, estadoAntes, estadoDepois: r.estado,
      certas: doAssunto.filter((i) => i.resultado === 'correta').length, total: doAssunto.length, marco,
      proxima: r.proximaRevisaoEmDias ? new Date(Date.now() + r.proximaRevisaoEmDias * 86400000).toISOString().slice(0, 10) : null,
    })
  }

  // Teto suave do dia sobre o total desta revisão.
  const bruto = detalhe.reduce((s, d) => s + d.pontos, 0)
  const ganho = aplicarTetoDiario(antes?.pontos_hoje ?? 0, bruto)
  if (ganho < bruto) detalhe.push({ motivo: 'teto', texto: MOTIVOS.teto, pontos: ganho - bruto })
  if (detalhe.length) {
    await admin.from('pontos_eventos').insert(detalhe.map((d) => ({ usuario_id: usuarioId, revisao_id: revisao.id, motivo: d.motivo, pontos: d.pontos })))
  }

  // Destaques e resumo.
  const resumo = resumoDoResultado(itens.map((i) => ({ tipo: i.tipo, nivel: i.nivel, bloom: i.bloom, assunto_id: i.assunto_id, resultado: i.resultado, incerta: i.incerta })))
  const destaques = []
  if (dominio) destaques.push(dominio.aprovada ? `Prova de domínio aprovada: ${dominio.certas}/${dominio.total} certas.` : `Prova de domínio: ${dominio.certas}/${dominio.total} certas. Precisava de ${dominio.minimo}.`)
  for (const a of assuntos) if (a.marco) destaques.push(`${a.nome} ${MOTIVOS[a.marco]}.`)
  const ultimas = (antes?.acerto_ultimas ?? []).map(Number)
  const acerto = respondidos.length ? Math.round((100 * (resumo.certas + 0.5 * resumo.parciais)) / respondidos.length) : 0
  if (revisao.tipo !== 'prova' && ultimas.length >= 3 && acerto > Math.max(...ultimas)) destaques.push(`Seu melhor acerto entre os últimos ${ultimas.length + 1} estudos.`)
  let seq = 0
  let maior = 0
  for (const i of itens) {
    seq = i.resultado === 'correta' && !i.dicas_usadas ? seq + 1 : 0
    maior = Math.max(maior, seq)
  }
  if (maior >= 5) destaques.push(`${maior} acertos seguidos sem dica.`)

  const pontosAntes = antes?.pontos ?? 0
  const resultado = {
    ...resumo,
    porBloco,
    acerto,
    mediaAnterior: ultimas.length ? Math.round(ultimas.reduce((s, n) => s + n, 0) / ultimas.length) : null,
    ultimas: [...ultimas, acerto].slice(-8),
    assuntos,
    destaques,
    ...(dominio ? { dominio: { ...dominio, assuntoId: revisao.prova.assuntoId, regra: revisao.prova.regra } } : {}),
    nivel: { antes: nivelPorPontos(pontosAntes), depois: nivelPorPontos(pontosAntes + ganho), pontos: pontosAntes + ganho, proximo: pontosParaNivel(nivelPorPontos(pontosAntes + ganho) + 1) },
  }
  await atualizarContagem(admin, usuarioId, revisao.id, {
    status: 'concluida', encerrada_antes: !!encerrar && (respondidos.length < itens.length || fechouBlocos), pontos: ganho,
    ...(fechouBlocos && revisao.blocos?.length ? { blocos, total: Math.max(1, Math.min(60, itens.length)) } : {}),
    pontos_detalhe: detalhe, resultado, concluida_em: new Date().toISOString(),
  })
  return { pontos: ganho }
}
