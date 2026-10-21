import { describe, it, expect } from 'vitest'
import { avaliarDesbloqueios, estaLiberado } from './desbloqueios.js'

describe('desbloqueios', () => {
  it('conta nova só tem o básico', () => {
    const d = avaliarDesbloqueios({})
    expect(d.filter((x) => x.liberado)).toHaveLength(0)
    expect(estaLiberado('materiais', { materias: 1 })).toBe(true)
  })
  it('Estudar abre com 10 questões no banco, com ou sem texto na Biblioteca', () => {
    expect(estaLiberado('revisao', { questoesNoBanco: 9 })).toBe(false)
    expect(estaLiberado('revisao', { questoesNoBanco: 10 })).toBe(true)
    expect(estaLiberado('revisao', { materiaisAprovados: 0, bancosImportados: 0, questoesNoBanco: 30 })).toBe(true)
  })
  it('prova pede pouco: 2 estudos de 10 questões, 40 respostas e 4 tipos, sem texto nem assunto proficiente', () => {
    const quase = { revisoesCom10: 2, questoesRespondidas: 40, tiposUsados: 3 }
    expect(estaLiberado('prova', quase)).toBe(false)
    expect(estaLiberado('prova', { ...quase, tiposUsados: 4 })).toBe(true)
    expect(avaliarDesbloqueios({}).find((x) => x.id === 'prova').requisitos).toHaveLength(3)
  })
  it('progresso é a média dos requisitos', () => {
    const p = avaliarDesbloqueios({ revisoesCom10: 2, questoesRespondidas: 20 }).find((x) => x.id === 'prova')
    expect(p.progresso).toBe(50)
  })
  it('desempenho abre com dois estudos; o ranking geral continua com 3 de 5 questões ou mais', () => {
    expect(estaLiberado('desempenho', { revisoesConcluidas: 1 })).toBe(false)
    expect(estaLiberado('desempenho', { revisoesConcluidas: 2 })).toBe(true)
    expect(estaLiberado('ranking', { revisoesCom5: 2 })).toBe(false)
    expect(estaLiberado('ranking', { revisoesCom5: 3 })).toBe(true)
  })
})
