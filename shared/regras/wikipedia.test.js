import { describe, it, expect } from 'vitest'
import { enderecoArtigo, limparExtrato, limparTrecho } from './wikipedia.js'

describe('Wikipédia', () => {
  it('transforma títulos de seção em linhas e corta as referências', () => {
    const t = limparExtrato('Queda livre é o movimento de um corpo sob ação só da gravidade.\n\n\n== Equações ==\nh = g·t²/2\n\n== Referências ==\n1. Livro X')
    expect(t).toBe('Queda livre é o movimento de um corpo sob ação só da gravidade.\n\nEquações\n\nh = g·t²/2')
  })
  it('limpa o destaque da busca', () => {
    expect(limparTrecho('A <span class="searchmatch">queda</span> livre &quot;ideal&quot;')).toBe('A queda livre "ideal"')
  })
  it('monta o endereço com o título codificado', () => {
    expect(enderecoArtigo('Queda livre')).toContain('titles=Queda+livre')
  })
})

describe('Wikilivros e Wikiversidade', () => {
  it('usa o endereço de cada projeto e só páginas de conteúdo', async () => {
    const { enderecoBusca, enderecoPagina } = await import('./wikipedia.js')
    expect(enderecoBusca('cinemática', 5, 'wikilivros')).toContain('https://pt.wikibooks.org/w/api.php')
    expect(enderecoBusca('cinemática', 5, 'wikiversidade')).toContain('srnamespace=0')
    expect(enderecoPagina('Física/Cinemática', 'wikilivros')).toBe('https://pt.wikibooks.org/wiki/F%C3%ADsica%2FCinem%C3%A1tica')
  })
})

describe('busca do tema com contexto', async () => {
  const { consultaDoTema, ordenarResultados, pontuarResultado } = await import('./wikipedia.js')
  const lista = [
    { fonte: 'wikipedia', titulo: 'História do Python', trecho: 'A história da linguagem começou em 1989', palavras: 3000 },
    { fonte: 'wikipedia', titulo: 'Python', trecho: 'Python é uma linguagem de programação', palavras: 5000 },
    { fonte: 'wikilivros', titulo: 'Python/Listas', trecho: 'Listas guardam vários valores', palavras: 900 },
    { fonte: 'wikiversidade', titulo: 'Introdução ao Python', trecho: 'Curso de Python', palavras: 80 },
  ]

  it('junta a matéria técnica ao tema, sem repetir', () => {
    expect(consultaDoTema({ tema: 'Listas', materia: 'Python', area: 'programacao' })).toBe('Listas Python')
    expect(consultaDoTema({ tema: 'Python', materia: 'Python', area: 'programacao' })).toBe('Python')
    expect(consultaDoTema({ tema: 'Era Vargas', materia: 'História', area: 'humanas' })).toBe('Era Vargas')
    expect(consultaDoTema({ assunto: 'Cinemática', materia: 'Física', area: 'natureza' })).toBe('Cinemática Física')
  })

  it('em matéria técnica, história desce e material didático sobe', () => {
    const r = ordenarResultados(lista, { tema: 'Python', materia: 'Python', area: 'programacao', assunto: 'Listas e tuplas' })
    expect(r[0].titulo).toBe('Python/Listas')
    expect(r.at(-1).titulo).toBe('História do Python')
  })

  it('em humanas, história não é penalizada', () => {
    const p = (area) => pontuarResultado(lista[0], { tema: 'Python', area })
    expect(p('humanas')).toBeGreaterThan(p('programacao'))
  })

  it('não repete o mesmo resultado e respeita o limite', () => {
    expect(ordenarResultados([...lista, lista[1]], {}, 10)).toHaveLength(4)
    expect(ordenarResultados(lista, {}, 2)).toHaveLength(2)
  })
})

describe('seções da página', async () => {
  const { montarTexto, secoesDoExtrato, fonteDoEndereco } = await import('./wikipedia.js')
  const extrato = 'Abertura do tema.\n\n== Listas ==\nUma lista guarda itens.\n=== Fatias ===\nlista[1:3]\n\n== Tuplas ==\nNão mudam.\n\n== Referências ==\nLivro'

  it('separa em seções de nível 2, com subseções dentro, e corta o fim', () => {
    const s = secoesDoExtrato(extrato)
    expect(s.map((x) => x.titulo)).toEqual(['Introdução', 'Listas', 'Tuplas'])
    expect(s[1].texto).toContain('Fatias')
    expect(s[1].palavras).toBeGreaterThan(3)
  })

  it('monta o texto só com as seções escolhidas', () => {
    expect(montarTexto(extrato, [2])).toBe('Tuplas\n\nNão mudam.')
    expect(montarTexto(extrato)).toContain('Abertura do tema.')
    expect(montarTexto(extrato)).not.toContain('Livro')
  })

  it('reconhece a fonte pelo endereço', () => {
    expect(fonteDoEndereco('https://pt.wikibooks.org/wiki/Python')).toBe('wikilivros')
    expect(fonteDoEndereco('https://exemplo.com/x')).toBe(null)
  })
})
