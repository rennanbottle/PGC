import { describe, it, expect } from 'vitest'
import {
  agruparPorDia, diaDe, diasEntre, filtrarEventos, inicioDoMes, montarLinhaDoTempo, quandoFoi, respostasPorDia,
  resumoDoMes, rotuloDoDia, somarDias,
} from './historico.js'

// Só os campos do modelo (o vitest teria toMatchObject).
const parte = (o, modelo) => Object.fromEntries(Object.keys(modelo).map((k) => [k, o?.[k]]))

describe('datas no horário de Brasília', () => {
  it('converte o instante para o dia de Brasília', () => {
    expect(diaDe('2026-10-09T02:00:00Z')).toBe('2026-10-08')
    expect(diaDe('2026-10-09T03:00:00Z')).toBe('2026-10-09')
    expect(diaDe(null)).toBe(null)
    expect(diaDe('não é data')).toBe(null)
  })
  it('soma dias e conta a distância', () => {
    expect(somarDias('2026-10-01', -1)).toBe('2026-09-30')
    expect(somarDias('2026-12-31', 1)).toBe('2027-01-01')
    expect(diasEntre('2026-09-28', '2026-10-08')).toBe(10)
  })
  it('acha o começo do mês, inclusive na virada do ano', () => {
    expect(inicioDoMes('2026-10-08')).toBe('2026-10-01')
    expect(inicioDoMes('2026-10-08', 1)).toBe('2026-09-01')
    expect(inicioDoMes('2026-01-15', 1)).toBe('2025-12-01')
    expect(inicioDoMes('2026-01-15', 13)).toBe('2024-12-01')
  })
  it('escreve o dia como gente fala', () => {
    expect(rotuloDoDia('2026-10-08', '2026-10-08')).toBe('Hoje')
    expect(rotuloDoDia('2026-10-07', '2026-10-08')).toBe('Ontem')
    expect(rotuloDoDia('2026-10-05', '2026-10-08')).toBe('segunda-feira, 5 de outubro')
    expect(rotuloDoDia('2025-12-30', '2026-01-02')).toBe('terça-feira, 30 de dezembro de 2025')
    expect(quandoFoi('2026-10-08T12:00:00-03:00', '2026-10-08')).toBe('hoje')
    expect(quandoFoi('2026-10-07T23:50:00-03:00', '2026-10-08')).toBe('ontem')
    expect(quandoFoi('2026-10-05T10:00:00-03:00', '2026-10-08')).toBe('há 3 dias')
    expect(quandoFoi('2026-09-28T10:00:00-03:00', '2026-10-08')).toBe('28/9')
  })
})

const dados = {
  revisoes: [
    { id: 'r1', titulo: 'Funções', status: 'concluida', concluida_em: '2026-10-08T10:00:00-03:00', total: 10, respondidas: 10, certas: 7, parciais: 1, pontos: 40, segundos: 600 },
    { id: 'r2', titulo: 'Pausado', status: 'pausada', concluida_em: null, total: 10, respondidas: 3 },
    { id: 'r3', titulo: 'Citologia', status: 'concluida', concluida_em: '2026-09-20T09:00:00-03:00', total: 8, respondidas: 8, certas: 4, parciais: 0, pontos: 20, segundos: 300 },
  ],
  materiais: [{ id: 't1', titulo: 'Texto de funções', materia_id: 'm1', criado_em: '2026-10-07T15:00:00-03:00' }],
  materias: [{ id: 'm1', nome: 'Matemática', cor: 'azul', criado_em: '2026-09-01T08:00:00-03:00' }],
  questoes: [
    { id: 'q1', origem: 'gerada', materia_id: 'm1', criado_em: '2026-10-07T15:10:00-03:00' },
    { id: 'q2', origem: 'gerada', materia_id: 'm1', criado_em: '2026-10-07T15:12:00-03:00' },
    { id: 'q3', origem: 'gerada', materia_id: 'm2', criado_em: '2026-10-07T15:11:00-03:00' },
    { id: 'q4', origem: 'minha', materia_id: 'm1', criado_em: '2026-10-07T16:00:00-03:00' },
    { id: 'q5', origem: 'estranha', materia_id: 'm1', criado_em: '2026-10-07T16:00:00-03:00' },
  ],
  pontos: [
    { id: 1, motivo: 'respostas', pontos: 30, criado_em: '2026-10-08T10:00:00-03:00' },
    { id: 2, motivo: 'proficiente', pontos: 30, criado_em: '2026-10-08T10:00:00-03:00' },
    { id: 3, motivo: 'proficiente', pontos: 30, criado_em: '2026-10-08T10:00:00-03:00' },
  ],
}

