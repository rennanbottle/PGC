import { describe, expect, it } from 'vitest'
import { CATALOGO, acharMateria, assuntosSugeridos, materiasParaComecar, normalizar, sugerirMateria } from './catalogo.js'
import { AREAS_MATERIA, CORES, LIMITES } from './materias.js'

describe('catálogo', () => {
  it('tem umas 30 matérias com área, cor e 8 a 12 assuntos', () => {
    expect(CATALOGO.length).toBeGreaterThanOrEqual(30)
    const areas = new Set(AREAS_MATERIA.map((a) => a.id))
    const cores = new Set(CORES.map((c) => c.id))
    for (const m of CATALOGO) {
      expect(areas.has(m.area)).toBe(true)
      expect(cores.has(m.cor)).toBe(true)
      expect(m.assuntos.length).toBeGreaterThanOrEqual(8)
      expect(m.assuntos.length).toBeLessThanOrEqual(12)
      expect(new Set(m.assuntos.map(normalizar)).size).toBe(m.assuntos.length)
      expect(m.assuntos.every((a) => a.length <= LIMITES.nomeAssunto)).toBe(true)
      expect(m.aliases.every((a) => a === normalizar(a))).toBe(true)
    }
    expect(new Set(CATALOGO.map((m) => m.id)).size).toBe(CATALOGO.length)
  })
})

describe('sugerirMateria', () => {
  it('ignora acentos e maiúsculas e põe o começo do nome primeiro', () => {
    expect(sugerirMateria('port')[0].nome).toBe('Português')
    expect(sugerirMateria('PORTUGUÊS')[0].nome).toBe('Português')
    expect(sugerirMateria('quimica')[0].nome).toBe('Química')
  })

  it('acha pelo apelido', () => {
    expect(sugerirMateria('js')[0].nome).toBe('JavaScript')
    expect(sugerirMateria('programação')[0].nome).toBe('Lógica de programação')
    expect(sugerirMateria('sql')[0].nome).toBe('Banco de dados')
  })

  it('acha pelo começo de uma palavra, depois do começo do nome', () => {
    const nomes = sugerirMateria('fis').map((m) => m.nome)
    expect(nomes[0]).toBe('Física')
    expect(nomes).toContain('Educação Física')
  })

  it('vazio ou sem nada parecido devolve lista vazia; respeita o limite', () => {
    expect(sugerirMateria('')).toEqual([])
    expect(sugerirMateria('   ')).toEqual([])
    expect(sugerirMateria('xyzw')).toEqual([])
    expect(sugerirMateria('a', 3)).toHaveLength(3)
  })
})

describe('assuntosSugeridos', () => {
  it('devolve os assuntos na ordem da escola', () => {
    const lista = assuntosSugeridos('português')
    expect(lista[0]).toBe('Ortografia e acentuação')
    expect(lista.length).toBeGreaterThanOrEqual(8)
  })

  it('tira os que a pessoa já tem, sem ligar para acentos', () => {
    const lista = assuntosSugeridos('Matemática', ['porcentagem', 'Trigonometria'])
    expect(lista).not.toContain('Porcentagem')
    expect(lista).not.toContain('Trigonometria')
    expect(lista).toContain('Geometria plana')
  })

  it('entende "Matemática 2" e "Física I", mas não inventa', () => {
    expect(acharMateria('Matemática 2')?.id).toBe('matematica')
    expect(acharMateria('Física I')?.id).toBe('fisica')
    expect(acharMateria('Química orgânica')).toBe(null)
    expect(assuntosSugeridos('Projeto integrador')).toEqual([])
  })
})

describe('materiasParaComecar', () => {
  it('mistura as comuns com as das áreas de interesse e pula as que já existem', () => {
    const lista = materiasParaComecar(['programacao'], ['Matemática'], 6)
    const nomes = lista.map((m) => m.nome)
    expect(nomes).toHaveLength(6)
    expect(nomes).not.toContain('Matemática')
    expect(nomes[0]).toBe('Português')
    expect(lista.some((m) => m.area === 'programacao')).toBe(true)
  })
})
