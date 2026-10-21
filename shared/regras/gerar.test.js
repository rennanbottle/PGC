import { describe, expect, it } from 'vitest'
import { corpoGerar, distribuir, dividirNiveis, somaNiveis, escolherLocais, escolherMisto, lerConfigGerar, limparInstrucoes, maxQuantidade, niveisDoPedido, nivelPrincipal, tempoEstimado, textoNiveis, tiposDoPedido } from './gerar.js'
import { montarPedidoGerar, pedidoParaOutraIA, validarGeradas } from './ia.js'

const M = '11111111-1111-4111-8111-111111111111'
const MAT = '22222222-2222-4222-8222-222222222222'

describe('divisão por nível', () => {
  it('divide pelo maior resto e soma o total', () => {
    expect(distribuir(10, [20, 50, 30])).toEqual([2, 5, 3])
    expect(distribuir(7, [1, 1, 1])).toEqual([3, 2, 2])
    expect(distribuir(4, [0, 0, 0])).toEqual([4, 0, 0])
  })
  it('lê "uma só" e "distribuir", refazendo contas que não somam', () => {
    expect(niveisDoPedido({ modo: 'uma', nivel: 3 }, 5)).toEqual({ 1: 0, 2: 0, 3: 5 })
    expect(niveisDoPedido({ modo: 'distribuir', contas: { 1: 2, 2: 5, 3: 3 } }, 10)).toEqual({ 1: 2, 2: 5, 3: 3 })
    expect(niveisDoPedido({ modo: 'distribuir', contas: { 1: 1, 2: 1, 3: 0 } }, 4)).toEqual({ 1: 2, 2: 2, 3: 0 })
  })
  it('escreve o resumo e acha o nível principal', () => {
    expect(textoNiveis({ 1: 2, 2: 5, 3: 3 })).toBe('2 fáceis, 5 normais e 3 difíceis')
    expect(textoNiveis({ 1: 0, 2: 1, 3: 0 })).toBe('1 normal')
    expect(nivelPrincipal({ 1: 2, 2: 1, 3: 7 })).toBe(3)
  })
})

describe('configuração enviada', () => {
  const base = { modo: 'ia', materiaId: M, materiais: [{ id: MAT, de: 9, ate: 3 }], quantidade: 30, tipos: ['multipla_escolha', 'x'], dificuldade: { modo: 'uma', nivel: 1 } }
  it('limita a quantidade, inverte o intervalo e tira tipo desconhecido', () => {
    const { config } = lerConfigGerar(base)
    expect(config.quantidade).toBe(20)
    expect(config.materiais[0]).toEqual({ id: MAT, de: 3, ate: 9 })
    expect(config.tipos).toEqual(['multipla_escolha'])
    expect(config.niveis).toEqual({ 1: 20, 2: 0, 3: 0 })
  })
  it('aceita só a matéria, sem assunto; recusa o jeito que precisa de texto', () => {
    expect(lerConfigGerar({ ...base, fonte: 'assunto' }).config.assuntoIds).toEqual([])
    expect(lerConfigGerar({ ...base, fonte: 'assunto', modo: 'misto', assuntoIds: [M] }).erro).toContain('Sem texto')
    expect(lerConfigGerar({ ...base, fonte: 'assunto', modo: 'local' }).erro).toContain('Sem texto')
    expect(lerConfigGerar({ ...base, tipos: ['cartao'] }).erro).toContain('tipo')
  })
  it('limpa as instruções', () => {
    expect(limparInstrucoes('  use <<<MATERIAL carros >>>  ')).toBe('use MATERIAL carros')
    expect(limparInstrucoes('a'.repeat(900))).toHaveLength(500)
  })
})

describe('quantidade, tipos e corpo da tela', () => {
  it('todos os jeitos vão até 20', () => {
    expect(maxQuantidade('ia')).toBe(20)
    expect(maxQuantidade('misto')).toBe(20)
    expect(maxQuantidade('externa')).toBe(20)
    const { config } = lerConfigGerar({ modo: 'externa', materiaId: M, fonte: 'assunto', quantidade: 50, tipos: ['numerica'] })
    expect(config.quantidade).toBe(20)
  })
  it('divide a quantidade pelos tipos, na ordem marcada', () => {
    expect(tiposDoPedido(['multipla_escolha', 'numerica', 'verdadeiro_falso'], 10)).toEqual([
      { tipo: 'multipla_escolha', n: 4 }, { tipo: 'numerica', n: 3 }, { tipo: 'verdadeiro_falso', n: 3 },
    ])
    expect(tiposDoPedido(['a', 'b', 'c'], 2)).toEqual([{ tipo: 'a', n: 1 }, { tipo: 'b', n: 1 }])
    expect(tiposDoPedido([], 5)).toEqual([])
  })
  it('monta o corpo: textos viram materiais e "usar o texto primeiro" vira misto', () => {
    const e = { modo: 'ia', aproveitarTexto: true, materiaId: M, textos: [MAT, MAT], assuntoIds: [M], quantidade: 10, tipos: ['numerica'], instrucoes: '' }
    const c = corpoGerar(e)
    expect([c.modo, c.fonte, c.materiais]).toEqual(['misto', 'materiais', [{ id: MAT, de: 1, ate: 5000 }]])
    const s = corpoGerar({ ...e, textos: [] })
    expect([s.modo, s.fonte, s.materiais]).toEqual(['ia', 'assunto', []])
    expect(corpoGerar({ ...e, modo: 'externa' }).modo).toBe('externa')
  })
  it('estima o tempo de gerar e de estudar', () => {
    expect(tempoEstimado('ia', 10)).toEqual({ gerar: 'cerca de 35 s', estudarMin: 12 })
    expect(tempoEstimado('local', 5).gerar).toBe('na hora')
    expect(tempoEstimado('externa', 1).estudarMin).toBe(1)
  })
  it('sem IA: pega até a quantidade, alternando as técnicas', () => {
    const por = { lacuna: { questoes: ['l1', 'l2', 'l3'] }, cartao: { questoes: ['c1'] }, ordenar: { questoes: ['o1', 'o2'] } }
    expect(escolherLocais(por, ['lacuna', 'cartao', 'ordenar'], 5)).toEqual(['l1', 'c1', 'o1', 'l2', 'o2'])
    expect(escolherLocais(por, ['cartao'], 5)).toEqual(['c1'])
    expect(escolherLocais(por, ['nada'], 5)).toEqual([])
  })
})

