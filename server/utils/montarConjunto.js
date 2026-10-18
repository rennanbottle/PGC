// Prévia e criação de uma execução em blocos (conjunto de estudo ou receita).
// Cada bloco é sorteado em ordem; por padrão uma questão usada num bloco não volta em outro. Bloco de Prática que
// não encontrou questões novas no banco pode completar com o material (sem IA) e, se a pessoa marcou, com a IA
// (uma geração por execução, que conta 1 das 30 operações do dia junto com o comentário do fim).
import { lerBlocos, resumoDoSorteio, sortearBlocos } from '#shared/regras/conjuntos.js'
import { nivelPorPontos } from '#shared/regras/pontos.js'
import { completarComIa, completarComMaterial } from './montarRevisao.js'
import { candidatas, thetasDe } from './revisoes.js'

export async function lerConjunto(supabase, lista) {
  const { data: e } = await supabase.rpc('resumo_estudo')
  const nivelConta = nivelPorPontos(e?.pontos ?? 0)
  const lido = lerBlocos(lista, { muitoDificil: (e?.proficientes ?? 0) >= 1, impossivel: (e?.dominados ?? 0) >= 1, disfarcar: nivelConta >= 5 })
  if (lido.erro) throw createError({ statusCode: 400, statusMessage: lido.erro })
  return { blocos: lido.blocos, estudo: e ?? {} }
}

async function poolDe(supabase, blocos) {
  const ids = [...new Set(blocos.flatMap((b) => b.assuntos.filter((a) => a.peso > 0).map((a) => a.id)))]
  return { pool: await candidatas(supabase, ids), thetas: await thetasDe(supabase, ids) }
}

export async function previaConjunto(supabase, blocos) {
  const { pool, thetas } = await poolDe(supabase, blocos)
  return resumoDoSorteio(blocos, sortearBlocos(blocos, pool, thetas, 'previa'))
}

// Escolhe as questões de verdade (completando Práticas se a pessoa pediu). Devolve { blocos: [...para criarExecucao], avisos, geracaoId }.
export async function montarConjunto(event, { supabase, usuario, blocos }) {
  let { pool, thetas } = await poolDe(supabase, blocos)
  let plano = sortearBlocos(blocos, pool, thetas, 'previa', { preencherComOutros: false })
  const avisos = []
  let geracaoId = null
  let mudou = false
  // Material primeiro (sem IA), em cada Prática que ficou curta.
  for (const [k, b] of blocos.entries()) {
    if (b.tipo !== 'pratica' || !b.completarMaterial) continue
    const deficit = Object.entries(plano[k].faltam).sort((x, y) => y[1] - x[1]).slice(0, 3)
    let novas = 0
    for (const [aid, falta] of deficit) novas += await completarComMaterial(supabase, usuario, aid, falta, b)
    if (novas) {
      mudou = true
      avisos.push(`${novas} ${novas === 1 ? 'questão nova saiu' : 'questões novas saíram'} do material, sem IA, para o bloco ${k + 1}.`)
    }
  }
  if (mudou) {
    ;({ pool, thetas } = await poolDe(supabase, blocos))
    plano = sortearBlocos(blocos, pool, thetas, 'previa', { preencherComOutros: false })
  }
  // IA: uma geração por execução, no primeiro bloco de Prática que ainda estiver curto e tiver pedido IA.
  const k = blocos.findIndex((b, i) => b.tipo === 'pratica' && b.completarIa && Object.keys(plano[i].faltam).length)
  if (k >= 0) {
    const [aid, falta] = Object.entries(plano[k].faltam).sort((x, y) => y[1] - x[1])[0]
    const r = await completarComIa(event, supabase, usuario, aid, falta, blocos[k])
    if (r.salvas) {
      avisos.push(`${r.salvas} ${r.salvas === 1 ? 'questão nova veio' : 'questões novas vieram'} da IA para o bloco ${k + 1}.`)
      ;({ pool, thetas } = await poolDe(supabase, blocos))
    }
    if (r.geracaoId) geracaoId = r.geracaoId
    if (r.aviso) avisos.push(r.aviso)
  }
  plano = sortearBlocos(blocos, pool, thetas, `${Date.now()}`, { preencherComOutros: true })

  const saida = []
  for (const [i, b] of blocos.entries()) {
    const p = plano[i]
    if (!p.adiado && !p.itens.length) {
      avisos.push(`O bloco ${i + 1}, ${b.nome}, ficou sem questões e saiu deste estudo.`)
      continue
    }
    if (!p.adiado && p.itens.length < b.quantidade) avisos.push(`Bloco ${i + 1}: pediu ${b.quantidade}, vieram ${p.itens.length}.`)
    saida.push({ tipo: b.tipo, nome: b.nome, config: b, itens: p.itens.map((q) => ({ id: q.id })), adiado: p.adiado })
  }
  if (!saida.some((b) => !b.adiado)) {
    throw createError({ statusCode: 409, statusMessage: 'Nenhuma questão pronta para esses assuntos e tipos. Gere questões, confira as que estão fora das revisões ou marque outros tipos.' })
  }
  return { blocos: saida, avisos, geracaoId }
}

export async function tituloDoConjunto(supabase, nome, blocos) {
  const ids = [...new Set(blocos.flatMap((b) => b.assuntos.map((a) => a.id)))].slice(0, 60)
  const { data } = ids.length ? await supabase.from('assuntos').select('materias(nome)').in('id', ids) : { data: [] }
  const materias = [...new Set((data ?? []).map((a) => a.materias?.nome).filter(Boolean))]
  return `${nome}, ${materias.slice(0, 3).join(' e ') || 'sem matéria'}`
}
