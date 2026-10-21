import { describe, it, expect } from 'vitest'
import { pontosResposta, bonusSessao, aplicarTetoDiario, fatorEspacamento, nivelPorPontos, pontosParaNivel, bonusMarco } from './pontos.js'

const certa = { tipo: 'multipla_escolha', bloom: 1, resultado: 'correta', previsto: 0.5, retencaoAntes: null }

describe('pontos por resposta', () => {
  it('acertar o improvável vale mais que o provável', () => {
    expect(pontosResposta({ ...certa, previsto: 0.2 })).toBeGreaterThan(pontosResposta({ ...certa, previsto: 0.9 }))
  })
  it('pensar em nível mais alto vale mais', () => {
    expect(pontosResposta({ ...certa, bloom: 4 })).toBeGreaterThan(pontosResposta({ ...certa, bloom: 1 }))
  })
  it('cada dica tira pontos', () => {
    const sem = pontosResposta(certa)
    expect(pontosResposta({ ...certa, dicas: 1 })).toBeLessThan(sem)
    expect(pontosResposta({ ...certa, dicas: 2 })).toBeLessThan(pontosResposta({ ...certa, dicas: 1 }))
  })
  it('correção incerta não pontua', () => {
    expect(pontosResposta({ ...certa, tipo: 'explicar', confianca: 'baixa' })).toBe(0)
  })
  it('erro vale 1 só se leu a correção e não repetiu hoje', () => {
    expect(pontosResposta({ ...certa, resultado: 'incorreta' })).toBe(0)
    expect(pontosResposta({ ...certa, resultado: 'incorreta', leuCorrecao: true })).toBe(1)
    expect(pontosResposta({ ...certa, resultado: 'incorreta', leuCorrecao: true, recente: true })).toBe(0)
  })
  it('revisar cedo demais rende 10%, no ponto certo rende tudo', () => {
    expect(fatorEspacamento(0.99)).toBe(0.1)
    expect(fatorEspacamento(0.9)).toBe(1)
    expect(fatorEspacamento(null)).toBe(1)
  })
})

describe('bônus e limites', () => {
  const itens = Array.from({ length: 10 }, () => ({ resultado: 'correta', retencaoAntes: null }))
  it('conclusão dá 5 + 1 por resposta', () => {
    expect(bonusSessao(itens).detalhe.find((d) => d.motivo === 'conclusao').pontos).toBe(15)
  })
  it('repetir a sessão nas últimas 20 horas não dá bônus de conclusão', () => {
    const repetida = itens.map((i) => ({ ...i, recente: true }))
    expect(bonusSessao(repetida).detalhe.some((d) => d.motivo === 'conclusao')).toBe(false)
  })
  it('série sem dica tem teto de 20', () => {
    const muitas = Array.from({ length: 30 }, () => ({ resultado: 'correta' }))
    expect(bonusSessao(muitas).detalhe.find((d) => d.motivo === 'serie_sem_dica').pontos).toBe(20)
  })
  it('teto suave por dia', () => {
    expect(aplicarTetoDiario(0, 100)).toBe(100)
    expect(aplicarTetoDiario(380, 100)).toBe(60)
    expect(aplicarTetoDiario(900, 100)).toBe(10)
  })
  it('domínio no ritmo obcecado vale mais', () => {
    expect(bonusMarco('dominado', 'obcecado')).toBeGreaterThan(bonusMarco('dominado', 'normal'))
  })
  it('níveis', () => {
    expect(nivelPorPontos(0)).toBe(1)
    expect(nivelPorPontos(pontosParaNivel(5))).toBe(5)
    expect(nivelPorPontos(pontosParaNivel(5) - 1)).toBe(4)
  })
})

describe('erros recuperados no conjunto', () => {
  it('4 por questão, até 20', async () => {
    const { bonusErrosRecuperados } = await import('./pontos.js')
    expect([0, 1, 4, 9].map(bonusErrosRecuperados)).toEqual([0, 4, 16, 20])
  })
})
