import { describe, it, expect } from 'vitest'
import { TIPOS, ajustarLacunas, conferirQuestao, conteudoVazio, contarLacunas, prepararParaGravar, situacaoDaQuestao, trechoParaLista, trocarTipo } from './questoes.js'
import { analisarExpressao, calcular, lerFormula } from './expressoes.js'

const ids = (r) => r.problemas.map((p) => p.id)
const pedra = {
  tipo: 'multipla_escolha',
  enunciado: 'Uma pedra é solta do alto de um prédio e leva 3 s para chegar ao chão. Usando g = 10 m/s², qual é a altura do prédio?',
  conteudo: { alternativas: [
    { texto: '15 m', erro: 'Usou h = g·t/2: esqueceu de elevar o tempo ao quadrado.' },
    { texto: '30 m', erro: 'Usou h = g·t, como se a velocidade fosse constante.' },
    { texto: '45 m', correta: true },
    { texto: '90 m', erro: '' },
  ] },
}

describe('tipos', () => {
  it('são 17 na V1, cada um com conteúdo inicial', () => {
    expect(TIPOS).toHaveLength(17)
    for (const t of TIPOS) expect(typeof conteudoVazio(t.id)).toBe('object')
  })
  it('conta as lacunas marcadas com sublinhados', () => {
    expect(contarLacunas('O ______ é a ___ do móvel. __ não conta.')).toBe(2)
  })
  it('acerta o número de lacunas do conteúdo pelo enunciado', () => {
    const c = ajustarLacunas('A ___ e o ___', { lacunas: [{ respostas: ['x'] }] }, 'lacuna_digitada')
    expect(c.lacunas).toHaveLength(2)
    expect(c.lacunas[0].respostas[0]).toBe('x')
  })
  it('troca de múltipla escolha para texto-base mantendo as alternativas', () => {
    const c = trocarTipo(pedra.conteudo, 'multipla_escolha', 'texto_base')
    expect(c.alternativas).toHaveLength(4)
    expect(c.alternativas[2].correta).toBe(true)
    expect(c.textoBase).toBe('')
  })
})

describe('conferência por tipo', () => {
  it('falha a múltipla escolha com alternativa errada sem o erro', () => {
    const r = conferirQuestao(pedra)
    expect(r.aprovada).toBe(false)
    expect(ids(r)).toContain('erro_representado')
  })
  it('aprova a múltipla escolha completa', () => {
    const q = structuredClone(pedra)
    q.conteudo.alternativas[3].erro = 'Usou h = g·t²: esqueceu de dividir por 2.'
    expect(conferirQuestao(q).aprovada).toBe(true)
  })
  it('importada não exige o erro de cada alternativa, mas exige o gabarito', () => {
    const q = structuredClone(pedra)
    expect(conferirQuestao(q, { importada: true }).aprovada).toBe(true)
    q.conteudo.alternativas[2].correta = false
    expect(ids(conferirQuestao(q, { importada: true }))).toContain('gabarito')
  })
  it('múltipla resposta precisa de pelo menos duas certas', () => {
    const q = { tipo: 'multipla_resposta', enunciado: 'Quais são organelas membranosas?', conteudo: { alternativas: [
      { texto: 'Mitocôndria', correta: true }, { texto: 'Ribossomo', erro: 'a' }, { texto: 'Lisossomo', erro: 'b' }, { texto: 'Centríolo', erro: 'c' },
    ] } }
    expect(ids(conferirQuestao(q))).toContain('gabarito')
  })
  it('lacuna digitada sem lacuna no enunciado falha', () => {
    const q = { tipo: 'lacuna_digitada', enunciado: 'Trajetória é o conjunto de posições.', conteudo: { lacunas: [] } }
    expect(ids(conferirQuestao(q))).toContain('lacuna')
  })
  it('lacuna com opções exige 3 opções e a certa marcada', () => {
    const q = { tipo: 'lacuna_opcoes', enunciado: 'A ___ é a variação da velocidade.', conteudo: { lacunas: [{ opcoes: ['aceleração', 'massa'], certa: 0 }] } }
    expect(ids(conferirQuestao(q))).toContain('opcoes')
  })
  it('associar precisa de 3 pares completos', () => {
    const q = { tipo: 'associar', enunciado: 'Ligue cada termo à definição.', conteudo: { pares: [{ a: 'x', b: 'y' }, { a: 'z', b: '' }] } }
    const r = ids(conferirQuestao(q))
    expect(r).toContain('quantidade')
    expect(r).toContain('par_incompleto')
  })
  it('classificar recusa item repetido entre grupos', () => {
    const q = { tipo: 'classificar', enunciado: 'Separe nos grupos certos.', conteudo: { grupos: [{ nome: 'Escalares', itens: ['massa', 'tempo'] }, { nome: 'Vetoriais', itens: ['força', 'massa'] }] } }
    expect(ids(conferirQuestao(q))).toContain('repetida')
  })
  it('numérica precisa de número e tolerância até 20%', () => {
    expect(ids(conferirQuestao({ tipo: 'numerica', enunciado: 'Quanto vale a velocidade?', conteudo: { resposta: null, tolerancia: 50 } }))).toContain('tolerancia')
    expect(conferirQuestao({ tipo: 'numerica', enunciado: 'Quanto vale a velocidade?', conteudo: { resposta: 80, tolerancia: 1 } }).aprovada).toBe(true)
  })
  it('cartão com frente igual ao verso falha', () => {
    expect(ids(conferirQuestao({ tipo: 'cartao', enunciado: 'O que é vetor?', conteudo: { verso: 'o que é vetor?' } }))).toContain('repetida')
  })
  it('explicar precisa de dois pontos-chave', () => {
    const q = { tipo: 'explicar', enunciado: 'Explique por que o céu é azul.', conteudo: { resposta: 'Espalhamento de Rayleigh da luz solar.', pontos: ['espalhamento'] } }
    expect(ids(conferirQuestao(q))).toContain('pontos')
  })
})

