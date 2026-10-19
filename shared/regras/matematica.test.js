import { describe, expect, it } from 'vitest'
import { dividirMatematica, formulaValida, palavraMatematica, paraTex, semCifroes } from './matematica.js'

const marcado = (t) => dividirMatematica(t).map((p) => (p.tipo === 'mat' ? `[${p.tex}]` : p.texto)).join('')

describe('expressão em LaTeX', () => {
  it('fração em pé, com índice e sinal antes', () => {
    expect(paraTex('xv=-b/(2a)')).toBe('x_{v}=-\\dfrac{b}{2a}')
    expect(paraTex('yv=-Δ/(4a)')).toBe('y_{v}=-\\dfrac{\\Delta }{4a}')
    expect(paraTex('b/2a')).toBe('\\dfrac{b}{2a}')
    expect(paraTex('2a/3')).toBe('\\dfrac{2a}{3}')
    expect(paraTex('x=(-b±√Δ)/(2a)')).toBe('x=\\dfrac{-b\\pm \\sqrt{\\Delta }}{2a}')
  })
  it('potência, índice, raiz, graus e decimal com vírgula', () => {
    expect(paraTex('Δ=b²-4ac')).toBe('\\Delta ={b}^{2}-4ac')
    expect(paraTex('x1=5')).toBe('x_{1}=5')
    expect(paraTex('x^(n+1)')).toBe('{x}^{n+1}')
    expect(paraTex('x^-1')).toBe('{x}^{-1}')
    expect(paraTex('√(b²-4ac)')).toBe('\\sqrt{{b}^{2}-4ac}')
    expect(paraTex('90°')).toBe('{90}^{\\circ}')
    expect(paraTex('π≈3,14')).toBe('\\pi \\approx 3{,}14')
  })
  it('funções, produto e LaTeX escrito à mão', () => {
    expect(paraTex('sen(x)=1/2')).toBe('\\operatorname{sen} (x)=\\dfrac{1}{2}')
    expect(paraTex('Δ=(-9)²-4·1·20')).toBe('\\Delta ={(-9)}^{2}-4\\cdot 1\\cdot 20')
    expect(paraTex('x_v = -\\frac{b}{2a}')).toBe('{x}_{v}=-\\dfrac{b}{2a}')
  })
  it('barra sem nada embaixo fica como barra', () => {
    expect(paraTex('yv=-Δ/(')).toBe('y_{v}=-\\Delta /(')
  })
})

describe('onde há matemática no texto', () => {
  it('reconhece contas sem cifrão e deixa o resto igual', () => {
    expect(marcado('Considere f(x)=-x²+6x+2. O que ocorre?')).toBe('Considere [f(x)=-{x}^{2}+6x+2]. O que ocorre?')
    expect(marcado('Quando a>0 o vértice é mínimo.')).toBe('Quando [a>0] o vértice é mínimo.')
    expect(marcado('x² - 9x + 20 = 0 tem raízes x1=5 e x2=4.')).toBe('[{x}^{2}-9x+20=0] tem raízes [x_{1}=5] e [x_{2}=4].')
    expect(marcado('Se a = 1, b = -4 e c = 3, quanto vale Δ?')).toBe('Se [a=1], [b=-4] e [c=3], quanto vale Δ?')
  })
  it('não confunde dinheiro, unidade, data, código nem palavra', () => {
    expect(marcado('Custa R$ 80,00 e R$ 2,50 em 12/10/2026.')).toBe('Custa R$ 80,00 e R$ 2,50 em 12/10/2026.')
    expect(marcado('Andou 120 km ÷ 2 h = 60 km/h, e/ou mais.')).toBe('Andou 120 km ÷ 2 h = 60 km/h, e/ou mais.')
    expect(marcado('Em Python, if x == 3: imprime.')).toBe('Em Python, if x == 3: imprime.')
    expect(marcado('a parábola e o eixo')).toBe('a parábola e o eixo')
  })
  it('cifrões marcam a conta; o texto sem cifrões serve fora da tela', () => {
    expect(marcado('Calcule $x_v$ para $f(x) = 2x^2 - 16x + 7$.')).toBe('Calcule [{x}_{v}] para [f(x)=2{x}^{2}-16x+7].')
    expect(semCifroes('Calcule $x_v$ agora')).toBe('Calcule x_v agora')
  })
  it('palavra de matemática precisa de sinal', () => {
    expect(palavraMatematica('Δ<0')).toBe(true)
    expect(palavraMatematica('km/h')).toBe(false)
    expect(palavraMatematica('2x')).toBe(false)
    expect(palavraMatematica('ax²+bx+c=0')).toBe(true)
  })
})

describe('fórmula da conferência', () => {
  it('recusa a que saiu quebrada do PDF', () => {
    expect(formulaValida('xv=-b/2a')).toBe(true)
    expect(formulaValida('x = (-b ± √Δ)/(2a)')).toBe(true)
    expect(formulaValida('=- 2a b')).toBe(false)
    expect(formulaValida('=- 4a Δ')).toBe(false)
    expect(formulaValida('Δ b 4ac')).toBe(false)
  })
})
