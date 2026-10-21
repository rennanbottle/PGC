import { describe, expect, it } from 'vitest'
import { ordenarMetas, periodoDaMeta, progressoDaMeta, situacaoDaMeta, tituloDaMeta, validarMeta } from './metas.js'

// 2026-10-14 é uma quarta-feira: a semana vai de 11 (domingo) a 17 (sábado).
const HOJE = '2026-10-14'

describe('validarMeta', () => {
  it('aceita meta por semana', () => {
    const r = validarMeta({ tipo: 'questoes', alvo: '100', periodo: 'semana' }, HOJE)
    expect(r.ok).toBe(true)
    expect(r.meta).toEqual({ tipo: 'questoes', alvo: 100, periodo: 'semana', prazo: null, materia_id: null })
  })
  it('dominar vira meta com data e pede o prazo', () => {
    const r = validarMeta({ tipo: 'dominar', alvo: 3, periodo: 'semana' }, HOJE)
    expect(r.ok).toBe(false)
    expect(r.erros.prazo).toBe('Escolha até quando.')
    expect(validarMeta({ tipo: 'dominar', alvo: 3, prazo: '2026-11-20' }, HOJE).meta.periodo).toBe('data')
  })
  it('recusa alvo inválido, data passada e data longe demais', () => {
    expect(validarMeta({ tipo: 'questoes', alvo: 0 }, HOJE).erros.alvo).toBeTruthy()
    expect(validarMeta({ tipo: 'questoes', alvo: 2.5 }, HOJE).erros.alvo).toBeTruthy()
    expect(validarMeta({ tipo: 'questoes', alvo: 20000 }, HOJE).erros.alvo).toBe('O máximo é 10.000.')
    expect(validarMeta({ tipo: 'minutos', alvo: 10, periodo: 'data', prazo: '2026-10-13' }, HOJE).erros.prazo).toMatch(/já passou/)
    expect(validarMeta({ tipo: 'minutos', alvo: 10, periodo: 'data', prazo: '2028-01-01' }, HOJE).erros.prazo).toMatch(/um ano/)
    expect(validarMeta({ tipo: 'nada', alvo: 10 }, HOJE).erros.tipo).toBeTruthy()
  })
})

describe('periodo e título', () => {
  it('semana de domingo a sábado', () => {
    expect(periodoDaMeta({ periodo: 'semana' }, HOJE)).toEqual({ inicio: '2026-10-11', fim: '2026-10-17' })
  })
  it('meta com data vai do início ao prazo', () => {
    expect(periodoDaMeta({ periodo: 'data', inicio: '2026-10-01', prazo: '2026-10-31' }, HOJE)).toEqual({ inicio: '2026-10-01', fim: '2026-10-31' })
  })
  it('título com matéria e prazo', () => {
    expect(tituloDaMeta({ tipo: 'questoes', alvo: 100, periodo: 'semana' }, 'Matemática')).toBe('Responder 100 questões de Matemática por semana')
    expect(tituloDaMeta({ tipo: 'dominar', alvo: 1, periodo: 'data', prazo: '2026-11-20' })).toMatch(/^Dominar 1 assunto até 20/)
  })
})

describe('situacaoDaMeta', () => {
  const semana = { tipo: 'questoes', alvo: 70, periodo: 'semana' }
  it('em dia quando o feito alcança o esperado dos dias que passaram', () => {
    // quarta = 4º dia da semana: esperado 40 de 70
    const s = situacaoDaMeta(semana, 40, HOJE)
    expect(s.esperado).toBe(40)
    expect(s.estado).toBe('no_ritmo')
    expect(s.texto).toBe('Faltam 30 questões em 4 dias.')
  })
  it('atrasada abaixo do esperado', () => {
    const s = situacaoDaMeta(semana, 10, HOJE)
    expect(s.estado).toBe('atras')
    expect(s.texto).toMatch(/o esperado era 40/)
  })
  it('batida e vencida', () => {
    expect(situacaoDaMeta(semana, 80, HOJE).estado).toBe('batida')
    expect(situacaoDaMeta(semana, 80, HOJE).porcentagem).toBe(100)
    const vencida = situacaoDaMeta({ tipo: 'estudos', alvo: 5, periodo: 'data', inicio: '2026-10-01', prazo: '2026-10-10' }, 3, HOJE)
    expect(vencida.estado).toBe('vencida')
    expect(vencida.texto).toBe('O prazo passou. Faltaram 2 estudos.')
  })
  it('dominar não tem esperado por dia', () => {
    const s = situacaoDaMeta({ tipo: 'dominar', alvo: 3, periodo: 'data', inicio: '2026-10-01', prazo: '2026-11-20' }, 1, HOJE)
    expect(s.esperado).toBe(null)
    expect(s.estado).toBe('no_ritmo')
  })
  it('ordena atrasadas primeiro', () => {
    const lista = ordenarMetas([{ id: 1, situacao: { estado: 'batida' } }, { id: 2, situacao: { estado: 'atras' } }, { id: 3, situacao: { estado: 'no_ritmo' } }])
    expect(lista.map((m) => m.id)).toEqual([2, 3, 1])
  })
})

describe('progressoDaMeta', () => {
  const M = 'mat'
  const respostas = [
    { dia: '2026-10-10', materia_id: M, segundos: 600, revisao_id: 'r0' },
    { dia: '2026-10-12', materia_id: M, segundos: 90, revisao_id: 'r1' },
    { dia: '2026-10-13', materia_id: M, segundos: 90, revisao_id: 'r1' },
    { dia: '2026-10-14', materia_id: 'fis', segundos: 120, revisao_id: 'r2' },
  ]
  const dados = { respostas, estudosConcluidos: new Set(['r0', 'r1']), dominados: [{ materia_id: M }, { materia_id: 'fis' }] }
  it('conta só a semana e a matéria', () => {
    expect(progressoDaMeta({ tipo: 'questoes', periodo: 'semana', materia_id: M }, dados, HOJE)).toBe(2)
    expect(progressoDaMeta({ tipo: 'questoes', periodo: 'semana' }, dados, HOJE)).toBe(3)
  })
  it('minutos, estudos concluídos e dominados', () => {
    expect(progressoDaMeta({ tipo: 'minutos', periodo: 'semana' }, dados, HOJE)).toBe(5)
    expect(progressoDaMeta({ tipo: 'estudos', periodo: 'semana' }, dados, HOJE)).toBe(1)
    expect(progressoDaMeta({ tipo: 'dominar', periodo: 'data', materia_id: M }, dados, HOJE)).toBe(1)
  })
})
