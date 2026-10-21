import { describe, expect, it } from 'vitest'
import { FORMATOS, TIPOS_AUTOCORRIGIDOS, duracao, sortearCaderno, textoPorNivel, trocarNoCaderno, formatoDe, lerConfigProva, linhaDoCartao, notaDaProva, notaPorMateria, relogio, relogioVisivel, respostaPreenchida, tempoSugerido } from './provas.js'

const A = '11111111-1111-4111-8111-111111111111'
const B = '22222222-2222-4222-8222-222222222222'
const item = (resultado, assuntoId = A) => ({ assuntoId, correcao: resultado ? { resultado } : null })

describe('formatos e tempo', () => {
  it('prova só usa tipos que o PGC corrige sozinho', () => {
    expect(TIPOS_AUTOCORRIGIDOS.includes('explicar')).toBe(false)
    expect(TIPOS_AUTOCORRIGIDOS.includes('cartao')).toBe(false)
    expect(TIPOS_AUTOCORRIGIDOS.includes('associar')).toBe(true)
    expect(FORMATOS.every((f) => f.tipos.every((t) => TIPOS_AUTOCORRIGIDOS.includes(t)))).toBe(true)
    expect(formatoDe('nada').id).toBe('enem')
  })
  it('tempo sugerido arredonda de 5 em 5', () => {
    expect(tempoSugerido('enem', 45)).toBe(135)
    expect(tempoSugerido('certo_errado', 20)).toBe(30)
    expect(tempoSugerido('enem', 1)).toBe(5)
    expect(tempoSugerido('escola', 60)).toBe(240)
    expect(tempoSugerido('escola', 90)).toBe(300)
  })
  it('relógio e duração', () => {
    expect(relogio(3909)).toBe('1:05:09')
    expect(relogio(309)).toBe('05:09')
    expect(relogio(-4)).toBe('00:00')
    expect(duracao(8100)).toBe('2h 15min')
    expect(duracao(3600)).toBe('1h')
    expect(duracao(2700)).toBe('45 min')
    expect(duracao(20)).toBe('menos de 1 min')
  })
  it('relógio só nos 10 últimos minutos', () => {
    expect(relogioVisivel('final', 601)).toBe(false)
    expect(relogioVisivel('final', 600)).toBe(true)
    expect(relogioVisivel('escondido', 10)).toBe(false)
    expect(relogioVisivel('sempre', 5000)).toBe(true)
  })
})

describe('respostas e cartão-resposta', () => {
  it('resposta preenchida por tipo', () => {
    expect(respostaPreenchida('multipla_escolha', { escolha: 0 })).toBe(true)
    expect(respostaPreenchida('multipla_escolha', {})).toBe(false)
    expect(respostaPreenchida('certo_errado', { valor: false })).toBe(true)
    expect(respostaPreenchida('lacuna_digitada', { textos: ['  '] })).toBe(false)
    expect(respostaPreenchida('ordenar', {})).toBe(false)
    expect(respostaPreenchida('explicar', { texto: 'oi' })).toBe(false)
  })
  it('bolinhas da escolha, antes e depois de entregar', () => {
    const q = { tipo: 'multipla_escolha', alternativas: ['a', 'b', 'c', 'd', 'e'] }
    const antes = linhaDoCartao({ questao: q, resposta: { escolha: 2 } })
    expect(antes.opcoes.map((o) => o.letra).join('')).toBe('ABCDE')
    expect(antes.opcoes[2].marcada).toBe(true)
    expect(antes.opcoes.some((o) => o.certa)).toBe(false)
    const depois = linhaDoCartao({ questao: q, resposta: { escolha: 2 }, correcao: { resultado: 'errada', detalhe: { certa: 4 } } })
    expect(depois.opcoes[4].certa).toBe(true)
    expect(depois.resultado).toBe('errada')
  })
  it('certo ou errado vira C e E; outros tipos, só respondida', () => {
    const ce = linhaDoCartao({ questao: { tipo: 'certo_errado' }, resposta: { valor: true } })
    expect(ce.opcoes.map((o) => `${o.letra}${o.marcada ? '*' : ''}`).join(' ')).toBe('C* E')
    const ord = linhaDoCartao({ questao: { tipo: 'ordenar' }, resposta: { ordem: [1, 0] } })
    expect(ord.tipo).toBe('texto')
    expect(ord.respondida).toBe(true)
  })
})

