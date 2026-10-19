import { describe, expect, it } from 'vitest'
import { areaDoEnem, limparContexto, questaoDoEnem, resumoEnem } from './enem.js'

const base = {
  title: 'Questão 140 - ENEM 2022', index: 140, discipline: 'matematica', language: null, year: 2022,
  context: 'Uma loja vende **camisetas**.\n\n![](https://enem.dev/2022/questions/140/a.png)\n\nO dono quer saber o total.',
  files: [], correctAlternative: 'B', alternativesIntroduction: 'Quantas camisetas foram vendidas?',
  alternatives: [{ letter: 'A', text: '22.', file: null, isCorrect: false }, { letter: 'B', text: '25.', file: null, isCorrect: true }, { letter: 'C', text: '28.', file: null, isCorrect: false }],
}

describe('Enem', () => {
  it('tira a imagem do texto e guarda o endereço', () => {
    const r = limparContexto(base.context)
    expect(r.imagens).toEqual(['https://enem.dev/2022/questions/140/a.png'])
    expect(r.texto).toBe('Uma loja vende camisetas.\n\nO dono quer saber o total.')
  })
  it('converte para múltipla escolha com gabarito, fonte e chave', () => {
    const r = questaoDoEnem(base)
    expect(r.ok).toBe(true)
    expect(r.questao.conteudo.alternativas[1].correta).toBe(true)
    expect(r.questao.enunciado.endsWith('Quantas camisetas foram vendidas?')).toBe(true)
    expect(r.questao.fonte).toBe('Enem 2022, questão 140')
    expect(r.questao.chave).toBe('enem:2022:140:')
    expect(r.questao.imagem).toBe('https://enem.dev/2022/questions/140/a.png')
  })
  it('deixa de fora alternativa em imagem, mais de uma figura e figura de outro site', () => {
    const img = { ...base, alternatives: base.alternatives.map((a) => ({ ...a, text: '[Image file]', file: 'https://enem.dev/x.png' })) }
    expect(questaoDoEnem(img).motivo).toBe('alternativas em imagem')
    expect(questaoDoEnem({ ...base, files: ['https://enem.dev/b.png'] }).motivo).toBe('mais de uma figura')
    expect(questaoDoEnem({ ...base, context: '![](https://outro.com/a.png) Texto' }).motivo).toBe('figura fora do enem.dev')
  })
  it('lê a área e resume para a lista', () => {
    expect(areaDoEnem('ciencias-humanas')).toBe('humanas')
    expect(areaDoEnem('ciencias-natureza')).toBe('natureza')
    const r = resumoEnem({ ...base, language: 'ingles' })
    expect(r.chave).toBe('enem:2022:140:ingles')
    expect(r.figura).toBe(true)
  })
})
