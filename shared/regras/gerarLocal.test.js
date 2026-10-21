import { describe, it, expect } from 'vitest'
import { acontecimentos, gerarDoMaterial, lacunaDoTermo } from './gerarLocal.js'
import { conferirQuestao } from './questoes.js'

const trechos = [
  { id: 't1', ordem: 1, pagina: 1, tipo: 'titulo', texto: '1. Cinemática', assunto_id: 'a1' },
  { id: 't2', ordem: 2, pagina: 1, tipo: 'texto', texto: 'Trajetória é o conjunto de posições ocupadas por um móvel ao longo do tempo. Ela depende do referencial.', assunto_id: 'a1' },
  { id: 't3', ordem: 3, pagina: 1, tipo: 'texto', texto: 'Referencial é o corpo em relação ao qual se mede o movimento.', assunto_id: 'a1' },
  { id: 't4', ordem: 4, pagina: 2, tipo: 'texto', texto: 'Deslocamento é a diferença entre a posição final e a inicial.', assunto_id: 'a1' },
  { id: 't5', ordem: 5, pagina: 2, tipo: 'texto', texto: 'Velocidade média é a razão entre o deslocamento e o intervalo de tempo.', assunto_id: 'a1' },
  { id: 't6', ordem: 6, pagina: 2, tipo: 'formula', texto: 'v = Δs/Δt', assunto_id: 'a1' },
  { id: 't7', ordem: 7, pagina: 3, tipo: 'titulo', texto: 'Etapas para resolver um problema', assunto_id: 'a1' },
  { id: 't8', ordem: 8, pagina: 3, tipo: 'lista', texto: '1. Ler o enunciado\n2. Anotar os dados\n3. Escolher a fórmula\n4. Calcular e conferir a unidade', assunto_id: 'a1' },
  { id: 't9', ordem: 9, pagina: 4, tipo: 'titulo', texto: 'Grandezas escalares' },
  { id: 't10', ordem: 10, pagina: 4, tipo: 'lista', texto: '- massa\n- tempo\n- temperatura' },
  { id: 't11', ordem: 11, pagina: 4, tipo: 'titulo', texto: 'Grandezas vetoriais' },
  { id: 't12', ordem: 12, pagina: 4, tipo: 'lista', texto: '- força\n- velocidade\n- aceleração' },
  { id: 't13', ordem: 13, pagina: 5, tipo: 'rodape', texto: 'Apostila de Física, página 5', usar_em_questoes: false },
]
const def = (id, trecho, termo, definicao) => ({ id, trecho_id: trecho, tipo: 'definicao', termo, definicao, status: 'aprovado', pagina: 1 })
const conceitos = [
  def('c1', 't2', 'Trajetória', 'é o conjunto de posições ocupadas por um móvel ao longo do tempo.'),
  def('c2', 't3', 'Referencial', 'é o corpo em relação ao qual se mede o movimento.'),
  def('c3', 't4', 'Deslocamento', 'é a diferença entre a posição final e a inicial.'),
  def('c4', 't5', 'Velocidade média', 'é a razão entre o deslocamento e o intervalo de tempo.'),
  { id: 'c5', trecho_id: 't6', tipo: 'formula', termo: 'v = Δs/Δt', definicao: 'Cinemática', status: 'aprovado' },
  { id: 'c6', trecho_id: 't2', tipo: 'definicao', termo: 'Móvel', definicao: 'corpo que muda de posição', status: 'recusado' },
]

