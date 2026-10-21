import { describe, it, expect } from 'vitest'
import { lerBancoDePlanilha, lerBancoDeTexto, lerCsv, lerGabarito, sugerirAssunto } from './importarBanco.js'

const pagina = (numero, texto) => ({ numero, linhas: texto.split('\n').map((t) => ({ texto: t })) })
const prova = [
  pagina(1, `Lista de Cinemática
1. (UFPR 2019) Um objeto é lançado verticalmente para cima com velocidade inicial de 20 m/s.
Desprezando a resistência do ar, a altura máxima atingida é:
a) 10 m
b) 20 m
c) 40 m
d) 80 m

2. Observe o gráfico abaixo e indique em que intervalo o móvel está parado.
(A) 0 a 2 s
(B) 2 a 4 s
(C) 4 a 6 s
(D) 6 a 8 s`),
  pagina(2, `Questão 3
(Fuvest) Uma bola é abandonada de uma altura de 80 m. O tempo de queda, em segundos, é:
a) 2   b) 4   c) 8   d) 16   e) 40
4. Explique a diferença entre trajetória e deslocamento.
5. Em queda livre, a aceleração não depende da massa do corpo.

Gabarito
1-B, 2-C, 3-B, 5-C`),
]

describe('banco em texto', () => {
  const r = lerBancoDeTexto(prova)
  it('reconhece as 5 questões pela numeração', () => {
    expect(r.questoes.map((q) => q.numero)).toEqual([1, 2, 3, 4, 5])
    expect(r.gabaritoPagina).toBe(2)
    expect(r.gabaritoAte).toBe(5)
  })
  it('separa fonte, enunciado e alternativas', () => {
    const q = r.questoes[0]
    expect(q.fonte).toBe('UFPR 2019')
    expect(q.enunciado).toBe('Um objeto é lançado verticalmente para cima com velocidade inicial de 20 m/s. Desprezando a resistência do ar, a altura máxima atingida é:')
    expect(q.conteudo.alternativas.map((a) => a.texto)).toEqual(['10 m', '20 m', '40 m', '80 m'])
    expect(q.conteudo.alternativas[1].correta).toBe(true)
    expect(q.gabaritoConfirmado).toBe(true)
  })
  it('lê alternativas entre parênteses e na mesma linha', () => {
    expect(r.questoes[1].conteudo.alternativas).toHaveLength(4)
    expect(r.questoes[2].conteudo.alternativas.map((a) => a.texto)).toEqual(['2', '4', '8', '16', '40'])
    expect(r.questoes[2].fonte).toBe('Fuvest')
  })
  it('marca a questão que cita figura', () => {
    expect(r.questoes[1].precisaImagem).toBe(true)
    expect(r.questoes[0].precisaImagem).toBe(false)
  })
  it('questão sem alternativas e sem gabarito vira aberta; com C vira certo ou errado', () => {
    expect(r.questoes[3].tipo).toBe('resposta_curta')
    expect(r.questoes[3].aberta).toBe(true)
    expect(r.questoes[4].tipo).toBe('certo_errado')
    expect(r.questoes[4].conteudo.certo).toBe(true)
  })
})

describe('gabarito', () => {
  it('lê pares e tabela', () => {
    const g = lerGabarito(['01. C  02. A', '3 4 5', 'B D E'])
    expect(g.get(1)).toBe('C')
    expect(g.get(2)).toBe('A')
    expect(g.get(3)).toBe('B')
    expect(g.get(5)).toBe('E')
  })
})

describe('planilha', () => {
  it('lê CSV com ponto e vírgula, aspas e gabarito por letra ou texto', () => {
    const linhas = lerCsv('enunciado;a;b;c;d;gabarito;assunto\n"Qual é a unidade de força no SI?";Joule;Newton;Watt;Pascal;B;Dinâmica\nQual organela produz ATP?;Ribossomo;Mitocôndria;Lisossomo;Golgi;Mitocôndria;Citologia\n')
    expect(linhas).toHaveLength(3)
    const r = lerBancoDePlanilha(linhas)
    expect(r.questoes).toHaveLength(2)
    expect(r.questoes[0].conteudo.alternativas[1].correta).toBe(true)
    expect(r.questoes[1].conteudo.alternativas[1].correta).toBe(true)
    expect(r.questoes[1].assuntoNome).toBe('Citologia')
  })
  it('avisa quando falta a coluna do enunciado', () => {
    expect(lerBancoDePlanilha([['pergunta x', 'a'], ['1', '2']]).colunasFaltando).toEqual(['enunciado'])
  })
})

describe('assunto sugerido', () => {
  it('escolhe pelo nome e pelos termos do material', () => {
    const assuntos = [{ id: 'q', nome: 'Queda livre', palavras: ['abandonado', 'aceleração da gravidade'] }, { id: 'm', nome: 'Movimento uniforme', palavras: ['velocidade constante'] }]
    const s = sugerirAssunto('Uma bola é abandonada de uma altura de 80 m. O tempo de queda é:', assuntos)
    expect(s.id).toBe('q')
    expect(s.motivo).toContain('abandonada')
  })
})