describe('nota', () => {
  it('certa vale 1, parcial meio, em branco nada', () => {
    const n = notaDaProva([item('correta'), item('parcial'), item('errada'), item(null)], 'enem')
    expect(n.certas).toBe(1)
    expect(n.parciais).toBe(1)
    expect(n.erradas).toBe(1)
    expect(n.emBranco).toBe(1)
    expect(n.liquida).toBe(1.5)
    expect(n.porcentagem).toBe(38)
  })
  it('certo ou errado: uma errada anula uma certa, nunca abaixo de zero', () => {
    const n = notaDaProva([item('correta'), item('correta'), item('correta'), item('errada'), item(null)], 'certo_errado')
    expect(n.liquida).toBe(2)
    expect(n.porcentagem).toBe(40)
    expect(notaDaProva([item('errada'), item('errada'), item('correta')], 'certo_errado').liquida).toBe(0)
  })
  it('por matéria, da maior para a menor', () => {
    const assuntos = { [A]: { materia: 'Física', cor: 'azul' }, [B]: { materia: 'Química', cor: 'verde' } }
    const l = notaPorMateria([item('correta', B), item('errada', A), item('correta', A), item('correta', A)], assuntos)
    expect(l.map((m) => `${m.materia} ${m.certas}/${m.total} ${m.porcentagem}`)).toEqual(['Física 2/3 67', 'Química 1/1 100'])
  })
})

describe('montar', () => {
  it('lê e limita o pedido', () => {
    const { config } = lerConfigProva({ formato: 'certo_errado', assuntos: [{ id: A, peso: 99 }, { id: A }, { id: 'x' }], quantas: 500, minutos: 'abc', relogio: 'outro' })
    expect(config.assuntos).toEqual([{ id: A, peso: 10 }])
    expect(config.quantas).toBe(60)
    expect(config.minutos).toBe(90)
    expect(config.relogio).toBe('sempre')
    expect(config.titulo).toBe('Simulado Certo ou errado')
    expect(config.fracos).toBe(true)
  })
  it('sem assunto não monta', () => {
    expect(lerConfigProva({ assuntos: [] }).erro).toBe('Escolha pelo menos um assunto.')
  })
})

describe('texto por nível', () => {
  it('junta com vírgula e "e", no singular e no plural', () => {
    expect(textoPorNivel({ 1: 6, 2: 10, 3: 4 })).toBe('6 fáceis, 10 normais e 4 difíceis.')
    expect(textoPorNivel({ 2: 1 })).toBe('1 normal.')
    expect(textoPorNivel({ 4: 2, 5: 1 })).toBe('2 muito difíceis e 1 de desafio extremo.')
    expect(textoPorNivel({})).toBe('')
  })
})

describe('caderno', () => {
  const C = '33333333-3333-4333-8333-333333333333'
  const q = (id, assunto, tipo = 'multipla_escolha', nivel = 2, materia = 'm1') => ({ id, assunto_id: assunto, materia_id: materia, tipo, nivel, b: 0, vencida: false, nova: true, recente: false })
  const pool = [
    ...Array.from({ length: 12 }, (_, i) => q(`a${i}`, A, 'multipla_escolha', (i % 3) + 1)),
    ...Array.from({ length: 12 }, (_, i) => q(`b${i}`, B, 'multipla_escolha', (i % 3) + 1, 'm2')),
    q('c0', C, 'explicar'), q('c1', C, 'certo_errado'),
  ]
  const config = { formato: 'enem', quantas: 10, ordem: 'misturada', fracos: false, assuntos: [{ id: A, peso: 5 }, { id: B, peso: 5 }] }
  it('sorteia sem repetir, só tipos do formato, metade de cada assunto', () => {
    let s = 1
    const rng = () => ((s = (s * 16807) % 2147483647) / 2147483647)
    const lista = sortearCaderno(pool, config, { rng })
    expect(lista.length).toBe(10)
    expect(new Set(lista.map((x) => x.id)).size).toBe(10)
    expect(lista.filter((x) => x.assunto_id === A).length).toBe(5)
    expect(lista.every((x) => x.tipo === 'multipla_escolha')).toBe(true)
  })
  it('assunto fraco ganha mais questões', () => {
    const lista = sortearCaderno(pool, { ...config, fracos: true }, { rng: () => 0.3, thetas: { [A]: -1, [B]: 0.5 } })
    expect(lista.filter((x) => x.assunto_id === A).length > lista.filter((x) => x.assunto_id === B).length).toBe(true)
  })
  it('por matéria deixa os assuntos seguidos', () => {
    const lista = sortearCaderno(pool, { ...config, ordem: 'materia' }, { rng: () => 0.5 })
    const trocas = lista.slice(1).filter((x, i) => x.assunto_id !== lista[i].assunto_id).length
    expect(trocas).toBe(1)
  })
  it('troca uma questão por outra do mesmo assunto e ignora o que não vale', () => {
    const lista = trocarNoCaderno(pool, ['a0', 'b0', 'c0', 'zz'], ['a0'], { rng: () => 0, formato: 'enem' })
    expect(lista.length).toBe(2)
    expect(lista[0].assunto_id).toBe(A)
    expect(lista[0].id === 'a0').toBe(false)
    expect(lista[1].id).toBe('b0')
  })
})
