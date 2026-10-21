import { describe, expect, it } from 'vitest'
import { agruparPorMateria, conferirArquivo, formatarTamanho, mensagemErroMaterial, origemDoTexto, tipoDeEntrada, tituloDoArquivo, validarTitulo } from './materiais.js'
import { serieDiaria } from './tempo.js'

describe('conferirArquivo', () => {
  it('aceita PDF, DOCX e TXT até 10 MB', () => {
    expect(conferirArquivo({ name: 'Apostila.PDF', size: 2000 })).toEqual({ formato: 'pdf' })
    expect(conferirArquivo({ name: 'lista.docx', size: 2000 })).toEqual({ formato: 'docx' })
    expect(conferirArquivo({ name: 'notas.txt', size: 10 })).toEqual({ formato: 'txt' })
  })
  it('recusa outro formato, vazio e grande demais', () => {
    expect(conferirArquivo({ name: 'foto.jpg', size: 10 }).erro).toBe('foto.jpg: só PDF, DOCX ou TXT.')
    expect(conferirArquivo({ name: 'a.pdf', size: 0 }).erro).toBe('a.pdf: o arquivo está vazio.')
    expect(conferirArquivo({ name: 'a.pdf', size: 11 * 1024 * 1024 }).erro).toBe('a.pdf: passa de 10 MB.')
  })
})

describe('textos de materiais', () => {
  it('título a partir do nome do arquivo', () => {
    expect(tituloDoArquivo('apostila_cinematica-v2.pdf')).toBe('apostila cinematica v2')
    expect(tituloDoArquivo('.pdf')).toBe('Material sem título')
  })
  it('tamanho legível', () => {
    expect(formatarTamanho(2.3 * 1024 * 1024)).toBe('2,3 MB')
    expect(formatarTamanho(1500)).toBe('1 KB')
  })
  it('erro desconhecido vira mensagem genérica', () => {
    expect(mensagemErroMaterial('xyz').curto).toBe('Erro')
    expect(mensagemErroMaterial('pdf_escaneado').curto).toBe('Escaneado')
  })
})

describe('serieDiaria', () => {
  it('conta por dia e soma a semana anterior', () => {
    const agora = new Date('2026-10-04T15:00:00-03:00')
    const r = serieDiaria(['2026-10-04T10:00:00-03:00', '2026-10-04T11:00:00-03:00', '2026-10-01T10:00:00-03:00', '2026-09-26T10:00:00-03:00', '2026-09-01T10:00:00-03:00'], 7, agora)
    expect(r.serie).toEqual([0, 0, 0, 1, 0, 0, 2])
    expect(r.total).toBe(3)
    expect(r.anterior).toBe(1)
  })
})

describe('caixa única de adicionar', () => {
  it('tema curto busca; texto longo ou com linhas vira texto', () => {
    expect(tipoDeEntrada('   ')).toBe('vazio')
    expect(tipoDeEntrada('Revolução Francesa')).toBe('tema')
    expect(tipoDeEntrada('a'.repeat(100))).toBe('tema')
    expect(tipoDeEntrada('a'.repeat(130))).toBe('texto')
    expect(tipoDeEntrada(`${'Linha um do resumo da aula. '.repeat(3)}\nLinha dois.`)).toBe('texto')
  })

  it('título do texto colado é obrigatório', () => {
    expect(validarTitulo('  ')).toContain('Dê um nome')
    expect(validarTitulo('Resumo')).toBe('')
    expect(validarTitulo('x'.repeat(161))).toBe('Use no máximo 160 caracteres.')
  })
})

describe('lista da Biblioteca', () => {
  it('reconhece a origem do texto', () => {
    expect(origemDoTexto({ fonte_url: 'https://pt.wikibooks.org/wiki/Python', origem: 'arquivo' })).toBe('wikilivros')
    expect(origemDoTexto({ origem: 'texto_colado' })).toBe('colado')
    expect(origemDoTexto({ origem: 'arquivo' })).toBe('arquivo')
  })

  it('agrupa por matéria na ordem das matérias e põe o mais recente primeiro', () => {
    const materias = [{ id: 'b', ordem: 2 }, { id: 'a', ordem: 1 }, { id: 'c', ordem: 3 }]
    const textos = [
      { id: 1, materia_id: 'b', atualizado_em: '2026-10-01' },
      { id: 2, materia_id: 'a', atualizado_em: '2026-10-01' },
      { id: 3, materia_id: 'b', atualizado_em: '2026-10-05' },
    ]
    const g = agruparPorMateria(textos, materias)
    expect(g.map((x) => x.materia.id)).toEqual(['a', 'b'])
    expect(g[1].textos.map((t) => t.id)).toEqual([3, 1])
  })
})
