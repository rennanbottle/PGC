import { describe, expect, it } from 'vitest'
import { dividirTexto, temCodigo } from './textoRico.js'

describe('dividirTexto', () => {
  it('texto sem código fica inteiro', () => {
    expect(dividirTexto('Quanto é 2 + 2?')).toEqual([{ tipo: 'texto', texto: 'Quanto é 2 + 2?' }])
    expect(dividirTexto('')).toEqual([])
  })

  it('separa código na linha', () => {
    expect(dividirTexto('O que faz `len(x)` em Python?')).toEqual([
      { tipo: 'texto', texto: 'O que faz ' },
      { tipo: 'codigo', texto: 'len(x)' },
      { tipo: 'texto', texto: ' em Python?' },
    ])
  })

  it('separa bloco com a linguagem', () => {
    const p = dividirTexto('O que aparece na tela?\n```python\nx = [1, 2]\nprint(len(x))\n```\nEscolha uma.')
    expect(p).toEqual([
      { tipo: 'texto', texto: 'O que aparece na tela?' },
      { tipo: 'bloco', linguagem: 'python', texto: 'x = [1, 2]\nprint(len(x))' },
      { tipo: 'texto', texto: 'Escolha uma.' },
    ])
  })

  it('bloco sem linguagem e sem quebra final', () => {
    expect(dividirTexto('```\nSELECT 1```')).toEqual([{ tipo: 'bloco', linguagem: '', texto: 'SELECT 1' }])
  })

  it('crase solta não vira código', () => {
    expect(dividirTexto('Use a crase ` com cuidado')).toEqual([{ tipo: 'texto', texto: 'Use a crase ` com cuidado' }])
    expect(temCodigo('sem código')).toBe(false)
    expect(temCodigo('com `x`')).toBe(true)
  })
})
