// GET /api/assuntos/:id
// Tudo da página do assunto: o assunto e a matéria, a avaliação de domínio feita agora (estado, proficiência,
// critérios), a linha da proficiência ao longo dos estudos, a curva de lembrança, o acerto por nível de pensamento e
// por tipo (últimos 60 dias), os erros recentes, os conceitos do material, as questões no banco e a situação da
// prova de domínio (regra do ritmo, se pode fazer agora e por quê) e os assuntos relacionados (aceitos e sugeridos).
import { RITMO_PADRAO } from '#shared/regras/ritmo.js'
import { JANELA_DIAS } from '#shared/regras/dominio.js'
import { acertoAgrupado, curvaDeRetencao, diasAteRevisao, linhaDeProficiencia, sugerirRelacionados } from '#shared/regras/assunto.js'
import { questoesElegiveis, regraDaProvaDominio, situacaoDaProvaDominio } from '#shared/regras/provaDominio.js'
import { formulaValida } from '#shared/regras/matematica.js'
import { dataDoDia, diaDeBrasilia } from '#shared/regras/revisoes.js'
import { pessoa, diaComFracao } from '../../utils/revisoes.js'
import { UUID } from '../../utils/consultas.js'
import { avaliarAgora, provasDeDominio, respostasDoAssunto } from '../../utils/dominio.js'