describe('geração sem IA', () => {
  const r = gerarDoMaterial({ trechos, conceitos })
  it('troca o termo por lacuna na frase do próprio material', () => {
    expect(lacunaDoTermo(trechos[1].texto, 'Trajetória')).toBe('______ é o conjunto de posições ocupadas por um móvel ao longo do tempo.')
    expect(r.lacuna.questoes).toHaveLength(4)
    expect(r.lacuna.questoes[0].conteudo.lacunas[0].respostas).toEqual(['Trajetória'])
  })
  it('não usa conceito recusado', () => {
    expect(r.cartao.questoes.some((q) => q.enunciado.includes('móvel?'))).toBe(false)
    expect(r.cartao.questoes[0].enunciado).toBe('O que é trajetória?')
    expect(r.cartao.questoes[0].conteudo.verso).toBe('O conjunto de posições ocupadas por um móvel ao longo do tempo')
  })
  it('monta associar com 4 termos do mesmo assunto', () => {
    expect(r.associar.questoes).toHaveLength(1)
    expect(r.associar.questoes[0].conteudo.pares).toHaveLength(4)
  })
  it('gera 3 variações numéricas com a resposta calculada', () => {
    expect(r.numerica.questoes).toHaveLength(3)
    const q = r.numerica.questoes[0]
    const nums = Object.fromEntries([...q.enunciado.matchAll(/(Δ\w) = (\d+)/g)].map((m) => [m[1], Number(m[2])]))
    expect(q.conteudo.resposta).toBeCloseTo(Math.round((nums['Δs'] / nums['Δt']) * 100) / 100, 2)
  })
  it('ordena a lista numerada com o título como contexto', () => {
    expect(r.ordenar.questoes).toHaveLength(1)
    expect(r.ordenar.questoes[0].enunciado).toBe('Coloque na ordem certa: Etapas para resolver um problema.')
    expect(r.ordenar.questoes[0].conteudo.itens[0]).toBe('Ler o enunciado')
  })
  it('classifica listas de títulos diferentes', () => {
    expect(r.classificar.questoes).toHaveLength(1)
    expect(r.classificar.questoes[0].conteudo.grupos.map((g) => g.nome)).toEqual(['Grandezas escalares', 'Grandezas vetoriais'])
  })
  it('diz por que a cronologia ficou vazia', () => {
    expect(r.cronologia.questoes).toHaveLength(0)
    expect(r.cronologia.motivo).toBe('Não há 3 datas com ano no texto.')
  })
  it('toda questão gerada passa na conferência e nasce fácil ou normal', () => {
    const todas = Object.values(r).flatMap((t) => t.questoes)
    expect(todas.length).toBe(4 + 4 + 3 + 1 + 1 + 1)
    for (const q of todas) {
      expect(conferirQuestao(q).aprovada).toBe(true)
      expect(q.nivel).toBeLessThanOrEqual(2)
      expect(q.bloom).toBeLessThanOrEqual(2)
    }
  })
  it('não repete o que já foi gerado', () => {
    const existentes = new Set(r.lacuna.questoes.map((q) => q.chave))
    const de_novo = gerarDoMaterial({ trechos, conceitos, existentes })
    expect(de_novo.lacuna.questoes).toHaveLength(0)
    expect(de_novo.lacuna.repetidas).toBe(4)
    expect(de_novo.lacuna.motivo).toBe('Todas já foram geradas antes.')
  })
})

describe('cronologia', () => {
  const historia = [{ id: 'h1', ordem: 1, pagina: 1, tipo: 'texto', texto: 'Em 1889, a monarquia foi derrubada e começou a República. Em 1930, Getúlio Vargas chegou ao poder com o apoio dos tenentes. O Estado Novo foi instalado em 1937, com uma nova Constituição. Em 1945, Vargas foi deposto pelos militares.' }]
  it('tira o ano da frase e ordena pelos anos', () => {
    expect(acontecimentos(historia)[0].texto).toBe('A monarquia foi derrubada e começou a República.')
    const r = gerarDoMaterial({ trechos: historia, conceitos: [] })
    expect(r.cronologia.questoes).toHaveLength(1)
    expect(r.cronologia.questoes[0].conteudo.itens[2]).toBe('O Estado Novo foi instalado, com uma nova Constituição.')
  })
})
