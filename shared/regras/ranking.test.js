import { describe, it, expect } from 'vitest'
import { acertoDe, comparacaoAcerto, conquistas, conquistasNovas, minhaLinhaFora, periodoValido, podio, progressoNivel } from './ranking.js'

const sem = (respondidas, acerto) => ({ respondidas, acerto })

describe('acerto', () => {
  it('pondera pelo número de respostas', () => {
    expect(acertoDe([sem(10, 50), sem(30, 90)])).toBe(80)
    expect(acertoDe([sem(0, null)])).toBe(null)
  })
  it('compara as últimas 4 semanas com as 4 anteriores', () => {
    const semanas = [sem(10, 60), sem(10, 60), sem(0, null), sem(10, 60), sem(20, 70), sem(20, 80), sem(20, 70), sem(20, 80)]
    expect(comparacaoAcerto(semanas)).toEqual({ atual: 75, anterior: 60, diferenca: 15 })
    expect(comparacaoAcerto([sem(5, 40)]).diferenca).toBe(null)
  })
})

describe('nível', () => {
  it('mostra quanto falta para o próximo', () => {
    const p = progressoNivel(1340)
    expect(p.nivel).toBe(7)
    expect(p.falta).toBe(p.proximo - 1340)
    expect(p.fracao).toBeGreaterThan(0.9)
    expect(progressoNivel(0).nivel).toBe(1)
    expect(progressoNivel(0).feito).toBe(0)
  })
})

describe('conquistas', () => {
  const desempenho = { totais: { sessoes: 12, respondidas: 268, melhor_sequencia: 5, dias_estudados: 31 }, semanas: [sem(25, 84)], proficiencias: {} }
  it('marca as ganhas e o progresso das outras', () => {
    const lista = conquistas(desempenho, { pontos: 1340 })
    const por = Object.fromEntries(lista.map((c) => [c.id, c]))
    expect(por.dez_estudos.ganha).toBe(true)
    expect(por.cem_questoes.ganha).toBe(true)
    expect(por.mil_questoes.ganha).toBe(false)
    expect(por.mil_questoes.atual).toBe(268)
    expect(por.sete_dias.ganha).toBe(false)
    expect(por.sete_dias.atual).toBe(5)
    expect(por.semana_afiada.ganha).toBe(true)
    expect(por.nivel_5.ganha).toBe(true)
    expect(por.primeiro_dominado.ganha).toBe(false)
  })
  it('só comemora as que ainda não foram vistas', () => {
    const lista = conquistas(desempenho, { pontos: 1340 })
    const novas = conquistasNovas(lista, ['primeiro_estudo', 'dez_estudos'])
    expect(novas).toContain('cem_questoes')
    expect(novas).not.toContain('dez_estudos')
    expect(novas).not.toContain('mil_questoes')
  })
})

describe('pódio e lista', () => {
  const lista = [
    { posicao: 1, apelido: 'bia', pontos: 900 },
    { posicao: 2, apelido: 'caio', pontos: 700 },
    { posicao: 3, apelido: 'duda', pontos: 500 },
    { posicao: 4, apelido: 'eu', pontos: 300, eu: true },
  ]
  it('põe o primeiro no meio', () => {
    expect(podio(lista).map((l) => l.apelido)).toEqual(['caio', 'bia', 'duda'])
    expect(podio(lista.slice(0, 1)).map((l) => l.apelido)).toEqual(['bia'])
    expect(podio([{ posicao: 1, apelido: 'a' }, { posicao: 1, apelido: 'b' }]).map((l) => l.altura)).toEqual([1, 1])
  })
  it('prende a linha da pessoa quando ela está fora das mostradas', () => {
    expect(minhaLinhaFora(lista, { posicao: 4, pontos: 300 }, 3)).toEqual({ posicao: 4, pontos: 300 })
    expect(minhaLinhaFora(lista, { posicao: 4, pontos: 300 }, 10)).toBe(null)
    expect(minhaLinhaFora(lista, { posicao: null, pontos: 0 }, 3)).toBe(null)
  })
  it('aceita só períodos conhecidos', () => {
    expect(periodoValido('mes')).toBe('mes')
    expect(periodoValido('ano')).toBe('semana')
  })
})

import { comparacaoPontos, diaMes, diasComEstudo, posicaoSe, segmentosProficiencia, serieAcerto } from './ranking.js'

describe('partes novas da aba Você', () => {
  it('monta a série de acerto só com semanas que tiveram respostas', () => {
    expect(serieAcerto([{ respondidas: 0, acerto: null }, { respondidas: 10, acerto: 70 }, { respondidas: 5, acerto: 80 }])).toEqual([70, 80])
  })
  it('compara os pontos da semana atual com a anterior', () => {
    expect(comparacaoPontos([{ pontos: 100 }, { pontos: 140 }])).toEqual({ atual: 140, anterior: 100, diferenca: 40 })
    expect(comparacaoPontos([{ pontos: 30 }])).toEqual({ atual: 30, anterior: null, diferenca: null })
  })
  it('escreve o dia curto e conta dias com estudo', () => {
    expect(diaMes('2026-09-28')).toBe('28/9')
    expect(diaMes(null)).toBe('')
    expect(diasComEstudo([{ n: 0 }, { n: 3 }, { n: 1 }])).toBe(2)
  })
  it('quebra a situação dos assuntos em pedaços, do melhor para o começo', () => {
    const { total, segmentos } = segmentosProficiencia({ iniciando: 2, dominado: 1, proficiente: 1, estranho: 9 })
    expect(total).toBe(4)
    expect(segmentos.map((s) => s.estado)).toEqual(['dominado', 'proficiente', 'iniciando'])
    expect(segmentos[2].fracao).toBe(0.5)
    expect(segmentosProficiencia({}).total).toBe(0)
  })
  it('diz o lugar que a pessoa teria no ranking', () => {
    const lista = [{ pontos: 300 }, { pontos: 200 }, { pontos: 120 }, { pontos: 50 }]
    expect(posicaoSe(lista, 150)).toBe(3)
    expect(posicaoSe(lista, 120)).toBe(3)
    expect(posicaoSe(lista, 500)).toBe(1)
    expect(posicaoSe([], 0)).toBe(1)
  })
})
