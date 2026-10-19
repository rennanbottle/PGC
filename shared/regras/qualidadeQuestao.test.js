import { describe, it, expect } from 'vitest'
import { conferirQuestaoEscolha, conferirSessao, balancearPosicoes } from './qualidadeQuestao.js'

const boa = {
  enunciado: 'Um gás ideal recebe 500 J de calor e realiza 200 J de trabalho. Qual é a variação da energia interna?',
  alternativas: [
    { texto: '300 J', correta: true },
    { texto: '700 J', erro: 'Somou calor e trabalho' },
    { texto: '-300 J', erro: 'Inverteu o sinal da primeira lei' },
    { texto: '200 J', erro: 'Confundiu trabalho com energia interna' },
    { texto: '500 J', erro: 'Ignorou o trabalho realizado' },
  ],
}
const ids = (r) => r.problemas.map((p) => p.id)

describe('conferência de questão de escolha', () => {
  it('aprova uma questão equilibrada', () => {
    expect(conferirQuestaoEscolha(boa).aprovada).toBe(true)
  })
  it('reprova quando a certa é a mais longa de longe', () => {
    const q = { enunciado: 'O que é mitocôndria?', alternativas: [
      { texto: 'Organela responsável pela respiração celular e produção de ATP na célula eucariótica', correta: true },
      { texto: 'Parte do núcleo', erro: 'a' }, { texto: 'Tipo de proteína', erro: 'b' }, { texto: 'Membrana externa', erro: 'c' },
    ] }
    const r = conferirQuestaoEscolha(q)
    expect(r.aprovada).toBe(false)
    expect(ids(r)).toContain('tamanho')
  })
  it('reprova "nenhuma das anteriores"', () => {
    const q = { ...boa, alternativas: [...boa.alternativas.slice(0, 4), { texto: 'Nenhuma das anteriores', erro: 'x' }] }
    expect(ids(conferirQuestaoEscolha(q))).toContain('proibida')
  })
  it('reprova alternativa errada sem o erro que representa', () => {
    const q = { ...boa, alternativas: boa.alternativas.map((a) => ({ ...a, erro: undefined })) }
    expect(ids(conferirQuestaoEscolha(q))).toContain('erro_representado')
  })
  it('reprova alternativas repetidas', () => {
    const q = { ...boa, alternativas: [...boa.alternativas.slice(0, 4), { texto: '700 j', erro: 'x' }] }
    expect(ids(conferirQuestaoEscolha(q))).toContain('repetida')
  })
  it('avisa quando só a certa tem ressalva', () => {
    const q = { enunciado: 'Sobre enzimas:', alternativas: [
      { texto: 'Em geral aceleram reações', correta: true },
      { texto: 'Aceleram todas as reações', erro: 'a' }, { texto: 'Nunca mudam de forma', erro: 'b' }, { texto: 'São sempre lipídios', erro: 'c' },
    ] }
    expect(ids(conferirQuestaoEscolha(q))).toContain('ressalva')
  })
})

describe('sessão', () => {
  it('limita a certa mais longa a 1 em cada 4', () => {
    const longa = { alternativas: [{ texto: 'certa bem longa', correta: true }, { texto: 'a' }, { texto: 'b' }, { texto: 'c' }] }
    expect(conferirSessao([longa, longa, boa, boa]).aprovada).toBe(false)
    expect(conferirSessao([longa, boa, boa, boa]).aprovada).toBe(true)
  })
  it('distribui a posição da certa por igual', () => {
    let s = 1
    const rng = () => ((s = (s * 16807) % 2147483647) / 2147483647)
    const questoes = Array.from({ length: 20 }, () => boa)
    const pos = balancearPosicoes(questoes, rng).map((q) => q.alternativas.findIndex((a) => a.correta))
    for (let p = 0; p < 5; p++) expect(pos.filter((x) => x === p)).toHaveLength(4)
  })
})

describe('alternativas parecidas', () => {
  it('acento muda a resposta: "à", "a", "há" e "ah" não são repetidas', () => {
    const q = {
      enunciado: 'Complete a frase: "Vou ___ escola amanhã."',
      alternativas: [
        { texto: 'à', correta: true, erro: '' },
        { texto: 'a', correta: false, erro: 'Esquece que escola pede artigo feminino.' },
        { texto: 'há', correta: false, erro: 'Confunde com o verbo haver.' },
        { texto: 'ah', correta: false, erro: 'Confunde com a interjeição.' },
      ],
    }
    const { problemas } = conferirQuestaoEscolha(q)
    expect(problemas.some((p) => p.id === 'repetida')).toBe(false)
  })
  it('a mesma alternativa escrita duas vezes continua sendo repetida', () => {
    const q = {
      enunciado: 'Qual é a capital do Brasil?',
      alternativas: [
        { texto: 'Brasília', correta: true },
        { texto: 'brasília ', correta: false },
        { texto: 'Rio de Janeiro', correta: false },
        { texto: 'Salvador', correta: false },
      ],
    }
    expect(conferirQuestaoEscolha(q).problemas.some((p) => p.id === 'repetida')).toBe(true)
  })
})