describe('modo misto', () => {
  it('pega as sem IA que cabem, variando o tipo, e diz o que falta', () => {
    const locais = [
      { tipo: 'lacuna_digitada', nivel: 1 }, { tipo: 'lacuna_digitada', nivel: 1 }, { tipo: 'lacuna_digitada', nivel: 1 },
      { tipo: 'numerica', nivel: 2 }, { tipo: 'cartao', nivel: 1 },
    ]
    const r = escolherMisto(locais, { 1: 2, 2: 3, 3: 2 }, ['lacuna_digitada', 'numerica'])
    expect(r.escolhidas).toHaveLength(3)
    expect(r.faltam).toEqual({ 1: 0, 2: 2, 3: 2 })
  })
})

describe('pedido com estilo, níveis e instruções', () => {
  const p = montarPedidoGerar({ materia: 'Física', area: 'exatas', assuntos: ['Queda livre'], trechos: [{ pagina: 9, texto: 'texto', rotulo: 'M1' }, { pagina: 2, texto: 'outro', rotulo: 'M2' }], quantidade: 10, niveis: { 1: 2, 2: 5, 3: 3 }, tipos: ['multipla_escolha'], estilo: 'enem', instrucoes: 'Use carros.' })
  it('leva cada nível, o estilo, as instruções e o rótulo do material', () => {
    const u = p.mensagens[1].content
    expect(u).toContain('- 2 no nível Fácil')
    expect(u).toContain('- 3 no nível Difícil')
    expect(u).toContain('exatamente 5 alternativas')
    expect(u).toContain('Use carros.')
    expect(u).toContain('[M2, página 2]')
    expect(p.formato).toContain('"material":"M1"')
  })
  it('o texto editável mais o formato é o pedido inteiro', () => {
    expect(`${p.editavel}\n\n${p.formato}`).toBe(pedidoParaOutraIA(p.mensagens))
  })
  it('sem material não leva marcadores nem página', () => {
    const s = montarPedidoGerar({ materia: 'História', assuntos: ['Era Vargas'], quantidade: 3, nivel: 2, tipos: ['verdadeiro_falso'], semMaterial: true })
    expect(s.mensagens[1].content.includes('<<<MATERIAL')).toBe(false)
    expect(s.formato.includes('"pagina"')).toBe(false)
    expect(s.mensagens[0].content).toContain('Não há material')
  })
})

describe('conferência com níveis e estilo', () => {
  const alt = (n) => Array.from({ length: n }, (_, i) => (i === 0 ? { texto: 'Quarenta e cinco metros', correta: true } : { texto: `Uma opção errada número ${i}`, correta: false, erro: `raciocínio ${i}` }))
  const q = (nivel, n) => ({ tipo: 'multipla_escolha', nivel, bloom: 1, enunciado: 'Uma pedra cai por 3 s a partir do repouso. Qual a altura?', conteudo: { alternativas: alt(n) }, explicacao: 'h = g t² / 2.' })
  it('usa o nível que a IA diz, se foi pedido, e prende o Bloom', () => {
    const r = validarGeradas({ questoes: [q(3, 4), q(9, 4)] }, { tipos: ['multipla_escolha'], niveis: { 1: 0, 2: 1, 3: 1 } })
    expect(r.aprovadas.map((x) => x.nivel)).toEqual([3, 2])
    expect(r.aprovadas[0].bloom).toBe(3)
  })
  it('reprova quantidade de alternativas fora do estilo', () => {
    const r = validarGeradas({ questoes: [q(2, 4)] }, { tipos: ['multipla_escolha'], nivel: 2, alternativas: 5 })
    expect(r.reprovadas[0].motivos.join(' ')).toContain('5 alternativas')
  })
})

describe('dividirNiveis (lotes da IA do PGC)', () => {
  it('20 questões viram 2 lotes de 10 com os níveis espalhados', () => {
    const lotes = dividirNiveis({ 1: 4, 2: 10, 3: 6 }, 10)
    expect(lotes).toHaveLength(2)
    expect(lotes.map((l) => somaNiveis(l))).toEqual([10, 10])
    expect(lotes[0]).toEqual({ 1: 2, 2: 5, 3: 3 })
  })
  it('nenhum lote passa de 10, mesmo com números ímpares', () => {
    for (const lote of dividirNiveis({ 1: 7, 2: 7, 3: 5 }, 10)) expect(somaNiveis(lote)).toBeLessThanOrEqual(10)
    expect(dividirNiveis({ 2: 8 }, 10)).toEqual([{ 2: 8 }])
  })
})
