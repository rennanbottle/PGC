import { describe, expect, it } from 'vitest'
import { BARRA_CELULAR, OUTRAS_SECOES, REDIRECIONAMENTOS, SECOES, secaoAtual, secoesComEstado, todasAsSecoesComEstado } from './navegacao.js'
import { avaliarPrimeirosPassos } from './primeirosPassos.js'

describe('secoesComEstado', () => {
  it('toda trava aponta para uma regra que existe', () => {
    for (const s of todasAsSecoesComEstado({})) {
      if (s.trava) expect(s.bloqueio !== undefined && s.bloqueio !== null, s.id).toBe(true)
    }
  })

  it('conta nova: Início, Agenda, Matérias e Questões abertas; o resto travado', () => {
    const travadas = secoesComEstado({}).filter((s) => s.bloqueada).map((s) => s.id)
    expect(travadas).toEqual(['materiais', 'revisar', 'prova', 'ranking'])
    const historico = todasAsSecoesComEstado({}).find((s) => s.id === 'historico')
    expect(historico.bloqueada).toBe(true)
  })

  it('criar uma matéria libera a Biblioteca', () => {
    const biblioteca = secoesComEstado({ materias: 1 }).find((s) => s.id === 'materiais')
    expect(biblioteca.nome).toBe('Biblioteca')
    expect(biblioteca.bloqueada).toBe(false)
  })

  it('10 questões liberam o Estudar, mesmo sem texto na Biblioteca', () => {
    const estudar = secoesComEstado({ materias: 1, questoesNoBanco: 10 }).find((s) => s.id === 'revisar')
    expect(estudar.bloqueada).toBe(false)
  })

  it('o menu tem três grupos e a barra do celular tem 4 seções que existem', () => {
    expect([...new Set(SECOES.map((s) => s.grupo))]).toEqual(['dia', 'conteudo', 'pratica'])
    expect(BARRA_CELULAR).toHaveLength(4)
    for (const id of BARRA_CELULAR) expect(SECOES.some((s) => s.id === id), id).toBe(true)
  })

  it('Histórico fica fora do menu e Desempenho virou parte do Ranking', () => {
    expect(SECOES.some((s) => s.id === 'historico')).toBe(false)
    expect(OUTRAS_SECOES.map((s) => s.id)).toContain('historico')
    expect(REDIRECIONAMENTOS['/desempenho']).toBe('/ranking')
  })

  it('reconhece a seção pelo começo do endereço', () => {
    expect(secaoAtual('/materias/fisica').id).toBe('materias')
    expect(secaoAtual('/materiais').id).toBe('materiais')
    expect(secaoAtual('/historico').id).toBe('historico')
    expect(secaoAtual('/perfil')).toBe(null)
  })
})

describe('avaliarPrimeirosPassos', () => {
  it('conta nova: nenhum feito, o próximo é criar a primeira matéria', () => {
    const p = avaliarPrimeirosPassos({})
    expect(p.feitos).toBe(0)
    expect(p.total).toBe(6)
    expect(p.proximo.id).toBe('materia')
  })

  it('avança conforme os números, sem exigir texto na Biblioteca', () => {
    const p = avaliarPrimeirosPassos({ materias: 1, questoesNoBanco: 10 })
    expect(p.feitos).toBe(2)
    expect(p.proximo.id).toBe('estudo')
    expect(p.proximo.acao.caminho).toBe('/revisar')
  })
})
