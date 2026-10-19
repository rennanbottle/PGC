import { describe, expect, it } from 'vitest'
import { PASSEIOS, passeioDaRota } from './guia.js'

describe('guia do guia', () => {
  it('acha o passeio pela rota, do mais específico ao mais geral', () => {
    expect(passeioDaRota('/inicio').id).toBe('inicio')
    expect(passeioDaRota('/materias').id).toBe('materias')
    expect(passeioDaRota('/materias/abc').id).toBe('materia')
    expect(passeioDaRota('/questoes/gerar').id).toBe('gerar')
    expect(passeioDaRota('/questoes').id).toBe('questoes')
    expect(passeioDaRota('/questoes/importar/1')).toBe(null)
    expect(passeioDaRota('/prova').id).toBe('prova')
    expect(passeioDaRota('/prova/nova').id).toBe('prova-nova')
    expect(passeioDaRota('/prova/abc')).toBe(null)
    expect(passeioDaRota('/prova/abc/resultado')).toBe(null)
    expect(passeioDaRota('/revisar/abc')).toBe(null)
    expect(passeioDaRota('/materias/nova')).toBe(null)
    expect(passeioDaRota('/assuntos/abc').id).toBe('assunto')
    expect(passeioDaRota('/entrar')).toBe(null)
  })
  it('todo passeio tem dicas e passos com alvo, título e texto curto', () => {
    for (const [id, p] of Object.entries(PASSEIOS)) {
      expect(p.dicas.length > 0, id).toBe(true)
      for (const passo of p.passos) {
        expect(Boolean(passo.alvo && passo.titulo && passo.texto), id).toBe(true)
        expect(passo.texto.length <= 140, `${id}: ${passo.alvo}`).toBe(true)
      }
    }
  })
})
