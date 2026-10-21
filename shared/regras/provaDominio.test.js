import { describe, expect, it } from 'vitest'
import { minutosDaProvaDominio, provaDoRegistro, questoesElegiveis, regraDaProvaDominio, resultadoDaProvaDominio, situacaoDaProvaDominio } from './provaDominio.js'
import { provaDominioAprovada } from './dominio.js'
import { formatoDe, lerConfigProva } from './provas.js'

const pronto = { ritmo: 'normal', estado: 'pronto_para_prova', elegiveis: 14, hoje: 100 }

describe('prova de domínio', () => {
  it('regra do ritmo: Tranquilo não pede prova', () => {
    expect(regraDaProvaDominio('tranquilo')).toBeNull()
    expect(regraDaProvaDominio('normal')).toEqual({ questoes: 10, minimoCertas: 8, nivelMinimo: 3 })
    expect(regraDaProvaDominio('inexistente')).toEqual(regraDaProvaDominio('normal'))
    expect(minutosDaProvaDominio(regraDaProvaDominio('normal'))).toBe(30)
  })
  it('só entram questões que o PGC corrige, no nível mínimo', () => {
    const qs = [{ tipo: 'multipla_escolha', nivel: 3 }, { tipo: 'multipla_escolha', nivel: 2 }, { tipo: 'explicar', nivel: 4 }, { tipo: 'numerica', nivel: 5 }]
    expect(questoesElegiveis(qs, regraDaProvaDominio('normal'))).toHaveLength(2)
    expect(questoesElegiveis(qs, regraDaProvaDominio('obcecado'))).toHaveLength(1)
  })
  it('libera quando o assunto está pronto e há questões', () => {
    expect(situacaoDaProvaDominio(pronto)).toMatchObject({ pode: true })
    expect(situacaoDaProvaDominio({ ...pronto, estado: 'proficiente' }).motivo).toBe('criterios')
    expect(situacaoDaProvaDominio({ ...pronto, estado: 'dominado' }).motivo).toBe('dominado')
    expect(situacaoDaProvaDominio({ ...pronto, ritmo: 'tranquilo' }).motivo).toBe('sem_prova')
    expect(situacaoDaProvaDominio({ ...pronto, elegiveis: 7 })).toMatchObject({ pode: false, motivo: 'questoes', faltam: 3 })
    expect(situacaoDaProvaDominio({ ...pronto, emAndamento: 'p1' })).toMatchObject({ pode: false, motivo: 'andamento', prova: 'p1' })
  })
  it('reprovado tenta de novo a partir do dia seguinte', () => {
    expect(situacaoDaProvaDominio({ ...pronto, ultima: { dia: 100, aprovada: false } }).motivo).toBe('amanha')
    expect(situacaoDaProvaDominio({ ...pronto, ultima: { dia: 99, aprovada: false } }).pode).toBe(true)
  })
  it('passa com o mínimo de certas, sem dica', () => {
    const regra = regraDaProvaDominio('normal')
    const itens = (certas, total = 10) => Array.from({ length: total }, (_, i) => ({ resultado: i < certas ? 'correta' : 'incorreta', dicas_usadas: 0 }))
    expect(resultadoDaProvaDominio(itens(8), regra)).toMatchObject({ certas: 8, total: 10, aprovada: true, faltaram: 0 })
    expect(resultadoDaProvaDominio(itens(7), regra)).toMatchObject({ aprovada: false, faltaram: 1 })
    expect(resultadoDaProvaDominio(itens(8, 9), regra).aprovada).toBe(false)
  })
  it('a prova guardada conta para o domínio', () => {
    const regra = regraDaProvaDominio('normal')
    const aprovada = provaDoRegistro({ total: 10, certas: 9, prova: { formato: 'dominio', assuntoId: 'a1', regra } })
    expect(aprovada.assuntoId).toBe('a1')
    expect(provaDominioAprovada([aprovada], regra)).toBe(true)
    expect(provaDominioAprovada([{ ...aprovada, certas: 6 }], regra)).toBe(false)
  })
  it('o formato domínio existe, mas não pode ser escolhido na tela de montar', () => {
    expect(formatoDe('dominio').nome).toBe('Prova de domínio')
    expect(lerConfigProva({ formato: 'dominio', assuntos: [{ id: '00000000-0000-4000-8000-000000000001' }] }).config.formato).toBe('enem')
  })
})
