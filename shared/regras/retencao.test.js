import { describe, it, expect } from 'vitest'
import { retencao, revisar } from './retencao.js'
import { probabilidade, escala, atualizar } from './proficiencia.js'

describe('retenção (FSRS)', () => {
  it('no dia igual à estabilidade a chance de lembrar é 90%', () => {
    expect(retencao(10, 10)).toBeCloseTo(0.9, 3)
  })
  it('acertar de novo aumenta a estabilidade; errar diminui', () => {
    const c = revisar(null, 3, 0)
    expect(revisar(c, 3, 3).S).toBeGreaterThan(c.S)
    const forte = revisar(revisar(c, 3, 3), 3, 10)
    expect(revisar(forte, 1, 30).S).toBeLessThan(forte.S)
  })
})

describe('proficiência', () => {
  it('chute em 5 alternativas nunca fica abaixo de 20%', () => {
    expect(probabilidade(-10, 0, 0.2)).toBeGreaterThanOrEqual(0.2)
  })
  it('escala de 0 a 1000 com média 500', () => {
    expect(escala(0)).toBe(500)
    expect(escala(9)).toBe(1000)
  })
  it('acerto sobe a habilidade e baixa a dificuldade da questão', () => {
    const q = { tipo: 'numerica', b: 0.5, m: 0 }
    const out = atualizar({ theta: 0, n: 0 }, q, { resultado: 'correta' })
    expect(out.aluno.theta).toBeGreaterThan(0)
    expect(out.questao.b).toBeLessThan(0.5)
  })
})
