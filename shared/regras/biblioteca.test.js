import { describe, expect, it } from 'vitest'
import { dataDaFrase, glossario, linhaDoTempo, semelhanca, textosParecidos } from './biblioteca.js'

describe('glossario', () => {
  it('só definições, sem recusadas nem repetidas, em ordem alfabética', () => {
    const g = glossario([
      { tipo: 'definicao', termo: 'Vértice', definicao: 'ponto mais alto ou mais baixo da parábola.', pagina: 2 },
      { tipo: 'formula', termo: 'x = -b/2a', definicao: 'Vértice' },
      { tipo: 'definicao', termo: 'Discriminante', definicao: 'o valor b² - 4ac.', status: 'recusado' },
      { tipo: 'definicao', termo: 'Abscissa', definicao: 'a coordenada x de um ponto.' },
      { tipo: 'definicao', termo: 'vértice', definicao: 'repetido.' },
    ])
    expect(g.map((x) => x.termo)).toEqual(['Abscissa', 'Vértice'])
  })
})

describe('linha do tempo', () => {
  it('lê data completa, com barras e ano com contexto', () => {
    expect(dataDaFrase('A independência foi declarada em 7 de setembro de 1822, às margens do Ipiranga.').rotulo).toBe('7 de setembro de 1822')
    expect(dataDaFrase('A República foi proclamada em 15/11/1889 no Rio.')).toMatchObject({ ano: 1889, mes: 11, dia: 15 })
    expect(dataDaFrase('Em 1930, Getúlio Vargas chegou ao poder.')).toMatchObject({ ano: 1930, rotulo: '1930' })
    expect(dataDaFrase('1500: os portugueses chegam ao litoral.')).toMatchObject({ ano: 1500 })
  })
  it('não confunde quantidade com ano', () => {
    expect(dataDaFrase('A estrada tem 1200 km de extensão.')).toBe(null)
    expect(dataDaFrase('A cidade tinha de 1500 habitantes.')).toBe(null)
  })
  it('ordena da mais antiga para a mais nova e ignora trechos fora das questões', () => {
    const l = linhaDoTempo([
      { tipo: 'texto', pagina: 1, texto: 'Em 1930, Getúlio Vargas chegou ao poder. A independência foi em 7 de setembro de 1822, com Dom Pedro.' },
      { tipo: 'titulo', texto: 'Em 1500' },
      { tipo: 'texto', usar_em_questoes: false, texto: 'Em 1964, houve o golpe militar no Brasil.' },
    ])
    expect(l.map((e) => e.ano)).toEqual([1822, 1930])
    expect(l[0].pagina).toBe(1)
  })
})

describe('textos parecidos', () => {
  const a = [['parábola', 12], ['vértice', 8], ['discriminante', 6], ['raízes', 5]]
  const b = [['parábola', 10], ['vértice', 7], ['discriminante', 5], ['gráfico', 2]]
  const c = [['revolução', 9], ['burguesia', 6], ['parábola', 1]]
  it('semelhança alta para o mesmo tema e baixa para outro', () => {
    expect(semelhanca(a, b).valor).toBeGreaterThan(0.8)
    expect(semelhanca(a, c).valor).toBeLessThan(0.3)
    expect(semelhanca(a, b).comuns.slice(0, 2)).toEqual(['parábola', 'vértice'])
  })
  it('lista só os parecidos, com porcentagem e aviso de quase igual', () => {
    const r = textosParecidos(a, [{ id: 'b', titulo: 'B', frequencias: b }, { id: 'c', titulo: 'C', frequencias: c }])
    expect(r).toHaveLength(1)
    expect(r[0]).toMatchObject({ id: 'b', quaseIgual: true })
    expect(r[0].porcentagem).toBeGreaterThan(80)
  })
})
