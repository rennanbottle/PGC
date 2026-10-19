import { describe, expect, it } from 'vitest'
import { corMateria, ehHex, hexParaHsv, hsvParaHex } from './cores.js'

describe('cores das matérias', () => {
  it('nome vira o token; cor livre vira a cor misturada; o resto vira cinza', () => {
    expect(corMateria('verde')).toBe('var(--marca-verde)')
    expect(corMateria('#12ab34')).toBe('color-mix(in oklab, #12ab34 85%, var(--tinta))')
    expect(corMateria('qualquer')).toBe('var(--marca-cinza)')
    expect(corMateria(undefined)).toBe('var(--marca-cinza)')
    expect(ehHex('#ABCDEF')).toBe(true)
    expect(ehHex('#abc')).toBe(false)
  })
  it('HSV e hexadecimal vão e voltam', () => {
    for (const hex of ['#ff0000', '#00ff00', '#2f5bff', '#123456', '#ffffff', '#000000']) {
      expect(hsvParaHex(hexParaHsv(hex))).toBe(hex)
    }
    expect(hsvParaHex({ h: 0, s: 1, v: 1 })).toBe('#ff0000')
  })
})