describe('linha do tempo', () => {
  const eventos = montarLinhaDoTempo(dados)
  it('junta tudo do mais novo ao mais antigo, com o estudo antes do marco que ele gerou', () => {
    expect(eventos.map((e) => e.tipo)).toEqual(['estudo', 'marco', 'questoes', 'questoes', 'texto', 'estudo', 'materia'])
    expect(parte(eventos[0], { ref: 'r1', acerto: 75, pontos: 40, minutos: 10, dia: '2026-10-08' })).toEqual({ ref: 'r1', acerto: 75, pontos: 40, minutos: 10, dia: '2026-10-08' })
  })
  it('agrupa questões por dia e origem e ignora origens desconhecidas', () => {
    const geradas = eventos.find((e) => e.id === 'questoes:2026-10-07:gerada')
    expect(parte(geradas, { n: 3, titulo: '3 questões geradas', materias: ['m1', 'm2'], quando: '2026-10-07T15:12:00-03:00' })).toEqual({ n: 3, titulo: '3 questões geradas', materias: ['m1', 'm2'], quando: '2026-10-07T15:12:00-03:00' })
    expect(eventos.find((e) => e.origem === 'minha').titulo).toBe('1 questão escrita por você')
  })
  it('vira marco só o que não é ponto comum do estudo', () => {
    const marcos = eventos.filter((e) => e.tipo === 'marco')
    expect(marcos).toHaveLength(1)
    expect(parte(marcos[0], { n: 2, pontos: 60, titulo: '2 assuntos ficaram Proficientes' })).toEqual({ n: 2, pontos: 60, titulo: '2 assuntos ficaram Proficientes' })
  })
  it('filtra por tipo e período', () => {
    const hoje = '2026-10-08'
    expect(filtrarEventos(eventos, { tipo: 'estudo' }, hoje)).toHaveLength(2)
    expect(filtrarEventos(eventos, { periodo: 'mes' }, hoje).every((e) => e.dia.startsWith('2026-10'))).toBe(true)
    expect(filtrarEventos(eventos, { periodo: 'mes_passado' }, hoje).map((e) => e.tipo)).toEqual(['estudo', 'materia'])
    expect(filtrarEventos(eventos, { periodo: '7', tipo: 'texto' }, hoje)).toHaveLength(1)
  })
  it('agrupa por dia com rótulo', () => {
    const dias = agruparPorDia(eventos, '2026-10-08')
    expect(dias.map((d) => d.rotulo)).toEqual(['Hoje', 'Ontem', 'domingo, 20 de setembro', 'terça-feira, 1 de setembro'])
    expect(dias[1].eventos).toHaveLength(3)
  })
  it('resume o mês contra o anterior e conta respostas por dia', () => {
    const r = resumoDoMes(eventos, '2026-10-08')
    expect(parte(r, { mes: 'outubro', mesAnterior: 'setembro' })).toEqual({ mes: 'outubro', mesAnterior: 'setembro' })
    expect(r.atual).toEqual({ estudos: 1, respostas: 10, pontos: 40, textos: 1, questoes: 4, dias: 1 })
    expect(parte(r.anterior, { estudos: 1, respostas: 8, pontos: 20, textos: 0 })).toEqual({ estudos: 1, respostas: 8, pontos: 20, textos: 0 })
    expect(r.mesmoPeriodo.estudos).toBe(0)
    expect(resumoDoMes(eventos, '2026-10-25').mesmoPeriodo.estudos).toBe(1)
    const porDia = respostasPorDia(eventos, '2026-10-08')
    expect(porDia).toHaveLength(8)
    expect(porDia.at(-1)).toEqual({ dia: '2026-10-08', valor: 10 })
  })
  it('aguenta listas vazias', () => {
    expect(montarLinhaDoTempo()).toEqual([])
    expect(resumoDoMes([], '2026-10-08').atual.estudos).toBe(0)
  })
})
