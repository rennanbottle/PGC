import { describe, it, expect } from 'vitest'
import { avaliarAssunto } from './dominio.js'
import { CENARIOS } from './cenarios.js'

const avaliar = (c, opcoes) => avaliarAssunto(CENARIOS[c].respostas, CENARIOS[c].hoje, opcoes)
const falhou = (res, id) => res.checklist.find((x) => x.id === id)?.ok === false
const provaAprovada = [{ questoes: 10, certas: 9, nivelMinimo: 3, usouDica: false }]

describe('domínio de assunto (ritmo normal)', () => {
  it('sem respostas é "não iniciado"', () => {
    expect(avaliarAssunto([], 0).estado).toBe('nao_iniciado')
  })

  it('maratona num dia só nunca vira domínio', () => {
    const r = avaliar('maratona')
    expect(r.estado).not.toBe('dominado')
    expect(r.estado).not.toBe('pronto_para_prova')
    expect(falhou(r, 'dias')).toBe(true)
    expect(falhou(r, 'periodo')).toBe(true)
  })

  it('estudo espaçado só com múltipla escolha fica em proficiente', () => {
    const r = avaliar('soEscolha')
    expect(r.estado).toBe('proficiente')
    expect(falhou(r, 'tipos')).toBe(true)
    expect(falhou(r, 'muito_dificeis')).toBe(true)
  })

  it('estudo completo pede a prova de domínio', () => {
    const r = avaliar('completo')
    expect(r.estado).toBe('pronto_para_prova')
    expect(r.faltam).toBe(1)
  })

  it('estudo completo com prova aprovada vira dominado', () => {
    expect(avaliar('completo', { provasDominio: provaAprovada }).estado).toBe('dominado')
  })

  it('prova com dica não vale', () => {
    const r = avaliar('completo', { provasDominio: [{ ...provaAprovada[0], usouDica: true }] })
    expect(r.estado).toBe('pronto_para_prova')
  })

  it('45 dias sem estudar volta para "precisa relembrar"', () => {
    const r = avaliar('completoEsquecido', { provasDominio: provaAprovada })
    expect(r.estado).toBe('relembrar')
  })

  it('só questões fáceis trava a proficiência em 450', () => {
    const r = avaliar('soFaceis')
    expect(r.proficiencia).toBeLessThanOrEqual(450)
    expect(r.estado).not.toBe('proficiente')
  })

  it('acertos com dica não contam como acerto limpo', () => {
    const r = avaliar('comDicas', { provasDominio: provaAprovada })
    expect(r.estado).not.toBe('dominado')
    expect(falhou(r, 'bloom')).toBe(true)
    expect(r.proficiencia).toBeLessThanOrEqual(450)
  })

  it('chute em múltipla escolha fica com dificuldade', () => {
    expect(avaliar('chute').estado).toBe('com_dificuldade')
  })

  it('erros seguidos no fim tiram o domínio', () => {
    const r = avaliar('errosNoFim', { provasDominio: provaAprovada })
    expect(r.estado).not.toBe('dominado')
    expect(falhou(r, 'estabilidade')).toBe(true)
  })
})

describe('ritmos', () => {
  it('o mesmo estudo completo não basta no ritmo obcecado', () => {
    const r = avaliar('completo', { ritmo: 'obcecado', provasDominio: [{ questoes: 15, certas: 14, nivelMinimo: 4, usouDica: false }] })
    expect(r.estado).not.toBe('dominado')
  })

  it('no ritmo tranquilo não existe prova de domínio', () => {
    const r = avaliar('completo', { ritmo: 'tranquilo' })
    expect(r.estado).toBe('dominado')
    expect(r.checklist.some((c) => c.id === 'prova')).toBe(false)
  })
})
