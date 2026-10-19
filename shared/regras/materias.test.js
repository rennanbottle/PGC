import { describe, expect, it } from 'vitest'
import { contarEstados, contarGrupos, faltaParaEstudar, filtrarMaterias, moverNaLista, passosDaMateria, proximaCor, separarAssuntos, situacaoDaMateria, textoEstados, validarNome } from './materias.js'
import { tempoRelativo } from './tempo.js'

const materias = [
  { id: 'm1', nome: 'Física', area: 'exatas', ordem: 2, atualizado_em: '2026-10-01T10:00:00Z', arquivada_em: null, assuntos: [{ id: 'a1', nome: 'Cinemática' }, { id: 'a2', nome: 'Óptica geométrica' }, { id: 'a3', nome: 'Antiga', arquivado_em: '2026-09-01' }] },
  { id: 'm2', nome: 'biologia', area: 'natureza', ordem: 1, atualizado_em: '2026-10-03T10:00:00Z', arquivada_em: null, assuntos: [{ id: 'a4', nome: 'Citologia' }] },
  { id: 'm3', nome: 'Química', area: 'exatas', ordem: 3, atualizado_em: '2026-09-01T10:00:00Z', arquivada_em: '2026-09-02', assuntos: [] },
]

describe('validarNome e separarAssuntos', () => {
  it('exige nome e respeita o máximo', () => {
    expect(validarNome('   ', 80)).toBe('Informe o nome.')
    expect(validarNome('a'.repeat(81), 80)).toBe('Use no máximo 80 caracteres.')
    expect(validarNome('Física', 80)).toBe('')
  })

  it('separa um por linha, tira marcadores, vazios e repetidos', () => {
    expect(separarAssuntos('- Cinemática\n\n2) Ondas\n1. cinemática\n  Óptica  ')).toEqual(['Cinemática', 'Ondas', 'Óptica'])
  })

  it('não confunde "1ª Guerra" com marcador de lista', () => {
    expect(separarAssuntos('1ª Guerra Mundial')).toEqual(['1ª Guerra Mundial'])
  })
})

describe('estados', () => {
  it('sem respostas, todo assunto ativo é não iniciado', () => {
    expect(contarEstados(materias[0].assuntos.filter((a) => !a.arquivado_em))).toEqual({ nao_iniciado: 2 })
  })

  it('escreve com plural certo', () => {
    expect(textoEstados({ proficiente: 2, nao_iniciado: 1 })).toBe('2 proficientes, 1 não iniciado')
    expect(textoEstados({ relembrar: 1, com_dificuldade: 3 })).toBe('1 precisa relembrar, 3 com dificuldade')
  })
})

describe('filtrarMaterias', () => {
  it('esconde arquivadas e segue a ordem manual', () => {
    expect(filtrarMaterias(materias).map((m) => m.id)).toEqual(['m2', 'm1'])
  })

  it('mostra só arquivadas quando pedido', () => {
    expect(filtrarMaterias(materias, { arquivadas: true }).map((m) => m.id)).toEqual(['m3'])
  })

  it('filtra por área e ordena por nome sem diferenciar maiúscula', () => {
    expect(filtrarMaterias(materias, { area: 'exatas' }).map((m) => m.id)).toEqual(['m1'])
    expect(filtrarMaterias(materias, { ordem: 'nome' }).map((m) => m.id)).toEqual(['m2', 'm1'])
  })

  it('filtra por estado do assunto', () => {
    const estados = { a1: { estado: 'proficiente' } }
    expect(filtrarMaterias(materias, { estado: 'proficiente' }, estados).map((m) => m.id)).toEqual(['m1'])
  })
})

describe('moverNaLista', () => {
  it('sobe, desce e não passa das pontas', () => {
    expect(moverNaLista(['a', 'b', 'c'], 'c', -1)).toEqual(['a', 'c', 'b'])
    expect(moverNaLista(['a', 'b', 'c'], 'a', 1)).toEqual(['b', 'a', 'c'])
    expect(moverNaLista(['a', 'b', 'c'], 'a', -1)).toEqual(['a', 'b', 'c'])
  })
})

