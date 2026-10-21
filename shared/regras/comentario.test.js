import { describe, expect, it } from 'vitest'
import { montarPedidoComentario, validarComentario } from './comentario.js'

describe('comentário do fim', () => {
  it('o pedido leva os números do PGC, os blocos e o erro de cada alternativa', () => {
    const [sis, usu] = montarPedidoComentario({
      titulo: 'Física de terça, Física', acerto: 73, mediaAnterior: 68,
      blocos: [{ nome: 'Aquecer', tipo: 'revisao', certas: 6, parciais: 0, erradas: 2, total: 8 }],
      erros: [{ assunto: 'Vetores', enunciado: 'Dois vetores de 3 N e 4 N formam 90°...', sua: '7 N', certa: '5 N', erro: 'Somou os módulos.', trecho: { texto: 'A resultante...', pagina: 18, material: 'Apostila' } }],
    })
    expect(sis.content).toContain('{"comentario": "..."}')
    expect(sis.content).toContain('não invente')
    expect(usu.content).toContain('Aproveitamento: 73%; a média das anteriores era 68%')
    expect(usu.content).toContain('Revisão, Aquecer: 6 certas')
    expect(usu.content).toContain('Somou os módulos.')
    expect(usu.content).toContain('página 18')
  })
  it('limpa título, travessão e marcação; recusa curto e quem fala de si', () => {
    const r = validarComentario({ comentario: 'Conselho: Você acertou as **4** que voltaram — e o que ainda escapa é a decomposição do vetor na componente horizontal; vale reler a página 18.' })
    expect(r.ok).toBe(true)
    expect(r.valor.startsWith('Você acertou as 4 que voltaram, e')).toBe(true)
    expect(validarComentario({ comentario: 'Bom trabalho.' }).ok).toBe(false)
    expect(validarComentario({ comentario: 'Como IA, eu acho que você foi muito bem nesta sessão inteira e deveria continuar estudando bastante todos os dias.' }).ok).toBe(false)
    expect(validarComentario({}).ok).toBe(false)
  })
})
