// POST /api/provas/dominio   corpo: { assuntoId }
// Monta e começa a prova de domínio de um assunto: só quando o assunto está "Pronto para a prova de domínio", sem
// outra prova em andamento, sem tentativa reprovada hoje e com questões suficientes no nível mínimo do ritmo.
// As questões são sorteadas entre as que servem, dando preferência às que não foram respondidas nas últimas horas.
// Devolve { id } da prova, que abre na mesma tela das outras provas (correção só no fim, sem dica).
import { RITMO_PADRAO } from '#shared/regras/ritmo.js'
import { minutosDaProvaDominio, questoesElegiveis, regraDaProvaDominio, situacaoDaProvaDominio, textoDoNivelMinimo } from '#shared/regras/provaDominio.js'
import { diaDeBrasilia } from '#shared/regras/revisoes.js'
import { sorteador } from '#shared/regras/sessao.js'
import { candidatas, criarExecucao, pessoa } from '../../utils/revisoes.js'
import { configDoBlocoDaProva } from '../../utils/provas.js'
import { avaliarAgora, provasDeDominio } from '../../utils/dominio.js'
import { UUID } from '../../utils/consultas.js'

const MENSAGEM = {
  sem_prova: 'No ritmo Tranquilo o domínio não pede prova.',
  dominado: 'Este assunto já está dominado.',
  andamento: 'Você já tem uma prova em andamento. Entregue antes de começar outra.',
  criterios: 'O assunto ainda não está pronto para a prova de domínio. A página do assunto mostra o que falta.',
  amanha: 'Você já fez a prova de domínio deste assunto hoje. A próxima tentativa abre amanhã.',
}

export default defineEventHandler(async (event) => {
  const { usuario, supabase, admin } = await pessoa(event)
  const corpo = (await readBody(event).catch(() => null)) ?? {}
  const assuntoId = String(corpo.assuntoId ?? '')
  if (!UUID.test(assuntoId)) throw createError({ statusCode: 400, statusMessage: 'Assunto inválido.' })

  const { data: assunto } = await supabase.from('assuntos').select('id, nome').eq('id', assuntoId).maybeSingle()
  if (!assunto) throw createError({ statusCode: 404, statusMessage: 'Assunto não encontrado.' })
  const { data: perfil } = await admin.from('perfis').select('ritmo').eq('id', usuario.sub).maybeSingle()
  const ritmo = perfil?.ritmo ?? RITMO_PADRAO

  // Qualquer prova em andamento (simulado ou domínio) segura a nova.
  const { data: andando } = await admin.from('revisoes').select('id').eq('usuario_id', usuario.sub).eq('tipo', 'prova').in('status', ['em_andamento', 'pausada']).limit(1)
  const { concluidas } = await provasDeDominio(admin, usuario.sub, { assuntoId })
  const avaliacao = await avaliarAgora(admin, usuario.sub, assuntoId, { ritmo, provas: concluidas })
  const pool = await candidatas(supabase, [assuntoId])
  const ultima = concluidas[0] ?? null
  const situacao = situacaoDaProvaDominio({
    ritmo, estado: avaliacao.estado, elegiveis: questoesElegiveis(pool, regraDaProvaDominio(ritmo)).length,
    ultima: ultima ? { dia: ultima.dia, aprovada: ultima.aprovada } : null, emAndamento: andando?.[0]?.id ?? null, hoje: diaDeBrasilia(),
  })
  if (!situacao.pode) {
    const texto = situacao.motivo === 'questoes'
      ? `Faltam ${situacao.faltam} ${situacao.faltam === 1 ? 'questão' : 'questões'} de nível ${textoDoNivelMinimo(situacao.regra.nivelMinimo)} neste assunto. Gere mais e volte.`
      : MENSAGEM[situacao.motivo] ?? 'Não deu para montar a prova agora.'
    throw createError({ statusCode: 409, statusMessage: texto })
  }

  // Sorteio: primeiro as que não foram respondidas nas últimas horas, depois as outras, cada grupo embaralhado.
  const regra = situacao.regra
  const rng = sorteador(`${assuntoId}:${Date.now()}`)
  const elegiveis = questoesElegiveis(pool, regra).map((q) => ({ q, chave: (q.recente ? 1 : 0) + rng() }))
  const escolhidas = elegiveis.sort((a, b) => a.chave - b.chave).slice(0, regra.questoes).map((x) => x.q)
  const minutos = minutosDaProvaDominio(regra)
  const config = { assuntos: [{ id: assuntoId, peso: 1 }], quantas: escolhidas.length, formato: 'dominio', ordem: 'misturada', minutos }
  const id = await criarExecucao({
    admin, supabase, usuario, titulo: `Prova de domínio: ${assunto.nome}`, modelo: 'personalizada', tipo: 'prova',
    prova: { formato: 'dominio', assuntoId, regra, minutos, relogio: 'sempre', ordem: 'misturada', fracos: false, quantas: escolhidas.length, assuntos: config.assuntos },
    terminaEm: new Date(Date.now() + minutos * 60000).toISOString(),
    blocos: [{ tipo: 'revisao', nome: 'Prova de domínio', config: configDoBlocoDaProva(config, ritmo), itens: escolhidas.map((q) => ({ id: q.id })) }],
  })
  return { id }
})
