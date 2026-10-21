import { describe, expect, it } from 'vitest'
import { avaliarApelido, inicialDoNome } from './perfil.js'

describe('avaliarApelido', () => {
  it('vazio é permitido, porque o apelido é opcional', () => {
    for (const vazio of ['', '   ']) {
      const r = avaliarApelido(vazio)
      expect(r.valido).toBe(true)
      expect(r.vazio).toBe(true)
    }
  })

  it('aceita letras com acento, números, ponto, hífen e sublinhado', () => {
    for (const ok of ['Bia', 'João_77', 'ana.luz', 'k-9', 'Zé']) {
      expect(avaliarApelido(ok).valido, ok).toBe(true)
    }
  })

  it('recusa curto, longo, com espaço e com símbolos', () => {
    expect(avaliarApelido('x').valido).toBe(false)
    expect(avaliarApelido('a'.repeat(25)).valido).toBe(false)
    expect(avaliarApelido('com espaco').valido).toBe(false)
    expect(avaliarApelido('<b>oi</b>').valido).toBe(false)
    expect(avaliarApelido('x').mensagem.includes('pelo menos 2')).toBe(true)
  })

  it('conta 24 caracteres como o banco, sem espaços nas pontas', () => {
    expect(avaliarApelido(`  ${'a'.repeat(24)}  `).valido).toBe(true)
  })
})

describe('inicialDoNome', () => {
  it('devolve a primeira letra em maiúscula', () => {
    expect(inicialDoNome('  oliver')).toBe('O')
    expect(inicialDoNome('éder')).toBe('É')
  })
  it('devolve vazio quando não há nome', () => {
    expect(inicialDoNome('')).toBe('')
    expect(inicialDoNome('   ')).toBe('')
  })
})
