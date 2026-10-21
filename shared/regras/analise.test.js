import { describe, expect, it } from 'vitest'
import { acharDefinicao, contarSilabas, dividirTextoLongo, faixaLegibilidade, frequencias, legibilidade, pareceFormula, prepararMaterial, termosChave } from './analise.js'

const L = (...linhas) => linhas.map((t) => (typeof t === 'string' ? { texto: t } : t))

function apostila() {
  const pagina = (n, linhas) => ({ numero: n, linhas: L(...linhas, '', `Página ${n} de 4  Física Básica, Editora Exemplo`) })
  return [
    pagina(1, ['1. Cinemática', 'Referencial é o corpo em relação ao qual se observa o movimento de um objeto qualquer.', 'A trajetória depende do referencial escolhido para a observação do movimento.']),
    pagina(2, ['1.3 Velocidade média', 'A velocidade média de um corpo é a razão entre o deslocamento sofrido e o intervalo de tempo gas-', 'to no percurso. No Sistema Internacional, é medida em metros por segundo.', '', 'vm = Δs / Δt', '', 'Exemplo: um carro percorre 120 km em 2 h e sua velocidade média é 60 km/h.']),
    pagina(3, ['2. Queda livre', 'Denomina-se queda livre o movimento de um corpo sob ação apenas da gravidade.', '- O corpo parte do repouso', '- A aceleração é constante']),
    pagina(4, ['3. Lançamento oblíquo', 'O lançamento oblíquo combina um movimento uniforme na horizontal com um movimento variado na vertical.']),
  ]
}

describe('prepararMaterial', () => {
  const r = prepararMaterial(apostila())

  it('marca o rodapé repetido como fora das questões', () => {
    const rodapes = r.trechos.filter((t) => t.tipo === 'rodape')
    expect(rodapes.length).toBe(4)
    expect(rodapes.every((t) => t.usar === false)).toBe(true)
  })

  it('reconhece títulos numerados, fórmula e lista', () => {
    const titulos = r.trechos.filter((t) => t.tipo === 'titulo').map((t) => t.texto)
    expect(titulos).toEqual(['1. Cinemática', '1.3 Velocidade média', '2. Queda livre', '3. Lançamento oblíquo'])
    expect(r.trechos.find((t) => t.tipo === 'formula').texto).toBe('vm = Δs / Δt')
    expect(r.trechos.find((t) => t.tipo === 'lista').texto).toBe('- O corpo parte do repouso\n- A aceleração é constante')
  })

  it('junta as linhas do parágrafo e desfaz a palavra quebrada com hífen', () => {
    const p = r.trechos.find((t) => t.texto.startsWith('A velocidade média'))
    expect(p.texto.includes('intervalo de tempo gasto no percurso.')).toBe(true)
  })

  it('acha definições e fórmulas como conceitos', () => {
    const termos = r.conceitos.map((c) => `${c.tipo}:${c.termo}`)
    expect(termos.includes('definicao:Referencial')).toBe(true)
    expect(termos.includes('definicao:queda livre')).toBe(true)
    expect(termos.includes('formula:vm = Δs / Δt')).toBe(true)
    expect(r.conceitos.find((c) => c.tipo === 'formula').definicao).toBe('Velocidade média')
  })

  it('conta páginas, estrutura e sugere assuntos pelos títulos', () => {
    expect(r.paginas.length).toBe(4)
    expect(r.analise.estrutura.titulos).toBe(4)
    expect(r.analise.estrutura.formulas).toBe(1)
    expect(r.analise.estrutura.numerosComUnidade >= 3).toBe(true)
    expect(r.analise.assuntosSugeridos.map((a) => a.nome)).toEqual(['Cinemática', 'Velocidade média', 'Queda livre', 'Lançamento oblíquo'])
  })

  it('respeita a marca de título que vem do arquivo', () => {
    const p = prepararMaterial([{ numero: 1, linhas: [{ texto: 'Introdução ao estudo', titulo: true }, { texto: 'Texto corrido da primeira parte.' }] }])
    expect(p.trechos[0].tipo).toBe('titulo')
  })
})

describe('peças da análise', () => {
  it('fórmula curta com símbolo, frase comum não', () => {
    expect(pareceFormula('F = m · a')).toBe(true)
    expect(pareceFormula('A força resultante é igual ao produto da massa pela aceleração do corpo.')).toBe(false)
  })

  it('definição pelo verbo e pelo "denomina-se"', () => {
    expect(acharDefinicao('Mitose é o processo de divisão celular que gera duas células iguais.')).toEqual({ termo: 'Mitose', definicao: 'é o processo de divisão celular que gera duas células iguais.' })
    expect(acharDefinicao('Isso é muito importante para entender o resto do capítulo.')).toBe(null)
  })

  it('divide parágrafo longo no fim de uma frase', () => {
    const frase = 'Esta é uma frase de tamanho médio para testar a divisão do texto. '
    const partes = dividirTextoLongo(frase.repeat(40).trim())
    expect(partes.length > 1).toBe(true)
    expect(partes.every((p) => p.endsWith('.'))).toBe(true)
  })

  it('sílabas e legibilidade', () => {
    expect(contarSilabas('velocidade')).toBe(5)
    expect(contarSilabas('pão')).toBe(1)
    const facil = 'O gato bebe leite. A casa é azul. Eu vou à escola. '.repeat(5)
    const dificil = 'A interdependência socioeconômica contemporânea caracteriza-se pela intensificação transnacional das relações produtivas, financeiras e informacionais, configurando arranjos institucionais heterogêneos. '.repeat(3)
    expect(legibilidade(facil) > legibilidade(dificil)).toBe(true)
    expect(legibilidade('curto demais')).toBe(null)
    expect(faixaLegibilidade(48)).toBe('difícil, ensino médio e graduação')
  })

  it('termos sem palavras vazias e com expressões de duas palavras', () => {
    const f = frequencias('A queda livre é um movimento. Na queda livre a aceleração é constante. A queda livre ocorre no vácuo. A aceleração da gravidade.')
    expect(f.find(([t]) => t === 'queda livre')[1]).toBe(3)
    expect(f.some(([t]) => t === 'a' || t === 'é')).toBe(false)
    expect(termosChave(f)[0][0]).toBe('queda livre')
  })
})
