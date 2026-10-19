// Pontos do PGC. Pontos são jogo: medem esforço bem feito, nunca inteligência nem nota.
// Acertar o que era difícil PARA VOCÊ vale mais (usa a chance prevista pela proficiência);
// pensar em nível mais alto vale mais (Bloom); dica reduz; repetir cedo demais quase não rende (retenção FSRS);
// velocidade nunca pontua; resposta aberta com correção incerta não pontua.

import { RITMOS, RITMO_PADRAO } from './ritmo.js'

export const BASE = {
  multipla_escolha: 6, multipla_resposta: 8, vf_justificado: 7, verdadeiro_falso: 7, certo_errado: 6, assercao_razao: 9,
  lacuna_opcoes: 6, lacuna_digitada: 9, associar: 8, ordenar: 9, classificar: 8, numerica: 10,
  encontrar_erro: 10, texto_base: 9, prever_resultado: 10, cartao: 3, resposta_curta: 10, explicar: 12,
  passo_a_passo: 12, criar_exemplo: 12, escrever_codigo: 12,
}
export const MULT_BLOOM = [0, 1, 1.1, 1.25, 1.4, 1.5, 1.6]
export const HORAS_RECENTE = 20

export const fatorDesafio = (previsto) => 0.5 + 1.5 * (1 - previsto)

// Retenção da questão logo antes de responder de novo (null na primeira vez).
export function fatorEspacamento(retencaoAntes) {
  if (retencaoAntes == null) return 1
  if (retencaoAntes > 0.95) return 0.1
  return Math.min(1, Math.round((0.5 + (1 - retencaoAntes) * 5) * 100) / 100)
}

export function pontosResposta(r) {
  if (r.confianca === 'baixa') return 0
  if (r.resultado === 'incorreta') return r.leuCorrecao && !r.recente ? 1 : 0
  if (!r.resultado) return 0
  const cred = (r.resultado === 'parcial' ? 0.5 : 1) * Math.max(0.25, 1 - 0.25 * (r.dicas ?? 0))
  const valor = (BASE[r.tipo] ?? 6) * fatorDesafio(r.previsto) * MULT_BLOOM[r.bloom] * cred * fatorEspacamento(r.retencaoAntes) * (r.emProva ? 1.2 : 1)
  return Math.round(valor)
}

export function bonusSessao(itens, { agendada = false, prova = false } = {}) {
  const respondidas = itens.filter((i) => i.resultado).length
  const elegiveis = itens.filter((i) => !i.recente && fatorEspacamento(i.retencaoAntes) >= 0.5).length
  const detalhe = []
  if (respondidas >= 5 && elegiveis * 2 >= itens.length) detalhe.push({ motivo: 'conclusao', pontos: prova ? 25 : 5 + respondidas })
  if (agendada && respondidas >= 5) detalhe.push({ motivo: 'revisao_no_dia', pontos: 10 })
  let seq = 0
  let serie = 0
  for (const i of itens) {
    seq = i.resultado === 'correta' && !(i.dicas > 0) ? seq + 1 : 0
    if (seq > 3) serie += 2
  }
  if (serie) detalhe.push({ motivo: 'serie_sem_dica', pontos: Math.min(20, serie) })
  return { total: detalhe.reduce((s, d) => s + d.pontos, 0), detalhe }
}

export function bonusMarco(tipo, ritmo = RITMO_PADRAO) {
  if (tipo === 'proficiente') return 40
  if (tipo === 'dominado') return (RITMOS[ritmo] ?? RITMOS[RITMO_PADRAO]).bonusDominado
  if (tipo === 'recuperou') return 40
  return 0
}

export const bonusDiasSeguidos = (dias) => 5 * Math.min(dias, 10)
// Num conjunto, errar num bloco e acertar a mesma questão num bloco depois: 4 pontos cada, até 20 por execução.
export const bonusErrosRecuperados = (n) => Math.min(20, 4 * Math.max(0, n))

// Teto suave por dia: até 400 vale inteiro, de 400 a 800 vale metade, acima de 800 vale 10%.
export function aplicarTetoDiario(jaHoje, ganho) {
  let total = 0
  let resto = ganho
  let atual = jaHoje
  for (const [limite, fator] of [[400, 1], [800, 0.5], [Infinity, 0.1]]) {
    if (resto <= 0) break
    const usa = Math.min(Math.max(0, limite - atual), resto)
    total += usa * fator
    atual += usa
    resto -= usa
  }
  return Math.round(total)
}

// Nível da conta: pontos acumulados para chegar ao nível N = 60 * (N - 1)^1,6.
export const pontosParaNivel = (n) => Math.round(60 * Math.pow(n - 1, 1.6))
export function nivelPorPontos(pontos) {
  let n = 1
  while (pontosParaNivel(n + 1) <= pontos) n++
  return n
}
