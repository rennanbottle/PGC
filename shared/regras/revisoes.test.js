import { describe, expect, it } from 'vitest'
import { configDoModelo, escolherQuestoes, lerConfigRevisao, minutosEstimados, niveisAlvo, nivelMostrado, notaDaResposta, resumoDoResultado, separarTipos, situacaoDosModelos } from './revisoes.js'
import { sorteador } from './sessao.js'

const A = '11111111-1111-4111-8111-111111111111'
const B = '22222222-2222-4222-8222-222222222222'

describe('modelos', () => {
  it('recomenda a revisão do dia com vencidas e o reforço com 5 erros', () => {
    const s = situacaoDosModelos({ vencidas: 14, erros14: 7, assuntoMaisErrado: { nome: 'Vetores', erros: 7 }, proficientes: 1, ritmo: 'normal' })
    const por = Object.fromEntries(s.map((m) => [m.id, m]))
    expect(por.revisao_do_dia.recomendado).toBe(true)
    expect(por.reforco_erros.motivo).toContain('Vetores')
    expect(por.intercalada.disponivel).toBe(false)
    expect(por.desafio.disponivel).toBe(false)
    expect(por.personalizada.podeUsarIa).toBe(true)
  })
  it('estudo sério sobe de nível em curva', () => {
    const c = configDoModelo('estudo_serio', 'normal')
    expect(c.dificuldade.modo).toBe('curva')
    expect(c.dificuldade.ate).toBe(3)
  })
})

describe('configuração', () => {
  it('prende o nível ao que está liberado e a quantidade a 60', () => {
    const { config } = lerConfigRevisao({ assuntos: [{ id: A, peso: 1 }], tipos: ['multipla_escolha'], quantidade: 99, dificuldade: { modo: 'fixa', nivel: 5 }, nivelNaQuestao: 'disfarcar' })
    expect(config.quantidade).toBe(60)
    expect(config.dificuldade.nivel).toBe(3)
    expect(config.nivelNaQuestao).toBe('mostrar')
  })
  it('na distribuição a quantidade é a soma', () => {
    const { config } = lerConfigRevisao({ assuntos: [{ id: A, peso: 1 }], tipos: ['numerica'], dificuldade: { modo: 'distribuir', contas: { 2: 4, 3: 6 } } })
    expect(config.quantidade).toBe(10)
  })
  it('recusa sem assunto ou sem tipo', () => {
    expect(lerConfigRevisao({ tipos: ['numerica'] }).erro).toContain('assunto')
    expect(lerConfigRevisao({ assuntos: [{ id: A }], tipos: [] }).erro).toContain('tipo')
  })
})

describe('níveis por posição', () => {
  it('curva crescente vai do "de" ao "até"', () => {
    expect(niveisAlvo({ modo: 'curva', de: 2, ate: 3, forma: 'crescente' }, 5)).toEqual([2, 2, 3, 3, 3])
    expect(niveisAlvo({ modo: 'curva', de: 2, ate: 3, forma: 'decrescente' }, 3)).toEqual([3, 3, 2])
  })
  it('distribuir respeita as contas', () => {
    const l = niveisAlvo({ modo: 'distribuir', contas: { 1: 0, 2: 2, 3: 3, 4: 0, 5: 0 } }, 5, sorteador('a'))
    expect(l.filter((n) => n === 3)).toHaveLength(3)
  })
})

describe('escolher questões', () => {
  const q = (id, assunto, tipo, nivel, extra = {}) => ({ id, assunto_id: assunto, tipo, nivel, b: 0, ...extra })
  const cand = [
    q('a1', A, 'multipla_escolha', 2, { vencida: true }), q('a2', A, 'numerica', 3), q('a3', A, 'multipla_escolha', 2, { nova: true }),
    q('b1', B, 'multipla_escolha', 2, { errada: true }), q('b2', B, 'verdadeiro_falso', 2, { recente: true }),
  ]
  const config = { assuntos: [{ id: A, peso: 50 }, { id: B, peso: 50 }], tipos: ['multipla_escolha', 'numerica', 'verdadeiro_falso'], quantidade: 4, origem: 'banco', ordem: 'intercalada', dificuldade: { modo: 'fixa', nivel: 2 } }
  it('intercala os assuntos e põe a vencida primeiro', () => {
    const r = escolherQuestoes(cand, config, { rng: sorteador('x') })
    expect(r.itens.filter((i) => i.assunto_id === A)).toHaveLength(2)
    expect(r.itens[0].id).toBe('a1')
    expect(r.itens.slice(0, 3).every((i) => i.tipo === 'multipla_escolha')).toBe(false)
  })
  it('conta o que falta em cada assunto', () => {
    const r = escolherQuestoes(cand, { ...config, quantidade: 8 }, { rng: sorteador('x'), preencherComOutros: false })
    expect(r.faltam[A]).toBe(1)
    expect(r.faltam[B]).toBe(2)
  })
  it('só erradas filtra', () => {
    const r = escolherQuestoes(cand, { ...config, origem: 'erradas' }, { rng: sorteador('x') })
    expect(r.itens.map((i) => i.id)).toEqual(['b1'])
  })
  it('nunca 3 do mesmo tipo seguidas', () => {
    const l = separarTipos([{ tipo: 'a' }, { tipo: 'a' }, { tipo: 'a' }, { tipo: 'b' }])
    expect(l.map((x) => x.tipo)).toEqual(['a', 'a', 'b', 'a'])
  })
})

describe('tempo, nível mostrado, resultado', () => {
  it('estima minutos e esconde ou disfarça o nível', () => {
    expect(minutosEstimados([{ tipo: 'numerica', nivel: 2 }, { tipo: 'multipla_escolha', nivel: 3 }])).toBe(3)
    expect(nivelMostrado('esconder', 3)).toBeNull()
    expect(nivelMostrado('disfarcar', 3, () => 0.1)).toBe(2)
    expect(nivelMostrado('mostrar', 3)).toBe(3)
  })
  it('resume certas, parciais, erradas e incertas', () => {
    const r = resumoDoResultado([{ tipo: 'a', nivel: 2, resultado: 'correta', incerta: true }, { tipo: 'a', nivel: 3, resultado: 'parcial' }, { tipo: 'b', nivel: 3, resultado: 'incorreta' }])
    expect([r.certas, r.parciais, r.erradas, r.incertas]).toEqual([1, 1, 1, 1])
    expect(r.porNivel[1]).toEqual({ chave: 3, total: 2, certas: 0, parciais: 1, erradas: 1, branco: 0 })
    expect(notaDaResposta('correta', 1)).toBe(2)
  })
  it('certa marcada como incerta volta mais cedo', () => {
    expect(notaDaResposta('correta', 0)).toBe(3)
    expect(notaDaResposta('correta', 0, true)).toBe(2)
    expect(notaDaResposta('incorreta', 0, true)).toBe(1)
  })
  it('dicas ficam conforme o nível ou desligadas', () => {
    expect(lerConfigRevisao({ assuntos: [{ id: A, peso: 1 }], tipos: ['numerica'], dicas: 1 }).config.dicas).toBe(3)
    expect(lerConfigRevisao({ assuntos: [{ id: A, peso: 1 }], tipos: ['numerica'], dicas: 0 }).config.dicas).toBe(0)
  })
})
