import { describe, it, expect } from 'vitest'
import { contagem, diaISO, diasEntre, proximoPasso, somarDias, variacao } from './inicio.js'

describe('datas do início', () => {
  it('usa o dia de Brasília', () => {
    // 02:00 UTC do dia 9 ainda é dia 8 em Brasília.
    expect(diaISO(new Date('2026-10-09T02:00:00Z'))).toBe('2026-10-08')
    expect(diaISO(new Date('2026-10-08T15:00:00Z'))).toBe('2026-10-08')
  })
  it('soma dias atravessando o mês', () => {
    expect(somarDias('2026-10-30', 3)).toBe('2026-11-02')
    expect(somarDias('2026-03-01', -1)).toBe('2026-02-28')
  })
  it('conta os dias até a data', () => {
    expect(diasEntre('2026-10-08', '2026-10-13')).toBe(5)
    expect(contagem('2026-10-08', '2026-10-08')).toBe('Hoje')
    expect(contagem('2026-10-09', '2026-10-08')).toBe('Amanhã')
    expect(contagem('2026-10-13', '2026-10-08')).toBe('Em 5 dias')
    expect(contagem('2026-10-01', '2026-10-08')).toBe('Já passou')
  })
})

describe('variação da semana', () => {
  it('diz quanto mudou', () => {
    expect(variacao(112, 69)).toEqual({ texto: '+43 que a semana passada', sentido: 1 })
    expect(variacao(10, 25)).toEqual({ texto: '-15 que a semana passada', sentido: -1 })
    expect(variacao(8, 8).sentido).toBe(0)
    expect(variacao(0, 0).texto).toBe('Nada nas duas semanas')
  })
})

describe('próximo passo', () => {
  const passos = { proximo: { id: 'questoes', texto: 'Ter 10 questões no banco', acao: { texto: 'Gerar questões', caminho: '/questoes/gerar' } } }
  it('estudo pausado vem primeiro', () => {
    const e = { em_andamento: { id: 'x' }, vencidas: 9 }
    expect(proximoPasso({ estudo: e, passos }).tipo).toBe('continuar')
  })
  it('depois as revisões vencidas', () => {
    expect(proximoPasso({ estudo: { vencidas: 3 }, passos })).toEqual({ tipo: 'revisar', vencidas: 3 })
  })
  it('assunto pronto para a prova de domínio vem antes do primeiro passo e depois das vencidas', () => {
    const prontos = [{ id: 'a1', nome: 'Funções' }, { id: 'a2', nome: 'Vetores' }]
    expect(proximoPasso({ estudo: {}, passos, prontos })).toEqual({ tipo: 'dominio', assunto: prontos[0], total: 2 })
    expect(proximoPasso({ estudo: { vencidas: 2 }, passos, prontos }).tipo).toBe('revisar')
  })
  it('depois o primeiro passo com ação', () => {
    expect(proximoPasso({ estudo: {}, passos }).tipo).toBe('passo')
  })
  it('passo sem ação cai na meta do dia', () => {
    const semAcao = { proximo: { id: 'proficiente', texto: 'Deixar um assunto proficiente' } }
    expect(proximoPasso({ estudo: { hoje: 12 }, passos: semAcao, meta: 20 })).toEqual({ tipo: 'meta', faltam: 8 })
  })
  it('meta batida e nada pendente', () => {
    expect(proximoPasso({ estudo: { hoje: 25 }, passos: { proximo: null }, meta: 20 }).tipo).toBe('feito')
  })
})

describe('prova em andamento', () => {
  it('vem antes do estudo pausado', () => {
    const r = proximoPasso({ estudo: { prova_em_andamento: { id: 'p', titulo: 'Simulado' }, em_andamento: { id: 'e' } } })
    expect(r.tipo).toBe('prova')
    expect(r.prova.id).toBe('p')
  })
})
