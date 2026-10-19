import { describe, expect, it } from 'vitest'
import { acertoAgrupado, curvaDeRetencao, DICAS_CRITERIO, diasAteRevisao, linhaDeProficiencia, parDaRelacao, sugerirRelacionados } from './assunto.js'
import { avaliarAssunto } from './dominio.js'

describe('página do assunto', () => {
  it('linha da proficiência: só as revisões com o assunto, em ordem de data', () => {
    const revisoes = [
      { id: 'r2', concluida_em: '2026-10-09T12:00:00Z', tipo: 'estudo', assuntos: [{ id: 'a', depois: 620 }] },
      { id: 'r1', concluida_em: '2026-10-02T12:00:00Z', tipo: 'estudo', assuntos: [{ id: 'a', depois: 575 }, { id: 'b', depois: 500 }] },
      { id: 'r3', concluida_em: '2026-10-10T12:00:00Z', tipo: 'prova', assuntos: [{ id: 'b', depois: 510 }] },
      { id: 'r4', concluida_em: '2026-10-11T12:00:00Z', tipo: 'prova', assuntos: [{ id: 'a', depois: null }] },
    ]
    expect(linhaDeProficiencia(revisoes, 'a').map((p) => p.valor)).toEqual([575, 620])
  })
  it('curva de lembrança cai com o tempo e a revisão é quando chega a 90%', () => {
    const curva = curvaDeRetencao({ estabilidade: 10, desde: 2, dias: 30 })
    expect(curva).toHaveLength(31)
    expect(curva[0].r).toBeGreaterThan(curva[30].r)
    expect(curva[8].r).toBeCloseTo(0.9, 2)
    expect(diasAteRevisao({ estabilidade: 10, desde: 2 })).toBe(8)
    expect(diasAteRevisao({ estabilidade: 10, desde: 15 })).toBe(0)
    expect(curvaDeRetencao({ estabilidade: 0 })).toEqual([])
  })
  it('acerto por nível de pensamento e por tipo', () => {
    const r = [{ bloom: 1, tipo: 'multipla_escolha', resultado: 'correta' }, { bloom: 3, tipo: 'numerica', resultado: 'incorreta' }, { bloom: 1, tipo: 'multipla_escolha', resultado: 'parcial' }]
    expect(acertoAgrupado(r, 'bloom').map((g) => [g.rotulo, g.certas, g.parciais, g.erradas])).toEqual([['Lembrar', 1, 1, 0], ['Aplicar', 0, 0, 1]])
    expect(acertoAgrupado(r, 'tipo')[0]).toMatchObject({ rotulo: 'Múltipla escolha', total: 2 })
  })
  it('todo critério do domínio tem o que fazer', () => {
    const respostas = Array.from({ length: 8 }, (_, i) => ({ questaoId: `q${i}`, tipo: 'multipla_escolha', nivel: 3, bloom: 2, resultado: 'correta', dicas: 0, dia: i }))
    const { checklist, estabilidade, ultimoDia } = avaliarAssunto(respostas, 10, { ritmo: 'normal' })
    for (const c of checklist) expect(DICAS_CRITERIO[c.id], c.id).toBeTruthy()
    expect(estabilidade).toBeGreaterThan(0)
    expect(ultimoDia).toBe(7)
  })
})

describe('sugerirRelacionados', () => {
  const assuntos = [
    { id: 'a1', nome: 'Funções do 2º grau', materia: 'Matemática' },
    { id: 'a2', nome: 'Funções do 1º grau', materia: 'Matemática' },
    { id: 'a3', nome: 'Equações do 2º grau', materia: 'Matemática' },
    { id: 'a4', nome: 'Probabilidade', materia: 'Matemática' },
    { id: 'a5', nome: 'Revolução Francesa', materia: 'História' },
  ]
  const conceitos = [
    { assunto_id: 'a1', termo: 'Discriminante', versao_id: 'v1' },
    { assunto_id: 'a1', termo: 'Raízes', versao_id: 'v1' },
    { assunto_id: 'a3', termo: 'discriminante', versao_id: 'v2' },
    { assunto_id: 'a3', termo: 'raízes', versao_id: 'v2' },
    { assunto_id: 'a4', termo: 'Espaço amostral', versao_id: 'v1' },
  ]
  const textos = { v1: { id: 'm1', titulo: 'Apostila de Funções' }, v2: { id: 'm2', titulo: 'Lista' } }
  it('ordena pelos sinais e explica o motivo', () => {
    const r = sugerirRelacionados({ assuntoId: 'a1', assuntos, conceitos, textos })
    expect(r.sugeridos.map((s) => s.id)).toEqual(['a3', 'a2', 'a4'])
    expect(r.sugeridos[0].motivo).toBe('Têm 2 conceitos em comum: Discriminante e Raízes.')
    expect(r.sugeridos[1].motivo).toBe('Têm nomes parecidos.')
    expect(r.sugeridos[2].motivo).toBe('Aparecem no mesmo texto da Biblioteca.')
    expect(r.sugeridos[2].fonte).toEqual({ id: 'm1', titulo: 'Apostila de Funções' })
  })
  it('aceitos à parte e recusados somem', () => {
    const relacoes = [{ assunto_a: 'a1', assunto_b: 'a3', status: 'aceito' }, { assunto_a: 'a1', assunto_b: 'a2', status: 'recusado' }]
    const r = sugerirRelacionados({ assuntoId: 'a1', assuntos, conceitos, textos, relacoes })
    expect(r.aceitos.map((s) => s.id)).toEqual(['a3'])
    expect(r.sugeridos.map((s) => s.id)).toEqual(['a4'])
  })
  it('par em ordem', () => {
    expect(parDaRelacao('b', 'a')).toEqual({ assunto_a: 'a', assunto_b: 'b' })
  })
})