describe('tempoRelativo', () => {
  const agora = new Date('2026-10-04T15:00:00-03:00')
  it('minutos, horas, ontem, dias e data', () => {
    expect(tempoRelativo('2026-10-04T14:59:30-03:00', agora)).toBe('agora há pouco')
    expect(tempoRelativo('2026-10-04T14:55:00-03:00', agora)).toBe('há 5 minutos')
    expect(tempoRelativo('2026-10-04T09:00:00-03:00', agora)).toBe('há 6 horas')
    expect(tempoRelativo('2026-10-03T23:00:00-03:00', agora)).toBe('ontem')
    expect(tempoRelativo('2026-10-01T12:00:00-03:00', agora)).toBe('há 3 dias')
    expect(tempoRelativo('2026-09-20T12:00:00-03:00', agora)).toBe('em 20 de setembro')
  })
})

describe('busca, ordem por revisar e cor da próxima matéria', () => {
  it('busca pelo nome da matéria ou de um assunto, sem acento', () => {
    expect(filtrarMaterias(materias, { busca: 'fis' }).map((m) => m.id)).toEqual(['m1'])
    expect(filtrarMaterias(materias, { busca: 'optica' }).map((m) => m.id)).toEqual(['m1'])
    expect(filtrarMaterias(materias, { busca: 'antiga' }).map((m) => m.id)).toEqual([])
  })

  it('ordena por questões para revisar e desempata pela ordem manual', () => {
    expect(filtrarMaterias(materias, { ordem: 'revisar' }, {}, { m1: { vencidas: 4 } }).map((m) => m.id)).toEqual(['m1', 'm2'])
    expect(filtrarMaterias(materias, { ordem: 'revisar' }, {}, {}).map((m) => m.id)).toEqual(['m2', 'm1'])
  })

  it('escolhe uma cor que ainda não está em uso', () => {
    expect(proximaCor([])).toBe('azul')
    expect(proximaCor([{ cor: 'azul' }, { cor: 'verde' }])).toBe('laranja')
    expect(proximaCor([{ cor: 'azul' }, { cor: 'verde', arquivada_em: '2026-01-01' }])).toBe('verde')
  })
})

describe('grupos, caminho e situação da matéria', () => {
  it('junta os estados em quatro grupos', () => {
    const assuntos = [{ id: 'a' }, { id: 'b' }, { id: 'c' }, { id: 'd' }]
    const estados = { a: { estado: 'dominado' }, b: { estado: 'iniciando' }, c: { estado: 'relembrar' } }
    expect(contarGrupos(assuntos, estados)).toEqual({ bem: 1, estudando: 1, atencao: 1, nao_iniciado: 1 })
  })

  it('o caminho aponta o próximo passo; texto é opcional', () => {
    const estados = (n) => passosDaMateria(n).map((p) => p.estado)
    expect(estados({})).toEqual(['agora', 'opcional', 'depois', 'depois'])
    expect(estados({ assuntos: 5 })).toEqual(['feito', 'opcional', 'agora', 'depois'])
    expect(estados({ assuntos: 5, textos: 1, noBanco: 12 })).toEqual(['feito', 'feito', 'feito', 'agora'])
  })

  it('diz quantas questões faltam para estudar', () => {
    expect(faltaParaEstudar(3)).toBe('Faltam 7 questões no banco desta matéria.')
    expect(faltaParaEstudar(9)).toBe('Falta 1 questão no banco desta matéria.')
    expect(faltaParaEstudar(10)).toBe('')
  })

  it('situação: sem assuntos, sem questões, para revisar ou em dia', () => {
    expect(situacaoDaMateria({}).id).toBe('sem_assuntos')
    expect(situacaoDaMateria({ assuntos: 2 }).id).toBe('sem_questoes')
    expect(situacaoDaMateria({ assuntos: 2, questoes: 8, vencidas: 3 }).texto).toBe('3 para revisar')
    expect(situacaoDaMateria({ assuntos: 2, questoes: 8 }).id).toBe('em_dia')
  })
})
