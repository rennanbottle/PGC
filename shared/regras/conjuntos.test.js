import { describe, expect, it } from 'vitest'
import { blocoPadrao, blocosDaExecucao, blocosDaReceita, configDoBloco, configDoSorteio, lerBlocos, lerNomeConjunto, ordemNoBloco, origemDoSorteio, resumoDoBloco, resumoDoSorteio, situacaoDasReceitas, sortearBlocos, usaIaNoConjunto } from './conjuntos.js'
import { escolherQuestoes } from './revisoes.js'
import { sorteador } from './sessao.js'

const A = '11111111-1111-4111-8111-111111111111'
const B = '22222222-2222-4222-8222-222222222222'
const comAssunto = (b, ids = [A]) => ({ ...b, assuntos: ids.map((id) => ({ id, peso: 1 })) })

describe('blocos', () => {
  it('revisão completa com novas; prática completa com o material', () => {
    const r = blocoPadrao('revisao')
    const p = blocoPadrao('pratica')
    expect([r.tipo, r.origem, r.completarNovas]).toEqual(['revisao', 'vencidas', true])
    expect([p.tipo, p.origem, p.completarMaterial, p.completarIa]).toEqual(['pratica', 'novas', true, false])
  })
  it('origem do sorteio separa já respondidas de nunca respondidas', () => {
    expect(origemDoSorteio({ tipo: 'revisao', origem: 'vencidas' })).toBe('revisao')
    expect(origemDoSorteio({ tipo: 'revisao', origem: 'erradas' })).toBe('erradas')
    expect(origemDoSorteio({ tipo: 'pratica', origem: 'novas' })).toBe('pratica')
    expect(origemDoSorteio({ tipo: 'pratica', origem: 'importadas' })).toBe('pratica_importadas')
  })
  it('estudo sério tem 3 blocos e o último volta nos erros, repetindo de propósito', () => {
    const b = blocosDaReceita('estudo_serio', 'normal')
    expect(b.map((x) => x.tipo)).toEqual(['revisao', 'pratica', 'revisao'])
    expect(b[2].origem).toBe('erros_conjunto')
    expect(b[2].repetir).toBe(true)
    expect(b[0].correcao).toBe('fim')
  })
})

describe('ler o conjunto', () => {
  it('recusa sem bloco, mais de 6 e só blocos de erros', () => {
    expect(lerBlocos([]).erro).toContain('pelo menos um bloco')
    expect(lerBlocos(Array(7).fill(comAssunto(blocoPadrao('revisao')))).erro).toContain('no máximo 6')
    expect(lerBlocos([blocoPadrao('revisao', 'normal', { origem: 'erros_conjunto' })]).erro).toContain('outro bloco antes')
  })
  it('diz qual bloco tem o problema', () => {
    const r = lerBlocos([comAssunto(blocoPadrao('revisao')), blocoPadrao('pratica')])
    expect(r.erro).toBe('Bloco 2: escolha pelo menos um assunto.')
  })
  it('passa de 60 no total', () => {
    const r = lerBlocos([comAssunto(blocoPadrao('revisao', 'normal', { quantidade: 40 })), comAssunto(blocoPadrao('pratica', 'normal', { quantidade: 30 }))])
    expect(r.erro).toContain('tem 70')
  })
  it('bloco de erros herda os assuntos dos outros e sempre pode repetir', () => {
    const r = lerBlocos([comAssunto(blocoPadrao('revisao'), [A]), comAssunto(blocoPadrao('pratica'), [B]), blocoPadrao('revisao', 'normal', { origem: 'erros_conjunto', repetir: false })])
    expect(r.blocos[2].assuntos.map((a) => a.id)).toEqual([A, B])
    expect(r.blocos[2].repetir).toBe(true)
  })
  it('limpa opções que não valem para o tipo', () => {
    const r = lerBlocos([comAssunto({ ...blocoPadrao('revisao'), completarIa: true, completarMaterial: true, cronometro: { modo: 'bloco', minutos: 10 } }), comAssunto({ ...blocoPadrao('pratica'), completarNovas: true, completarIa: true, correcao: 'bloco' })])
    expect([r.blocos[0].completarIa, r.blocos[0].completarMaterial, r.blocos[0].cronometro.modo]).toEqual([false, false, 'sessao'])
    expect([r.blocos[1].completarNovas, r.blocos[1].completarIa, r.blocos[1].correcao]).toEqual([false, true, 'bloco'])
    expect(usaIaNoConjunto(r.blocos)).toBe(true)
  })
  it('nome do conjunto', () => {
    expect(lerNomeConjunto('   ').erro).toBeTruthy()
    expect(lerNomeConjunto('  Física   de terça ').nome).toBe('Física de terça')
  })
})

