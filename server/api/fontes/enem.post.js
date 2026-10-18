// POST /api/fontes/enem
// Importa questões do Enem para o banco. Corpo: { ano, chaves: ['enem:2022:140:'], materiaId, assuntoId? }.
// Cada uma entra como "importada", com o gabarito oficial confirmado, a fonte ("Enem 2022, questão 140") e a
// figura, quando tem, guardada no bucket da pessoa. A mesma questão não entra duas vezes (chave).
import { serverSupabaseClient, serverSupabaseUser } from '#supabase/server'
import { ANOS_ENEM, MAX_IMPORTAR_ENEM, chaveEnem, questaoDoEnem } from '#shared/regras/enem.js'
import { sugerirAssunto } from '#shared/regras/importarBanco.js'
import { conferirQuestao } from '#shared/regras/questoes.js'
import { figuraDoEnem, provaDoEnem } from '../../utils/enem.js'
import { UUID } from '../../utils/consultas.js'

export default defineEventHandler(async (event) => {
  const usuario = await serverSupabaseUser(event).catch(() => null)
  if (!usuario?.sub) throw createError({ statusCode: 401, statusMessage: 'Entre de novo para continuar.' })
  const corpo = (await readBody(event).catch(() => null)) ?? {}
  const ano = Number(corpo.ano)
  if (!ANOS_ENEM.includes(ano)) throw createError({ statusCode: 400, statusMessage: 'Escolha um ano entre 2009 e 2023.' })
  if (!UUID.test(corpo.materiaId ?? '')) throw createError({ statusCode: 400, statusMessage: 'Escolha a matéria.' })
  const chaves = new Set((Array.isArray(corpo.chaves) ? corpo.chaves : []).filter((c) => typeof c === 'string' && c.startsWith(`enem:${ano}:`)).slice(0, MAX_IMPORTAR_ENEM))
  if (!chaves.size) throw createError({ statusCode: 400, statusMessage: 'Marque pelo menos uma questão.' })

  const supabase = await serverSupabaseClient(event)
  const { data: materia } = await supabase.from('materias').select('id, assuntos(id, nome, arquivado_em)').eq('id', corpo.materiaId).maybeSingle()
  if (!materia) throw createError({ statusCode: 404, statusMessage: 'Matéria não encontrada.' })
  const assuntos = (materia.assuntos ?? []).filter((a) => !a.arquivado_em)
  const assuntoFixo = UUID.test(corpo.assuntoId ?? '') && assuntos.some((a) => a.id === corpo.assuntoId) ? corpo.assuntoId : null

  const prova = await provaDoEnem(ano)
  const escolhidas = prova.filter((q) => chaves.has(chaveEnem(q))).map(questaoDoEnem).filter((r) => r.ok).map((r) => r.questao)
  if (!escolhidas.length) throw createError({ statusCode: 422, statusMessage: 'Nenhuma das questões marcadas pode ser importada.' })

  let importadas = 0
  let repetidas = 0
  let semFigura = 0
  for (const q of escolhidas) {
    const conferencia = conferirQuestao({ tipo: q.tipo, enunciado: q.enunciado, conteudo: q.conteudo }, { importada: true })
    const { data: linha, error } = await supabase.from('questoes').upsert({
      usuario_id: usuario.sub,
      materia_id: materia.id,
      assunto_id: assuntoFixo ?? sugerirAssunto(`${q.enunciado} ${q.conteudo.alternativas.map((a) => a.texto).join(' ')}`, assuntos)?.id ?? null,
      tipo: q.tipo,
      nivel: 2,
      bloom: 3,
      enunciado: q.enunciado,
      conteudo: q.conteudo,
      fonte: q.fonte,
      origem: 'importada',
      status: 'ativa',
      gabarito_confirmado: true,
      qualidade_aprovada: conferencia.aprovada,
      avisos_qualidade: conferencia.problemas,
      precisa_imagem: !!q.imagem,
      numero_original: q.numero,
      chave: q.chave,
    }, { onConflict: 'usuario_id,chave', ignoreDuplicates: true }).select('id').maybeSingle()
    if (error) {
      if (error.code === 'P0001') throw createError({ statusCode: 409, statusMessage: error.message })
      console.error('[enem] importar', error.code ?? 'erro')
      continue
    }
    if (!linha) {
      repetidas++
      continue
    }
    importadas++
    if (q.imagem) {
      const figura = await figuraDoEnem(q.imagem)
      const extensao = figura?.tipo === 'image/png' ? 'png' : figura?.tipo === 'image/webp' ? 'webp' : 'jpg'
      const caminho = `${usuario.sub}/${linha.id}/imagem.${extensao}`
      const envio = figura ? await supabase.storage.from('questoes').upload(caminho, new Blob([figura.dados], { type: figura.tipo }), { contentType: figura.tipo, upsert: true }) : { error: true }
      if (envio.error) semFigura++
      else await supabase.from('questoes').update({ imagem_caminho: caminho }).eq('id', linha.id)
    }
  }
  return { importadas, repetidas, semFigura }
})
