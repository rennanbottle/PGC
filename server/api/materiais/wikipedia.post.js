// POST /api/materiais/wikipedia
// Cria um material a partir de uma página da Wikipédia, do Wikilivros ou da Wikiversidade em português.
// Corpo: { titulo, materiaId, assuntoId?, fonte?: 'wikipedia' | 'wikilivros' | 'wikiversidade', secoes?: [índices] }.
// O texto (só as seções escolhidas) vira um TXT na pasta da pessoa, com o endereço e a licença guardados
// (CC BY-SA pede citar a fonte). Passa pela mesma leitura de qualquer texto, mas já sai aprovado: é um texto
// aberto e revisado, e a pessoa viu a prévia antes de trazer.
import { serverSupabaseClient, serverSupabaseUser } from '#supabase/server'
import { AGENTE, FONTES_WIKI, LICENCA_WIKIPEDIA, enderecoArtigo, enderecoPagina, montarTexto } from '#shared/regras/wikipedia.js'
import { extrairMaterial } from '../../utils/extracao.js'
import { UUID } from '../../utils/consultas.js'

export default defineEventHandler(async (event) => {
  const usuario = await serverSupabaseUser(event).catch(() => null)
  if (!usuario?.sub) throw createError({ statusCode: 401, statusMessage: 'Entre de novo para continuar.' })
  const corpo = (await readBody(event).catch(() => null)) ?? {}
  const titulo = String(corpo.titulo ?? '').trim().slice(0, 200)
  if (!titulo) throw createError({ statusCode: 400, statusMessage: 'Escolha um artigo.' })
  if (!UUID.test(corpo.materiaId ?? '')) throw createError({ statusCode: 400, statusMessage: 'Escolha a matéria.' })
  const assuntoId = UUID.test(corpo.assuntoId ?? '') ? corpo.assuntoId : null
  const fonte = FONTES_WIKI[corpo.fonte] ? corpo.fonte : 'wikipedia'
  const nome = FONTES_WIKI[fonte].nome
  const secoes = Array.isArray(corpo.secoes) ? corpo.secoes.filter((i) => Number.isInteger(i) && i >= 0 && i < 200).slice(0, 200) : null

  let pagina
  try {
    const r = await fetch(enderecoArtigo(titulo, fonte), { headers: { 'User-Agent': AGENTE, Accept: 'application/json' }, signal: AbortSignal.timeout(15000) })
    if (!r.ok) throw new Error(String(r.status))
    pagina = (await r.json())?.query?.pages?.[0]
  }
  catch {
    throw createError({ statusCode: 502, statusMessage: `${nome} não respondeu agora. Tente de novo.` })
  }
  if (!pagina || pagina.missing) throw createError({ statusCode: 404, statusMessage: 'Página não encontrada.' })
  const texto = montarTexto(pagina.extract, secoes).slice(0, 400000)
  if (texto.length < 300) throw createError({ statusCode: 422, statusMessage: secoes?.length ? 'As partes escolhidas são curtas demais para estudar. Marque mais partes.' : 'Essa página é curta demais para estudar. Escolha outra.' })

  const supabase = await serverSupabaseClient(event)
  const corpoTexto = `${pagina.title}\n\n${texto}\n`
  const { data: material, error } = await supabase.from('materiais').insert({
    materia_id: corpo.materiaId,
    titulo: `${pagina.title} (${nome})`.slice(0, 160),
    origem: 'arquivo',
    formato: 'txt',
    arquivo_nome: `${fonte}-${pagina.title}.txt`.slice(0, 200),
    tamanho_bytes: new TextEncoder().encode(corpoTexto).length,
    fonte_url: String(pagina.fullurl ?? enderecoPagina(pagina.title, fonte)).slice(0, 500),
    fonte_licenca: LICENCA_WIKIPEDIA,
    ia_permitida: 'todas',
  }).select('id, formato').single()
  if (error) throw createError({ statusCode: error.code === 'P0001' ? 409 : 500, statusMessage: error.code === 'P0001' ? error.message : 'Não deu para criar o texto.' })

  const caminho = `${usuario.sub}/${material.id}/original.txt`
  const { error: erroEnvio } = await supabase.storage.from('materiais').upload(caminho, new Blob([corpoTexto], { type: 'text/plain' }), { contentType: 'text/plain', upsert: true })
  if (erroEnvio) {
    await supabase.from('materiais').delete().eq('id', material.id)
    throw createError({ statusCode: 500, statusMessage: 'Não deu para guardar o texto. Tente de novo.' })
  }
  await supabase.from('materiais').update({ arquivo_caminho: caminho }).eq('id', material.id)
  const r = await extrairMaterial(supabase, { id: material.id, formato: 'txt', arquivo_caminho: caminho }, assuntoId, { aprovar: true })
  return { id: material.id, ...r }
})