describe('sorteio por bloco', () => {
  const pool = [
    { id: 'v1', assunto_id: A, tipo: 'multipla_escolha', nivel: 2, vencida: true, nova: false },
    { id: 'v2', assunto_id: A, tipo: 'multipla_escolha', nivel: 2, vencida: false, nova: false },
    { id: 'n1', assunto_id: A, tipo: 'multipla_escolha', nivel: 2, vencida: false, nova: true },
    { id: 'n2', assunto_id: A, tipo: 'multipla_escolha', nivel: 2, vencida: false, nova: true, importada: true },
  ]
  const bloco = (extra) => configDoSorteio({ ...comAssunto(blocoPadrao('revisao', 'normal', { tipos: ['multipla_escolha'], quantidade: 4, dificuldade: { modo: 'fixa', nivel: 2 } })), ...extra })
  it('revisão só pega as já respondidas, vencida primeiro', () => {
    const r = escolherQuestoes(pool, bloco({}), { rng: sorteador('x'), preencherComOutros: false })
    expect(r.itens.map((q) => q.id)).toEqual(['v1', 'v2'])
  })
  it('prática só pega as nunca respondidas; importadas filtra mais', () => {
    expect(escolherQuestoes(pool, bloco({ tipo: 'pratica', origem: 'novas' }), { rng: sorteador('x') }).itens.map((q) => q.id).sort()).toEqual(['n1', 'n2'])
    expect(escolherQuestoes(pool, bloco({ tipo: 'pratica', origem: 'importadas' }), { rng: sorteador('x') }).itens.map((q) => q.id)).toEqual(['n2'])
  })
  it('não repete o que já está em outro bloco e conta as excluídas', () => {
    const r = escolherQuestoes(pool, bloco({ tipo: 'pratica', origem: 'novas' }), { rng: sorteador('x'), excluir: new Set(['n1']) })
    expect(r.itens.map((q) => q.id)).toEqual(['n2'])
    expect(r.excluidas).toBe(1)
    expect(r.disponiveis).toBe(1)
  })
})

describe('textos e execução', () => {
  it('resumo do bloco fala de assuntos, fonte, nível e correção', () => {
    const b = comAssunto(blocoPadrao('pratica', 'normal', { dificuldade: { modo: 'curva', de: 2, ate: 3 }, correcao: 'cada' }), [A, B])
    expect(resumoDoBloco(b, { [A]: 'Lançamento oblíquo', [B]: 'Movimento uniforme' })).toBe('Lançamento oblíquo e Movimento uniforme. Novas do banco, do material, do Normal ao Difícil. Correção a cada questão, dicas conforme o nível.')
    expect(resumoDoBloco(blocoPadrao('revisao', 'normal', { origem: 'erros_conjunto', correcao: 'cada' }))).toContain('errar nos blocos anteriores')
  })
  it('receitas: desafio trava sem proficiente; reforço precisa de erros', () => {
    const s = Object.fromEntries(situacaoDasReceitas({ vencidas: 0, erros14: 0, proficientes: 0, ritmo: 'normal' }).map((r) => [r.id, r]))
    expect(s.desafio.disponivel).toBe(false)
    expect(s.reforco_erros.disponivel).toBe(false)
    expect(s.estudo_serio.tipos).toEqual(['revisao', 'pratica', 'revisao'])
  })
  it('execução antiga vira um bloco só', () => {
    const antiga = { titulo: 'Revisão do dia, Física', total: 20, config: { correcao: 'fim' }, blocos: [] }
    expect(blocosDaExecucao(antiga)).toHaveLength(1)
    expect(configDoBloco(antiga, 0).correcao).toBe('fim')
    expect(ordemNoBloco(2, 5)).toBe(205)
  })
})

describe('sortear o conjunto inteiro', () => {
  const q = (id, extra) => ({ id, assunto_id: A, tipo: 'multipla_escolha', nivel: 2, vencida: false, nova: false, ...extra })
  const pool = [q('v1', { vencida: true }), q('v2', { vencida: true }), q('r1'), q('n1', { nova: true }), q('n2', { nova: true }), q('n3', { nova: true }), q('e1', { errada: true })]
  const base = { tipos: ['multipla_escolha'], dificuldade: { modo: 'fixa', nivel: 2 } }
  const blocos = lerBlocos([
    comAssunto(blocoPadrao('revisao', 'normal', { ...base, quantidade: 3, completarNovas: false })),
    comAssunto(blocoPadrao('pratica', 'normal', { ...base, quantidade: 4, completarMaterial: true })),
    blocoPadrao('revisao', 'normal', { ...base, origem: 'erros_conjunto', quantidade: 2 }),
  ]).blocos
  it('nenhuma questão aparece em dois blocos; o bloco de erros fica para depois', () => {
    const plano = sortearBlocos(blocos, pool, {}, 's')
    const ids = plano.flatMap((p) => p.itens.map((x) => x.id))
    expect(new Set(ids).size).toBe(ids.length)
    expect(plano[0].itens.every((x) => !x.nova)).toBe(true)
    expect(plano[1].itens.every((x) => x.nova)).toBe(true)
    expect([plano[2].adiado, plano[2].itens.length]).toEqual([true, 0])
    expect(plano[2].reserva).toBe(1)
  })
  it('o resumo diz o que falta e se dá para completar', () => {
    const r = resumoDoSorteio(blocos, sortearBlocos(blocos, pool, {}, 's'))
    const p = r.blocos[1]
    expect([p.pedidas, p.total, p.faltam, p.podeCompletar]).toEqual([4, 3, 1, true])
    expect(r.total).toBe(3 + 3 + 2)
    expect(r.doBanco).toBe(6)
  })
  it('revisão que completa com novas pega as que sobraram, sem tirar da prática seguinte', () => {
    const b = lerBlocos([comAssunto(blocoPadrao('revisao', 'normal', { ...base, quantidade: 5, completarNovas: true })), comAssunto(blocoPadrao('pratica', 'normal', { ...base, quantidade: 3 }))]).blocos
    const plano = sortearBlocos(b, pool, {}, 's')
    expect(plano[0].itens).toHaveLength(5)
    expect(plano[0].completadasComNovas).toBe(1)
    expect(plano[1].itens).toHaveLength(2)
    expect(plano[1].excluidas).toBe(1)
  })
})
