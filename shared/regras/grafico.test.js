import { describe, expect, it } from 'vitest'
import { acharFuncao, analisarFuncao, descreverFuncao, grauDoPolinomio, lerFuncao } from './grafico.js'

describe('lerFuncao', () => {
  it('lê com nome, sem nome, com LaTeX e recusa outras letras', () => {
    expect(lerFuncao('f(x) = x^2 - 6x + 5').calcular(1)).toBe(0)
    expect(lerFuncao('y = 2x + 1').nome).toBe('y')
    expect(lerFuncao('x² - 4').calcular(2)).toBe(0)
    expect(lerFuncao('$f(x) = \\frac{1}{2}x^{2} - 2$').calcular(2)).toBe(0)
    expect(lerFuncao('f(x) = a x + b')).toBe(null)
    expect(lerFuncao('f(x) = ')).toBe(null)
  })
})

describe('acharFuncao', () => {
  it('acha a função no enunciado', () => {
    expect(acharFuncao('Qual é o yv de f(x) = x² − 6x + 5?')).toBe('f(x) = x² − 6x + 5')
    expect(acharFuncao('Dada a função $f(x)=-2x^2+8x-6$, determine o vértice.')).toBe('f(x)=-2x^2+8x-6'.replace('f(x)=', 'f(x) = '))
    expect(acharFuncao('A reta y = 3x - 2 passa por qual ponto?')).toBe('y = 3x - 2')
  })
  it('ignora texto sem função ou com grau maior', () => {
    expect(acharFuncao('Quanto é 2 + 2?')).toBe(null)
    expect(acharFuncao('Seja f(x) = x^3 - x.')).toBe(null)
  })
})

describe('analisarFuncao', () => {
  it('parábola: raízes, vértice e corte no eixo y', () => {
    const a = analisarFuncao(lerFuncao('x^2 - 6x + 5').calcular)
    expect(a.grau).toBe(2)
    expect(a.pontos).toEqual([
      { x: 1, y: 0, rotulo: 'raiz' },
      { x: 5, y: 0, rotulo: 'raiz' },
      { x: 3, y: -4, rotulo: 'vértice' },
      { x: 0, y: 5, rotulo: 'corta o eixo y' },
    ])
    expect(a.janela.xmin).toBeLessThan(0)
    expect(a.janela.xmax).toBeGreaterThan(5)
    expect(a.janela.ymin).toBeLessThan(-4)
    expect(descreverFuncao('f(x)', a)).toBe('f(x) é uma parábola com a concavidade para cima. Raízes em x = 1 e x = 5. Vértice em (3; -4). Corta o eixo y em y = 5.')
  })
  it('parábola sem raiz e reta', () => {
    const p = analisarFuncao(lerFuncao('x^2 + 1').calcular)
    expect(descreverFuncao('f(x)', p)).toMatch(/Não corta o eixo x/)
    const r = analisarFuncao(lerFuncao('2x - 4').calcular)
    expect(r.grau).toBe(1)
    expect(r.pontos[0]).toEqual({ x: 2, y: 0, rotulo: 'raiz' })
    expect(descreverFuncao('y', r)).toMatch(/^y é uma reta que sobe/)
  })
  it('grau pelo método das diferenças', () => {
    expect(grauDoPolinomio((x) => 7)).toBe(0)
    expect(grauDoPolinomio((x) => x ** 3)).toBe(3)
    expect(grauDoPolinomio((x) => 2 ** x)).toBe(null)
  })
})

describe('bloco grafico no texto', () => {
  it('vira um bloco com a linguagem grafico, na mesma linha ou em linhas próprias', async () => {
    const { dividirTexto } = await import('./textoRico.js')
    expect(dividirTexto('Veja: ```grafico f(x) = x^2 - 6x + 5```').at(-1)).toEqual({ tipo: 'bloco', linguagem: 'grafico', texto: 'f(x) = x^2 - 6x + 5' })
    expect(dividirTexto('```grafico\nf(x) = x^2\ny = 2x\n```')[0].texto).toBe('f(x) = x^2\ny = 2x')
  })
})
