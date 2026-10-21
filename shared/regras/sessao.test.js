import { describe, expect, it } from 'vitest'
import { corrigir, dicas, lerNumero, maxDicasDoNivel, normalizarTexto, paraResponder, partesComLacunas, permutacao, sorteador, textoDaCerta, textoDaResposta } from './sessao.js'

const me = { tipo: 'multipla_escolha', enunciado: 'Altura?', conteudo: { alternativas: [{ texto: '15 m', correta: false, erro: 'esqueceu o quadrado' }, { texto: '30 m', correta: false, erro: 'velocidade constante' }, { texto: '45 m', correta: true }, { texto: '90 m', correta: false, erro: 'esqueceu de dividir por 2' }] } }

describe('embaralhar com semente', () => {
  it('a mesma semente dá a mesma ordem; ordenar nunca vem na ordem certa', () => {
    expect(permutacao(6, sorteador('x'))).toEqual(permutacao(6, sorteador('x')))
    expect(permutacao(2, () => 0.99, true)).toEqual([1, 0])
  })
  it('a tela não recebe gabarito nem o erro de cada alternativa', () => {
    const v = paraResponder(me, 's1')
    expect(v.alternativas).toHaveLength(4)
    expect(JSON.stringify(v).includes('correta')).toBe(false)
    expect(JSON.stringify(v).includes('quadrado')).toBe(false)
  })
})

describe('corrigir', () => {
  it('múltipla escolha pela posição embaralhada, com o erro da escolhida', () => {
    const v = paraResponder(me, 's1')
    const certa = v.alternativas.indexOf('45 m')
    const errada = v.alternativas.indexOf('30 m')
    expect(corrigir(me, 's1', { escolha: certa }).resultado).toBe('correta')
    const r = corrigir(me, 's1', { escolha: errada })
    expect(r.resultado).toBe('incorreta')
    expect(r.detalhe.erro).toBe('velocidade constante')
    expect(r.detalhe.certa).toBe(certa)
  })
  it('múltipla resposta desconta marcação errada', () => {
    const q = { tipo: 'multipla_resposta', conteudo: { alternativas: [{ texto: 'a', correta: true }, { texto: 'b', correta: true }, { texto: 'c', correta: false }, { texto: 'd', correta: false }] } }
    const v = paraResponder(q, 'k')
    const pos = (t) => v.alternativas.indexOf(t)
    expect(corrigir(q, 'k', { marcadas: [pos('a'), pos('b')] }).resultado).toBe('correta')
    expect(corrigir(q, 'k', { marcadas: [pos('a')] }).resultado).toBe('parcial')
    expect(corrigir(q, 'k', { marcadas: [pos('a'), pos('c')] }).resultado).toBe('incorreta')
  })
  it('lacuna digitada sem acento nem maiúscula', () => {
    const q = { tipo: 'lacuna_digitada', enunciado: 'A ___ é ...', conteudo: { lacunas: [{ respostas: ['aceleração'] }] } }
    expect(corrigir(q, 'z', { textos: ['  Aceleracao. '] }).resultado).toBe('correta')
  })
  it('numérica com vírgula e tolerância em porcentagem', () => {
    const q = { tipo: 'numerica', conteudo: { resposta: 9.8, tolerancia: 2, unidade: 'm/s²' } }
    expect(corrigir(q, 'z', { valor: '9,9' }).resultado).toBe('correta')
    expect(corrigir(q, 'z', { valor: '10,1' }).resultado).toBe('incorreta')
    expect(lerNumero('1.234,5')).toBe(1234.5)
  })
  it('ordenar, associar e classificar pela ordem que a tela mostrou', () => {
    const o = { tipo: 'ordenar', conteudo: { itens: ['um', 'dois', 'três', 'quatro'] } }
    const vo = paraResponder(o, 'q')
    const certa = ['um', 'dois', 'três', 'quatro'].map((t) => vo.itens.indexOf(t))
    expect(corrigir(o, 'q', { ordem: certa }).resultado).toBe('correta')
    const a = { tipo: 'associar', conteudo: { pares: [{ a: 'v', b: 'velocidade' }, { a: 'a', b: 'aceleração' }, { a: 't', b: 'tempo' }] } }
    const va = paraResponder(a, 'q')
    const lig = { 0: va.direita.indexOf('velocidade'), 1: va.direita.indexOf('aceleração'), 2: va.direita.indexOf('tempo') }
    expect(corrigir(a, 'q', { ligacoes: lig }).resultado).toBe('correta')
    const c = { tipo: 'classificar', conteudo: { grupos: [{ nome: 'Metais', itens: ['ferro', 'cobre'] }, { nome: 'Gases', itens: ['neônio', 'argônio'] }] } }
    const vc = paraResponder(c, 'q')
    const grupos = Object.fromEntries(vc.itens.map((t, p) => [p, ['ferro', 'cobre'].includes(t) ? 0 : 1]))
    expect(corrigir(c, 'q', { grupos }).resultado).toBe('correta')
  })
  it('cartão e resposta curta pedem autoavaliação; resposta curta tem confiança baixa', () => {
    const cartao = { tipo: 'cartao', conteudo: { verso: 'Newton' } }
    expect(corrigir(cartao, 'q', { texto: 'x' }).pendente).toBe(true)
    expect(corrigir(cartao, 'q', { texto: 'x', autoavaliacao: 'quase' }).resultado).toBe('parcial')
    const curta = { tipo: 'resposta_curta', conteudo: { resposta: 'r', pontos: ['p1', 'p2'] } }
    const r = corrigir(curta, 'q', { texto: 'x', pontos: [true, true] })
    expect(r.resultado).toBe('correta')
    expect(r.confianca).toBe('baixa')
  })
})

describe('dicas', () => {
  it('limite pelo nível: Fácil 3, Normal 2, Difícil 1, acima nenhuma', () => {
    expect([1, 2, 3, 4, 5].map(maxDicasDoNivel)).toEqual([3, 2, 1, 0, 0])
  })
  it('começa pelo trecho do material e depois tira alternativas erradas', () => {
    const d = dicas(me, 's1', { trecho: { texto: 'Partindo do repouso...', pagina: 12 } })
    expect(d).toHaveLength(3)
    expect(d[0].texto).toContain('página 12')
    expect(d[2].eliminar).toHaveLength(2)
    const v = paraResponder(me, 's1')
    expect(d[2].eliminar.includes(v.alternativas.indexOf('45 m'))).toBe(false)
  })
  it('numérica diz a ordem de grandeza', () => {
    expect(dicas({ tipo: 'numerica', conteudo: { resposta: 45, unidade: 'm' } }, 'z')[0].texto).toBe('A resposta fica entre 10 e 100, em m.')
  })
})

describe('textos', () => {
  it('certa e resposta em texto curto', () => {
    const v = paraResponder(me, 's1')
    expect(textoDaCerta(me, 's1')).toContain('45 m')
    expect(textoDaResposta(me, 's1', { escolha: v.alternativas.indexOf('30 m') })).toContain('30 m')
    expect(normalizarTexto('Ação!')).toBe('acao')
    expect(partesComLacunas('A ___ e o ___.')).toHaveLength(5)
  })
})
