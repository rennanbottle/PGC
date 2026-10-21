import { describe, expect, it } from 'vitest'
import { EXPRESSOES, GUIA_PADRAO, acharQuadros, guiaDoPerfil, indiceDaExpressao, nomeParaGuardar, ordemDosMosaicos, posicaoNoSprite, temTransparencia, tirarFundo, unificarLado } from './guias.js'

// Mosaico falso 3 × 2: um bloco opaco no meio de cada célula (a da direita de cima é mais alta).
function mosaico(largura = 300, altura = 200) {
  const alfa = new Uint8Array(largura * altura)
  const celula = largura / 3
  for (let l = 0; l < 2; l++) {
    for (let c = 0; c < 3; c++) {
      const x0 = Math.round(c * celula + 20)
      const y0 = l * 100 + (l === 0 && c === 2 ? 8 : 25)
      for (let y = y0; y < l * 100 + 92; y++) for (let x = x0; x < x0 + 60; x++) alfa[y * largura + x] = 255
    }
  }
  return alfa
}

describe('guias', () => {
  it('as 12 expressões e os nomes antigos do mascote', () => {
    expect(EXPRESSOES).toHaveLength(12)
    expect(indiceDaExpressao('neutro')).toBe(0)
    expect(indiceDaExpressao('comemorativo')).toBe(11)
    expect(indiceDaExpressao('pensando')).toBe(indiceDaExpressao('pensativo'))
    expect(indiceDaExpressao('acenando')).toBe(indiceDaExpressao('feliz'))
    expect(indiceDaExpressao('qualquer')).toBe(0)
    expect(posicaoNoSprite('neutro')).toBe('0% 0%')
    expect(posicaoNoSprite('comemorativo')).toBe('100% 100%')
  })

  it('guia do perfil: pronto, próprio ou o padrão', () => {
    expect(guiaDoPerfil(null).id).toBe(GUIA_PADRAO)
    expect(guiaDoPerfil({ guia: 'gato' }).arquivo).toBe('/guias/gato.webp')
    expect(guiaDoPerfil(null).nome).toBe('Bartolomeu')
    expect(guiaDoPerfil({ guia: 'tom', guia_nome: 'Totó' }).nome).toBe('Totó')
    expect(guiaDoPerfil({ guia: 'proprio', guia_nome: ' Mingau ' })).toEqual({ tipo: 'proprio', id: 'proprio', nome: 'Mingau', arquivo: null, nomeDado: 'Mingau' })
    expect(nomeParaGuardar('gato', ' Bartolomeu ')).toBe(null)
    expect(nomeParaGuardar('gato', 'Barto')).toBe('Barto')
    expect(nomeParaGuardar('proprio', '')).toBe(null)
    expect(guiaDoPerfil({ guia: 'nao-existe' }).id).toBe(GUIA_PADRAO)
  })

  it('acha os 6 quadros na ordem de leitura, com recorte do mesmo tamanho apoiado embaixo', () => {
    const r = acharQuadros(mosaico(), 300, 200)
    expect(r.erro === undefined).toBe(true)
    expect(r.quadros).toHaveLength(6)
    expect(r.quadros.map((q) => q.caixa.x0)).toEqual([20, 120, 220, 20, 120, 220])
    expect(r.quadros[3].caixa.y0).toBe(125)
    expect(r.lado).toBe(Math.ceil(84 * 1.04))
    for (const q of r.quadros) expect(q.recorte.lado).toBe(r.lado)
    // Apoiado embaixo: o fim do recorte fica perto do fim do personagem.
    const q = r.quadros[0]
    expect(Math.abs(q.recorte.y + q.recorte.lado - q.caixa.y1) <= 3).toBe(true)
  })

  it('usa o mesmo tamanho nos dois mosaicos e ordena pelo último número do nome', () => {
    const a = acharQuadros(mosaico(), 300, 200)
    const b = { ...a, lado: a.lado + 10 }
    const [ua, ub] = unificarLado([a, b])
    expect(ua.lado).toBe(a.lado + 10)
    for (const q of [...ua.quadros, ...ub.quadros]) expect(q.recorte.lado).toBe(a.lado + 10)
    expect(ordemDosMosaicos(['Imagem 22_43_30-2.png', 'Imagem 22_43_29-1.png'])).toEqual([1, 0])
    expect(ordemDosMosaicos(['bloco_07-12_mosaico.png', 'bloco_01-06_mosaico.png'])).toEqual([1, 0])
    expect(ordemDosMosaicos(['gato.png', 'cachorro.png'])).toEqual([0, 1])
  })

  it('recusa formato errado e quadro vazio', () => {
    expect(acharQuadros(new Uint8Array(200 * 200), 200, 200).erro).toBe('proporcao')
    const alfa = mosaico()
    for (let y = 100; y < 200; y++) for (let x = 200; x < 300; x++) alfa[y * 300 + x] = 0
    expect(acharQuadros(alfa, 300, 200)).toEqual({ erro: 'vazio', quadro: 6 })
  })

  it('tira o fundo de uma cor só sem furar o personagem', () => {
    const largura = 10
    const altura = 6
    const rgba = new Uint8ClampedArray(largura * altura * 4)
    for (let p = 0; p < largura * altura; p++) rgba.set([250, 250, 250, 255], p * 4)
    // Personagem escuro no meio, com um "olho" branco dentro (não encosta na borda).
    for (let y = 1; y < 5; y++) for (let x = 3; x < 7; x++) rgba.set([40, 40, 40, 255], (y * largura + x) * 4)
    rgba.set([250, 250, 250, 255], (2 * largura + 4) * 4)
    expect(temTransparencia(rgba)).toBe(false)
    expect(tirarFundo(rgba, largura, altura)).toBe(true)
    expect(rgba[3]).toBe(0)
    expect(rgba[(2 * largura + 4) * 4 + 3]).toBe(255)
    expect(rgba[(1 * largura + 3) * 4 + 3]).toBe(255)
    expect(temTransparencia(rgba)).toBe(true)
  })
})
