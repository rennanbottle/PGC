import { describe, expect, it } from 'vitest'
import { decidirRota } from './rotas.js'

describe('decidirRota', () => {
  it('raiz mostra a apresentação sem sessão e leva ao início com sessão', () => {
    expect(decidirRota({ caminho: '/', logado: true })).toBe('/inicio')
    expect(decidirRota({ caminho: '/', logado: false })).toBeNull()
  })

  it('quem está logado vê a apresentação quando pede', () => {
    expect(decidirRota({ caminho: '/', logado: true, verApresentacao: true })).toBeNull()
    expect(decidirRota({ caminho: '/', logado: false, verApresentacao: true })).toBeNull()
  })

  it('telas de entrada são só para quem não está logado', () => {
    for (const caminho of ['/entrar', '/criar-conta', '/recuperar-senha']) {
      expect(decidirRota({ caminho, logado: false })).toBeNull()
      expect(decidirRota({ caminho, logado: true })).toBe('/inicio')
    }
  })

  it('privacidade abre para todos', () => {
    expect(decidirRota({ caminho: '/privacidade', logado: false })).toBeNull()
    expect(decidirRota({ caminho: '/privacidade', logado: true })).toBeNull()
  })

  it('tela interna sem sessão vai para entrar e guarda a volta', () => {
    expect(decidirRota({ caminho: '/inicio', logado: false })).toBe('/entrar')
    expect(decidirRota({ caminho: '/materias', caminhoCompleto: '/materias?aba=2', logado: false }))
      .toBe('/entrar?volta=%2Fmaterias%3Faba%3D2')
    expect(decidirRota({ caminho: '/materias', logado: true })).toBeNull()
  })

  it('senha nova sem a sessão do link manda pedir outro link', () => {
    expect(decidirRota({ caminho: '/redefinir-senha', logado: false })).toBe('/recuperar-senha?link=expirado')
    expect(decidirRota({ caminho: '/redefinir-senha', logado: true })).toBeNull()
  })

  it('endereço antigo do Desempenho vai para o Ranking', () => {
    expect(decidirRota({ caminho: '/desempenho', logado: true })).toBe('/ranking')
    expect(decidirRota({ caminho: '/desempenho/', logado: true })).toBe('/ranking')
    expect(decidirRota({ caminho: '/desempenho', logado: false })).toBe('/entrar?volta=%2Franking')
  })
})
