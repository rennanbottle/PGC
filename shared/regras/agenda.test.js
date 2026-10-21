import { describe, expect, it } from 'vitest'
import {
  agruparPorDia, contagem, rotuloCurto, datasDaSerie, diaDeHoje, diaPorExtenso, diaDaSemana, ehDia, formatarDuracao, formatarHora,
  gradeDoMes, inicioDaSemana, montarPlano, nomeDoMes, ocupacaoDosDias, progressoDoPlano, proximaProva, somarDias,
  somarMeses, validarEvento,
} from './agenda.js'

describe('datas', () => {
  it('usa o dia de Brasília', () => {
    expect(diaDeHoje(new Date('2026-10-09T02:00:00Z'))).toBe('2026-10-08')
    expect(diaDeHoje(new Date('2026-10-09T03:30:00Z'))).toBe('2026-10-09')
  })
  it('soma dias, meses e acha o domingo', () => {
    expect(somarDias('2026-10-31', 1)).toBe('2026-11-01')
    expect(somarDias('2026-03-01', -1)).toBe('2026-02-28')
    expect(somarMeses('2026-12', 1)).toBe('2027-01')
    expect(somarMeses('2026-01', -1)).toBe('2025-12')
    expect(diaDaSemana('2026-10-08')).toBe(4)
    expect(inicioDaSemana('2026-10-08')).toBe('2026-10-04')
    expect(inicioDaSemana('2026-10-04')).toBe('2026-10-04')
  })
  it('monta a grade do mês em semanas inteiras', () => {
    const grade = gradeDoMes('2026-10')
    expect(grade[0]).toBe('2026-09-27')
    expect(grade.at(-1)).toBe('2026-10-31')
    expect(grade.length % 7).toBe(0)
    expect(gradeDoMes('2026-08').length).toBe(42)
  })
  it('confere datas de verdade', () => {
    expect(ehDia('2026-02-28')).toBe(true)
    expect(ehDia('2026-02-30')).toBe(false)
    expect(ehDia('amanhã')).toBe(false)
  })
  it('escreve em português', () => {
    expect(nomeDoMes('2026-10')).toBe('Outubro de 2026')
    expect(diaPorExtenso('2026-10-08')).toBe('Quinta, 8 de outubro')
    expect(contagem('2026-10-08', '2026-10-08')).toBe('hoje')
    expect(contagem('2026-10-09', '2026-10-08')).toBe('amanhã')
    expect(contagem('2026-10-11', '2026-10-08')).toBe('faltam 3 dias')
    expect(contagem('2026-10-06', '2026-10-08')).toBe('há 2 dias')
    expect(formatarHora('14:30:00')).toBe('14h30')
    expect(formatarHora('09:00')).toBe('9h')
    expect(formatarDuracao(45)).toBe('45 min')
    expect(formatarDuracao(90)).toBe('1h30')
    expect(formatarDuracao(60)).toBe('1h')
  })
})

describe('itens', () => {
  it('valida título, data e repetição', () => {
    expect(validarEvento({ titulo: '  ', data: '2026-02-30' })).toEqual({ titulo: 'Escreva um título.', data: 'Escolha uma data.' })
    expect(validarEvento({ titulo: 'Prova', data: '2026-10-08', repetirAte: '2026-10-01' }).repetirAte).toBeTruthy()
    expect(validarEvento({ titulo: 'Prova', data: '2026-10-08', duracao_min: 2 }).duracao).toBeTruthy()
    expect(validarEvento({ titulo: 'Estudar', data: '2026-10-08', hora: '14:30', repetirAte: '2026-12-01' })).toEqual({})
  })
  it('encurta o texto para o calendário', () => {
    expect(rotuloCurto({ tipo: 'estudo', origem: 'plano', titulo: 'Estudar Funções do 2º grau' })).toBe('Funções do 2º grau')
    expect(rotuloCurto({ tipo: 'estudo', origem: 'plano', titulo: 'Revisão geral para Prova de Matemática' })).toBe('Revisão geral')
    expect(rotuloCurto({ tipo: 'prova', titulo: 'P2' }, 'Matemática')).toBe('Matemática')
    expect(rotuloCurto({ tipo: 'tarefa', titulo: 'Lista 3' })).toBe('Lista 3')
  })
  it('repete toda semana até o dia escolhido', () => {
    expect(datasDaSerie('2026-10-08', '2026-10-29')).toEqual(['2026-10-08', '2026-10-15', '2026-10-22', '2026-10-29'])
    expect(datasDaSerie('2026-10-08', '2026-10-28')).toHaveLength(3)
  })
  it('ordena o dia: sem hora, por hora, provas antes', () => {
    const mapa = agruparPorDia([
      { id: 1, data: '2026-10-09', hora: '14:00', tipo: 'estudo', titulo: 'b' },
      { id: 2, data: '2026-10-09', hora: null, tipo: 'tarefa', titulo: 'a' },
      { id: 3, data: '2026-10-09', hora: null, tipo: 'prova', titulo: 'z' },
      { id: 4, data: '2026-10-08', hora: '20:00', tipo: 'lembrete', titulo: 'c' },
    ])
    expect(Object.keys(mapa)).toEqual(['2026-10-08', '2026-10-09'])
    expect(mapa['2026-10-09'].map((e) => e.id)).toEqual([3, 2, 1])
  })
})

