import { describe, expect, it } from 'vitest'
import { montarPedidoTexto } from './pedidoTexto.js'

describe('montarPedidoTexto', () => {
  it('pede o texto sobre o tema, com as partes e o jeito de escrever', () => {
    const t = montarPedidoTexto({ tema: '  Função do  segundo grau ', materia: 'Matemática', area: 'matematica' })
    expect(t).toContain('sobre "Função do segundo grau", da matéria Matemática')
    expect(t).toContain('Técnicas e jeitos de resolver')
    expect(t).toContain('Não use LaTeX')
    expect(t.endsWith('Responda só com o texto, sem comentários antes ou depois.')).toBe(true)
  })
  it('muda o que pede conforme a área e não repete a matéria', () => {
    const p = montarPedidoTexto({ tema: 'Listas', materia: 'Python', area: 'programacao' })
    expect(p).toContain('três crases')
    expect(p.includes('LaTeX')).toBe(false)
    const h = montarPedidoTexto({ tema: 'História', materia: 'História', area: 'humanas' })
    expect(h).toContain('sobre "História", para')
    expect(h).toContain('Datas, nomes, termos')
  })
  it('sem tema, usa o assunto ou a matéria', () => {
    expect(montarPedidoTexto({ assunto: 'Crase', materia: 'Português' })).toContain('sobre "Crase", da matéria Português')
  })
})
