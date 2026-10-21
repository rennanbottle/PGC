import { describe, expect, it } from 'vitest'
import { paginasVisiveis, totalDePaginas } from './paginacao.js'

describe('paginação', () => {
  it('poucas páginas aparecem todas', () => {
    expect(paginasVisiveis(1, 1)).toEqual([1])
    expect(paginasVisiveis(7, 4)).toEqual([1, 2, 3, 4, 5, 6, 7])
  })
  it('muitas páginas: primeira, vizinhas da atual e última', () => {
    expect(paginasVisiveis(12, 1)).toEqual([1, 2, 3, 4, 5, '...', 12])
    expect(paginasVisiveis(12, 6)).toEqual([1, '...', 5, 6, 7, '...', 12])
    expect(paginasVisiveis(12, 12)).toEqual([1, '...', 8, 9, 10, 11, 12])
  })
  it('página fora do limite fica no limite', () => {
    expect(paginasVisiveis(12, 99)).toEqual(paginasVisiveis(12, 12))
    expect(paginasVisiveis(0, 0)).toEqual([1])
  })
  it('total de páginas', () => {
    expect(totalDePaginas(0, 50)).toBe(1)
    expect(totalDePaginas(50, 50)).toBe(1)
    expect(totalDePaginas(51, 50)).toBe(2)
  })
})