describe('situação e gravação', () => {
  it('diz por que a questão está fora das revisões', () => {
    expect(situacaoDaQuestao({ status: 'ativa', gabarito_confirmado: false, qualidade_aprovada: true }).texto).toBe('gabarito não confirmado')
    expect(situacaoDaQuestao({ status: 'ativa', gabarito_confirmado: true, qualidade_aprovada: true })).toBeNull()
  })
  it('limpa itens vazios e guarda o resultado da conferência', () => {
    const { campos } = prepararParaGravar({ tipo: 'ordenar', enunciado: 'Coloque em ordem as fases da mitose.', conteudo: { itens: ['Prófase', ' Metáfase ', '', 'Anáfase', 'Telófase'] } })
    expect(campos.conteudo.itens).toEqual(['Prófase', 'Metáfase', 'Anáfase', 'Telófase'])
    expect(campos.qualidade_aprovada).toBe(true)
  })
})

describe('fórmulas', () => {
  it('calcula com multiplicação implícita, potência e índices', () => {
    expect(calcular(analisarExpressao('g·t²/2'), { g: 10, t: 3 })).toBe(45)
    expect(calcular(analisarExpressao('s₀ + vt'), { s0: 8, v: 3, t: 5 })).toBe(23)
    expect(calcular(analisarExpressao('Δs/Δt'), { 'Δs': 120, 'Δt': 1.5 })).toBe(80)
    expect(calcular(analisarExpressao('√(2gh)'), { g: 10, h: 5 })).toBe(10)
  })
  it('lê "Ec = m·v²/2" e recusa texto que não é fórmula', () => {
    const f = lerFormula('Ec = m·v²/2')
    expect(f.nome).toBe('Ec')
    expect(f.variaveis).toEqual(['m', 'v'])
    expect(lerFormula('a velocidade é alta')).toBeNull()
  })
})

describe('trechoParaLista', () => {
  it('troca bloco de código por código na linha e corta sem deixar crase aberta', () => {
    expect(trechoParaLista('O que imprime?\n```python\nx = 2\nprint(x * 3)\n```')).toBe('O que imprime? `x = 2 print(x * 3)`')
    const cortado = trechoParaLista('Veja `uma_funcao_com_nome_grande()` aqui', 20)
    expect(cortado.endsWith('`…')).toBe(true)
    expect((cortado.match(/`/g) ?? []).length % 2).toBe(0)
    expect(trechoParaLista('  curto\n\n texto ')).toBe('curto texto')
    expect(trechoParaLista(null)).toBe('')
  })
})

describe('questão escrita pela pessoa', () => {
  it('o erro de cada alternativa errada vira aviso, não falha', () => {
    const q = { tipo: 'multipla_escolha', enunciado: 'Quanto é 3 vezes 4?', conteudo: { alternativas: [{ texto: '12', correta: true }, { texto: '7' }, { texto: '34' }, { texto: '1' }] } }
    expect(conferirQuestao(q).aprovada).toBe(false)
    const r = conferirQuestao(q, { propria: true })
    expect(r.aprovada).toBe(true)
    expect(r.problemas.find((p) => p.id === 'erro_representado').nivel).toBe('aviso')
  })
})