export default defineEventHandler(async (event) => {
  const { usuario, supabase, admin } = await pessoa(event)
  const id = String(getRouterParam(event, 'id') ?? '')
  if (!UUID.test(id)) throw createError({ statusCode: 404, statusMessage: 'Assunto não encontrado.' })

  const { data: assunto } = await supabase.from('assuntos').select('id, nome, arquivado_em, materias(id, nome, cor)').eq('id', id).maybeSingle()
  if (!assunto) throw createError({ statusCode: 404, statusMessage: 'Assunto não encontrado.' })

  const [{ data: perfil }, respostas, provas, { data: questoes }, { data: conceitos }, { data: revisoes }, { data: andando }, { data: guardada }, { data: todosAssuntos }, { data: todosConceitos }, { data: relacoes }] = await Promise.all([
    admin.from('perfis').select('ritmo').eq('id', usuario.sub).maybeSingle(),
    respostasDoAssunto(admin, usuario.sub, id),
    provasDeDominio(admin, usuario.sub, { assuntoId: id }),
    supabase.from('questoes').select('id, tipo, nivel').eq('assunto_id', id).eq('em_revisao', true).limit(5000),
    supabase.from('conceitos').select('termo, tipo').eq('assunto_id', id).eq('status', 'aprovado').limit(80),
    supabase.from('revisoes').select('id, tipo, concluida_em, assuntos:resultado->assuntos').eq('status', 'concluida').order('concluida_em', { ascending: false }).limit(150),
    admin.from('revisoes').select('id, titulo, prova').eq('usuario_id', usuario.sub).eq('tipo', 'prova').in('status', ['em_andamento', 'pausada']).limit(1),
    supabase.from('proficiencias').select('proxima_revisao').eq('assunto_id', id).maybeSingle(),
    supabase.from('assuntos').select('id, nome, materia_id, arquivado_em, materias(nome, arquivada_em)').limit(2000),
    supabase.from('conceitos').select('assunto_id, termo, versao_id').neq('status', 'recusado').neq('tipo', 'formula').not('assunto_id', 'is', null).limit(8000),
    supabase.from('assunto_relacoes').select('assunto_a, assunto_b, status').or(`assunto_a.eq.${id},assunto_b.eq.${id}`),
  ])
  const ritmo = perfil?.ritmo ?? RITMO_PADRAO
  const avaliacao = await avaliarAgora(admin, usuario.sub, id, { ritmo, respostas, provas: provas.concluidas })

  // Lembrança: dias desde o último estudo e a curva dos próximos 30 dias.
  const hoje = diaComFracao()
  const desde = avaliacao.ultimoDia !== undefined ? Math.max(0, hoje - avaliacao.ultimoDia) : 0
  const curva = curvaDeRetencao({ estabilidade: avaliacao.estabilidade, desde, dias: 30 })
  const emDias = diasAteRevisao({ estabilidade: avaliacao.estabilidade, desde })

  // Acerto nos últimos 60 dias.
  const recentes = respostas.filter((r) => hoje - r.dia <= JANELA_DIAS)

  // Erros dos últimos 14 dias, uma linha por questão (a mais nova).
  const { data: erros } = await supabase.from('revisao_itens').select('id, questao_id, respondida_em, enunciado:snapshot->>enunciado')
    .eq('assunto_id', id).eq('resultado', 'incorreta').gte('respondida_em', new Date(Date.now() - 14 * 86400000).toISOString())
    .order('respondida_em', { ascending: false }).limit(40)
  const vistos = new Set()
  const errosRecentes = []
  for (const e of erros ?? []) {
    const chave = e.questao_id ?? e.id
    if (vistos.has(chave)) continue
    vistos.add(chave)
    errosRecentes.push({ id: e.id, questaoId: e.questao_id, enunciado: String(e.enunciado ?? '').slice(0, 400), quando: e.respondida_em })
    if (errosRecentes.length >= 6) break
  }

  // Prova de domínio.
  const regra = regraDaProvaDominio(ritmo)
  const elegiveis = questoesElegiveis(questoes ?? [], regra).length
  const ultima = provas.concluidas[0] ?? null
  const emAndamento = andando?.[0] ?? null
  const situacao = situacaoDaProvaDominio({
    ritmo, estado: avaliacao.estado, elegiveis, hoje: diaDeBrasilia(),
    ultima: ultima ? { dia: ultima.dia, aprovada: ultima.aprovada } : null, emAndamento: emAndamento?.id ?? null,
  })
  const aprovada = provas.concluidas.find((p) => p.aprovada) ?? null

  // Assuntos relacionados: os textos de onde vêm os conceitos deste assunto dão a fonte da sugestão.
  const minhasVersoes = [...new Set((todosConceitos ?? []).filter((c) => c.assunto_id === id && c.versao_id).map((c) => c.versao_id))]
  const { data: versoes } = minhasVersoes.length
    ? await supabase.from('material_versoes').select('id, materiais(id, titulo)').in('id', minhasVersoes.slice(0, 100))
    : { data: [] }
  const relacionados = sugerirRelacionados({
    assuntoId: id,
    assuntos: (todosAssuntos ?? []).map((a) => ({ id: a.id, nome: a.nome, materia: a.materias?.nome ?? null, arquivado: !!a.arquivado_em || !!a.materias?.arquivada_em })),
    conceitos: todosConceitos ?? [],
    textos: Object.fromEntries((versoes ?? []).filter((v) => v.materiais).map((v) => [v.id, { id: v.materiais.id, titulo: v.materiais.titulo }])),
    relacoes: relacoes ?? [],
  })

  const termos = (conceitos ?? []).filter((c) => c.tipo !== 'formula').map((c) => c.termo).filter(Boolean)
  const formulas = (conceitos ?? []).filter((c) => c.tipo === 'formula' && formulaValida(c.termo)).map((c) => c.termo)

  return {
    assunto: { id: assunto.id, nome: assunto.nome, arquivado: !!assunto.arquivado_em, materia: assunto.materias ? { id: assunto.materias.id, nome: assunto.materias.nome, cor: assunto.materias.cor } : null },
    ritmo,
    avaliacao: {
      estado: avaliacao.estado, proficiencia: avaliacao.proficiencia, retencao: avaliacao.retencao, respostas: avaliacao.respostas,
      dias: avaliacao.dias, checklist: avaliacao.checklist, faltam: avaliacao.faltam ?? 0,
    },
    linha: linhaDeProficiencia(revisoes ?? [], id),
    lembranca: {
      curva: curva.map((p) => ({ dia: p.dia, r: Math.round(p.r * 1000) / 1000 })),
      revisaoEmDias: emDias,
      proximaRevisao: emDias === null ? guardada?.proxima_revisao ?? null : dataDoDia(diaDeBrasilia() + emDias),
    },
    porBloom: acertoAgrupado(recentes, 'bloom'),
    porTipo: acertoAgrupado(recentes, 'tipo'),
    erros: errosRecentes,
    conceitos: { termos: [...new Set(termos)].slice(0, 24), formulas: [...new Set(formulas)].slice(0, 6) },
    questoes: { total: (questoes ?? []).length, elegiveis },
    relacionados,
    prova: {
      regra,
      pode: situacao.pode,
      motivo: situacao.motivo,
      faltam: situacao.faltam ?? 0,
      emAndamento: emAndamento ? { id: emAndamento.id, titulo: emAndamento.titulo, doAssunto: emAndamento.prova?.assuntoId === id } : null,
      ultima: ultima ? { id: ultima.id, data: ultima.data, certas: ultima.certas, total: ultima.total, aprovada: ultima.aprovada } : null,
      aprovadaEm: aprovada?.data ?? null,
    },
  }
})
