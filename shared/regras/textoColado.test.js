import { describe, expect, it } from 'vitest'
import { latexParaTexto, limparTextoColado, pareceCodigo } from './textoColado.js'

describe('limparTextoColado', () => {
  it('junta a fórmula partida e recupera o expoente e o ≠', () => {
    const colado = 'pela lei de formação \nf(x)=ax \n2\n +bx+c, onde \na, \nb e \nc são números reais e \na\n\n=0. Ela possui domínio.'
    expect(limparTextoColado(colado)).toBe('pela lei de formação f(x)=ax² +bx+c, onde a, b e c são números reais e a ≠ 0. Ela possui domínio.')
    expect(limparTextoColado('do coeficiente \na: se \na>0, para cima.')).toBe('do coeficiente a: se a>0, para cima.')
  })
  it('tira caracteres invisíveis e mantém os parágrafos', () => {
    expect(limparTextoColado('O vértice​ é V.\n\nOutro parágrafo.')).toBe('O vértice é V.\n\nOutro parágrafo.')
  })
  it('não mexe em código', () => {
    const codigo = 'def soma(a, b):\n    total = a + b\n    return total\n\nprint(soma(1, 2))'
    expect(pareceCodigo(codigo)).toBe(true)
    expect(limparTextoColado(codigo)).toBe(codigo)
  })
  it('desfaz o índice e a fração copiados da resposta do Google', () => {
    const z = '\u200B'
    const colado = `As coordenadas (V=(x \nv\n${z}\n ,y \nv\n${z}\n )) são dadas por \nx \nv\n${z}\n =− \n2a\nb\n${z}\n  e \ny \nv\n${z}\n =− \n4a\nΔ\n${z}\n , onde $$\\Delta = b^2 - 4ac$$$ é o discriminante.`
    expect(limparTextoColado(colado)).toBe('As coordenadas (V=(xᵥ, yᵥ)) são dadas por xᵥ = −b/(2a) e yᵥ = −Δ/(4a), onde Δ = b² − 4ac é o discriminante.')
  })
  it('troca LaTeX por texto legível', () => {
    expect(latexParaTexto('x_v = -\\dfrac{b}{2a}')).toBe('xᵥ = −b/(2a)')
    expect(latexParaTexto('x = \\frac{-b \\pm \\sqrt{\\Delta}}{2a}')).toBe('x = (−b ± √Δ)/(2a)')
    expect(latexParaTexto('f: \\mathbb{R} \\to \\mathbb{R}, \\; a \\neq 0')).toBe('f: ℝ → ℝ, a ≠ 0')
    expect(latexParaTexto('\\sqrt[3]{x+1} \\geq 30^\\circ \\text{(pré-requisito)}')).toBe('³√(x+1) ≥ 30° (pré-requisito)')
    expect(limparTextoColado('Sua forma geral é:\n\n\\[\nf(x) = ax^2 + bx + c\n\\]\n\nonde \\(a \\neq 0\\) e $x_1$ é raiz.')).toBe('Sua forma geral é:\n\nf(x) = ax² + bx + c\n\nonde a ≠ 0 e x₁ é raiz.')
    expect(limparTextoColado('O tênis custa R$ 80,00 e a camisa R$ 50,00.')).toBe('O tênis custa R$ 80,00 e a camisa R$ 50,00.')
  })
  it('tira a marcação de Markdown e mantém os itens em linhas próprias', () => {
    const md = '### Representação gráfica\nO gráfico é uma **parábola**.  \n- Se a > 0, abre para cima.\n- Se a < 0, abre para baixo.\n\n---\n**1. Vértice**  \nÉ o ponto de *máximo* ou mínimo.'
    expect(limparTextoColado(md)).toBe('Representação gráfica\nO gráfico é uma parábola.\n• Se a > 0, abre para cima.\n• Se a < 0, abre para baixo.\n\n1. Vértice\nÉ o ponto de máximo ou mínimo.')
  })
  it('bloco de código entre crases fica como está', () => {
    const t = 'Veja:\n```python\nx = 2 ** 3\nprint( x )\n```\nPronto.'
    expect(limparTextoColado(t)).toBe(t)
  })
  it('texto comum continua igual', () => {
    const t = 'A função quadrática tem gráfico em parábola.\nA concavidade depende do sinal de a.'
    expect(limparTextoColado(t)).toBe(t)
  })
})
