// Mostra como as regras se comportam nos cenários de teste. Rode com: node scripts/simular-motor.js
import { avaliarAssunto, ESTADOS } from '../shared/regras/dominio.js'
import { CENARIOS } from '../shared/regras/cenarios.js'
import { RITMOS } from '../shared/regras/ritmo.js'
import { atualizar, B_INICIAL, chanceChute, probabilidade } from '../shared/regras/proficiencia.js'
import { revisar, retencao } from '../shared/regras/retencao.js'
import { pontosResposta, bonusSessao } from '../shared/regras/pontos.js'

const prova = (ritmo) => {
  const p = RITMOS[ritmo].dominado.provaDominio
  return p ? [{ questoes: p.questoes, certas: p.minimoCertas, nivelMinimo: p.nivelMinimo, usouDica: false }] : []
}

console.log('DOMÍNIO: estado por ritmo (com prova de domínio aprovada quando o ritmo exige)\n')
for (const [id, c] of Object.entries(CENARIOS)) {
  const linha = Object.keys(RITMOS).map((r) => {
    const a = avaliarAssunto(c.respostas, c.hoje, { ritmo: r, provasDominio: prova(r) })
    return `${RITMOS[r].nome}: ${ESTADOS[a.estado]}`
  })
  const n = avaliarAssunto(c.respostas, c.hoje)
  const falta = n.checklist.filter((x) => !x.ok).map((x) => `${x.texto} ${x.valor}/${x.meta}`)
  console.log(`${c.nome}\n  proficiência ${n.proficiencia}, retenção ${n.retencao}%\n  ${linha.join(' | ')}\n  falta no Normal (sem prova): ${falta.join('; ') || 'nada'}\n`)
}

console.log('Trajetória do estudo completo no ritmo Normal:')
const comp = CENARIOS.completo.respostas
for (const d of [0, 4, 9, 14, 19, 24]) {
  const a = avaliarAssunto(comp.filter((r) => r.dia <= d), d + 0.5)
  console.log(`  dia ${d}: ${ESTADOS[a.estado]}, proficiência ${a.proficiencia}, faltam ${a.faltam} critérios`)
}

console.log('\nPONTOS por sessão de 10 questões (pessoa começando o assunto)')
let seq = 0
const mk = (arr) => arr.map(([nivel, bloom, resultado, tipo = 'multipla_escolha', dicas = 0]) => ({ questaoId: `x${seq++}`, nivel, bloom, resultado, tipo, dicas }))
function pontosDaSessao(itensBase, { theta = 0, cartoes = new Map(), dia = 0, agendada = false } = {}) {
  let aluno = { theta, n: 10 }
  let total = 0
  const itens = []
  for (const it of itensBase) {
    const q = { tipo: it.tipo, alternativas: 5, b: B_INICIAL[it.nivel], m: 0 }
    const previsto = probabilidade(aluno.theta, q.b, chanceChute(q.tipo, 5))
    const c = cartoes.get(it.questaoId)
    const item = { ...it, previsto, retencaoAntes: c && c.acertou ? retencao(dia - c.ultimo, c.S) : null, leuCorrecao: true, recente: !!c && dia - c.ultimo < 20 / 24 }
    total += pontosResposta(item)
    itens.push(item)
    aluno = atualizar(aluno, q, it).aluno
    const nota = it.resultado === 'incorreta' ? 1 : it.resultado === 'parcial' || it.dicas ? 2 : 3
    cartoes.set(it.questaoId, { ...revisar(c, nota, dia), acertou: it.resultado !== 'incorreta' })
  }
  return total + bonusSessao(itens, { agendada }).total
}
const C = 'correta', E = 'incorreta', P = 'parcial'
const S = {
  dificeis: mk(Array.from({ length: 10 }, (_, i) => [3, i % 2 ? 4 : 3, i < 5 ? C : E, i % 2 ? 'encontrar_erro' : 'numerica'])),
  normais: mk([[2, 1, C], [2, 2, C], [2, 2, C], [2, 3, C, 'numerica'], [2, 2, E], [2, 1, C], [2, 3, C, 'ordenar'], [2, 2, P, 'lacuna_digitada'], [2, 2, C], [2, 4, E, 'encontrar_erro']]),
  faceis: mk(Array.from({ length: 10 }, () => [1, 1, C])),
  erradas: mk(Array.from({ length: 10 }, () => [2, 2, E])),
}
S.comDica = S.normais.map((i) => ({ ...i, questaoId: `d${seq++}`, dicas: i.resultado === C ? 1 : 0 }))
console.log(`  difíceis, 5 certas: ${pontosDaSessao(S.dificeis)}`)
console.log(`  normais, 8 certas: ${pontosDaSessao(S.normais)}`)
console.log(`  fáceis, 10 certas: ${pontosDaSessao(S.faceis)}`)
console.log(`  normais, 8 certas com dica: ${pontosDaSessao(S.comDica)}`)
console.log(`  todas erradas, lendo as correções: ${pontosDaSessao(S.erradas)}`)
{
  const cartoes = new Map()
  const g = [0, 1, 2, 3, 4].map((k) => pontosDaSessao(S.faceis, { cartoes, dia: k * 0.02 }))
  console.log(`  repetir as fáceis 5 vezes no mesmo dia: ${g.join(' + ')} = ${g.reduce((a, b) => a + b)}`)
}
{
  const cartoes = new Map()
  const g = [0, 3, 10, 25].map((d, k) => pontosDaSessao(S.normais, { cartoes, dia: d, theta: 0.3 * k, agendada: k > 0 }))
  console.log(`  rever as normais nos dias indicados (0, 3, 10, 25): ${g.join(' + ')} = ${g.reduce((a, b) => a + b)}`)
}
