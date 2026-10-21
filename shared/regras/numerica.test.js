import { describe, expect, it } from 'vitest'
import { camposNumericos, corrigir, paraResponder, rotuloNumerico, textoDaCerta, textoDaResposta } from './sessao.js'
import { conferirQuestao } from './questoes.js'

const raizes = { tipo: 'numerica', enunciado: 'Quais são as raízes de $x^2 - 8x + 12 = 0$?', conteudo: { resposta: 2, tolerancia: 0, unidade: '', respostas: [{ rotulo: 'x_1', valor: 2 }, { rotulo: 'x_2', valor: 6 }] } }
const vertice = { tipo: 'numerica', enunciado: 'Calcule o xv do vértice da função f(x)=2x²-16x+7.', conteudo: { resposta: 4, tolerancia: 0, unidade: '' } }

describe('resposta numérica com rótulo', () => {
  it('rótulo vem da questão ou do enunciado antigo', () => {
    expect(rotuloNumerico(vertice)).toBe('x_v')
    expect(rotuloNumerico({ enunciado: 'Qual o valor de Δ para x²-4x+3?', conteudo: {} })).toBe('Δ')
    expect(rotuloNumerico({ enunciado: 'Quanto custa?', conteudo: { rotulo: 'P' } })).toBe('P')
    expect(rotuloNumerico({ enunciado: 'Ache xv e yv.', conteudo: {} })).toBe('')
    expect(paraResponder(vertice, 's').rotulo).toBe('x_v')
  })
  it('vários números: um campo por número, em qualquer ordem', () => {
    expect(camposNumericos(raizes.conteudo)).toEqual(['x_1', 'x_2'])
    expect(corrigir(raizes, 's', { valores: ['6', '2'] }).resultado).toBe('correta')
    expect(corrigir(raizes, 's', { valores: ['6', '5'] }).resultado).toBe('parcial')
    expect(corrigir(raizes, 's', { valores: ['6', '6'] }).resultado).toBe('parcial')
    expect(corrigir(raizes, 's', { valores: [] }).resultado).toBe('incorreta')
    expect(corrigir(vertice, 's', { valor: '4' }).resultado).toBe('correta')
  })
  it('textos da correção mostram o rótulo', () => {
    expect(textoDaCerta(raizes, 's')).toBe('$x_1$ = 2; $x_2$ = 6')
    expect(textoDaCerta(vertice, 's')).toBe('$x_v$ = 4')
    expect(textoDaResposta(raizes, 's', { valores: ['6', ''] })).toBe('$x_1$ = 6; $x_2$ = ?')
  })
  it('conferência aceita de 2 a 4 números', () => {
    expect(conferirQuestao(raizes).problemas?.some?.((p) => p.codigo === 'quantidade') ?? false).toBe(false)
  })
})

describe('conta digitada na lacuna', () => {
  it('b² e b^2 valem igual, com ou sem espaço', async () => {
    const { normalizarConta } = await import('./sessao.js')
    expect(normalizarConta('b² - 4ac')).toBe(normalizarConta('b^2-4ac'))
    expect(normalizarConta('x₁')).toBe('x1')
    expect(normalizarConta('2·a')).toBe('2*a')
  })
})