describe('plano até a prova', () => {
  const assuntos = [{ id: 'a', nome: 'Funções' }, { id: 'b', nome: 'Probabilidade' }, { id: 'c', nome: 'Geometria' }]
  const prova = { id: 'p', data: '2026-10-22', titulo: 'Prova de Matemática' }

  it('estuda cada assunto pelo menos duas vezes e termina com revisão geral', () => {
    const { sessoes, aviso } = montarPlano({ prova, assuntos, hoje: '2026-10-08', ritmo: 'normal' })
    expect(aviso).toBeNull()
    expect(sessoes.length).toBe(8)
    expect(new Set(sessoes.map((s) => s.data)).size).toBe(sessoes.length)
    expect(sessoes.every((s) => s.data >= '2026-10-08' && s.data < prova.data)).toBe(true)
    for (const a of assuntos) expect(sessoes.filter((s) => !s.final && s.assuntos.includes(a.id)).length).toBeGreaterThanOrEqual(2)
    expect(sessoes.slice(-2).every((s) => s.final && s.assuntos.length === 3)).toBe(true)
    expect(sessoes.at(-1).titulo).toBe('Revisão final para Prova de Matemática')
    expect(sessoes[0].titulo).toBe('Estudar Funções')
  })
  it('foge dos dias cheios quando há dia livre perto', () => {
    const ocupacao = { '2026-10-12': 2, '2026-10-15': 3 }
    const { sessoes } = montarPlano({ prova, assuntos, hoje: '2026-10-08', ocupacao })
    expect(sessoes.some((s) => s.data === '2026-10-12' || s.data === '2026-10-15')).toBe(false)
  })
  it('junta assuntos quando falta tempo e avisa', () => {
    const quatro = [...assuntos, { id: 'd', nome: 'Matrizes' }]
    const { sessoes, aviso } = montarPlano({ prova: { ...prova, data: '2026-10-11' }, assuntos: quatro, hoje: '2026-10-08' })
    expect(sessoes.map((s) => s.data)).toEqual(['2026-10-08', '2026-10-09', '2026-10-10'])
    for (const a of quatro) expect(sessoes.filter((s) => s.assuntos.includes(a.id)).length).toBeGreaterThanOrEqual(2)
    expect(aviso.startsWith('Pouco tempo')).toBe(true)
  })
  it('usa o ritmo para o número de estudos e funciona sem assuntos', () => {
    const longe = { ...prova, data: '2026-11-05' }
    const tranquilo = montarPlano({ prova: longe, hoje: '2026-10-08', ritmo: 'tranquilo', materiaNome: 'Matemática' })
    const focado = montarPlano({ prova: longe, hoje: '2026-10-08', ritmo: 'focado', materiaNome: 'Matemática' })
    expect(focado.sessoes.length).toBeGreaterThan(tranquilo.sessoes.length)
    expect(tranquilo.sessoes[0].titulo).toBe('Estudar Matemática')
    expect(tranquilo.sessoes[0].duracao_min).toBe(25)
  })
  it('não monta plano para prova de hoje', () => {
    expect(montarPlano({ prova: { ...prova, data: '2026-10-08' }, assuntos, hoje: '2026-10-08' }).sessoes).toEqual([])
  })
  it('mede o progresso, acha a próxima prova e a ocupação', () => {
    const eventos = [
      { id: 'p', tipo: 'prova', data: '2026-10-22', titulo: 'P' },
      { id: 'x', tipo: 'prova', data: '2026-10-01', titulo: 'Antiga' },
      { id: 's1', tipo: 'estudo', data: '2026-10-09', plano_de: 'p', concluido_em: '2026-10-09T20:00:00Z', titulo: 's1' },
      { id: 's2', tipo: 'estudo', data: '2026-10-12', plano_de: 'p', concluido_em: null, titulo: 's2' },
      { id: 't', tipo: 'trabalho', data: '2026-10-12', titulo: 'T' },
    ]
    const p = progressoDoPlano(eventos, 'p')
    expect([p.total, p.feitas, p.proximo.id]).toEqual([2, 1, 's2'])
    expect(proximaProva(eventos, '2026-10-08').id).toBe('p')
    expect(ocupacaoDosDias(eventos, 'p')).toEqual({ '2026-10-01': 2, '2026-10-12': 2 })
  })
})
