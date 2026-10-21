// Telas e recursos que abrem conforme a pessoa usa o PGC (como as 40 palavras que abriam a Revisão no VI).
// O objetivo é fazer a pessoa passar pelas funções na ordem em que elas fazem sentido, sem prender demais. Em outubro
// de 2026 as metas baixaram (Prova: 2 estudos de 10 questões, 40 respostas e 4 tipos; Desempenho: 2 estudos), porque
// metas longas faziam a pessoa perder o interesse antes de conhecer o resto do sistema. O Ranking geral continua com
// 3 estudos de 5 questões, porque a mesma regra está no banco (ranking_periodo).
// O servidor confere a mesma regra antes de liberar a rota; esconder o botão não basta.

const req = (texto, atual, meta) => ({ texto, atual, meta, ok: atual >= meta })

export const DESBLOQUEIOS = [
  {
    id: 'materiais',
    nome: 'Biblioteca',
    requisitos: (e) => [req('Matérias criadas', e.materias, 1)],
  },
  {
    // Basta ter questões: elas podem sair de um texto seu, de fontes abertas ou só do assunto.
    id: 'revisao',
    nome: 'Estudar',
    requisitos: (e) => [req('Questões no seu banco', e.questoesNoBanco, 10)],
  },
  {
    id: 'historico',
    nome: 'Histórico',
    requisitos: (e) => [req('Estudos concluídos', e.revisoesConcluidas, 1)],
  },
  {
    id: 'desempenho',
    nome: 'Seu desempenho',
    requisitos: (e) => [req('Estudos concluídos', e.revisoesConcluidas, 2)],
  },
  {
    id: 'ranking',
    nome: 'Ranking geral',
    requisitos: (e) => [req('Estudos concluídos com 5 questões ou mais', e.revisoesCom5, 3)],
  },
  {
    id: 'nivel_muito_dificil',
    nome: 'Nível muito difícil',
    requisitos: (e) => [req('Assuntos proficientes', e.assuntosProficientes, 1)],
  },
  {
    id: 'nivel_impossivel',
    nome: 'Nível desafio extremo',
    requisitos: (e) => [req('Assuntos dominados', e.assuntosDominados, 1)],
  },
  {
    id: 'prova',
    nome: 'Prova',
    requisitos: (e) => [
      req('Estudos concluídos com 10 questões ou mais', e.revisoesCom10, 2),
      req('Questões respondidas', e.questoesRespondidas, 40),
      req('Tipos de questão diferentes já respondidos', e.tiposUsados, 4),
    ],
  },
  {
    id: 'nivel_disfarcado',
    nome: 'Nível disfarçado nas questões',
    requisitos: (e) => [req('Nível da conta', e.nivel, 4)],
  },
  {
    id: 'paletas_extras',
    nome: 'Paletas extras',
    requisitos: (e) => [req('Nível da conta', e.nivel, 2)],
  },
]

export const ESTATISTICAS_VAZIAS = {
  materias: 0, materiaisAprovados: 0, bancosImportados: 0, questoesNoBanco: 0, revisoesConcluidas: 0, revisoesCom5: 0,
  revisoesCom10: 0, questoesRespondidas: 0, materiasComMaterial: 0, tiposUsados: 0, assuntosProficientes: 0, assuntosDominados: 0, nivel: 1,
}

export function avaliarDesbloqueios(estatisticas) {
  const e = { ...ESTATISTICAS_VAZIAS, ...estatisticas }
  return DESBLOQUEIOS.map((d) => {
    const requisitos = d.requisitos(e)
    const progresso = requisitos.reduce((s, r) => s + Math.min(1, r.atual / r.meta), 0) / requisitos.length
    return { id: d.id, nome: d.nome, liberado: requisitos.every((r) => r.ok), progresso: Math.round(progresso * 100), requisitos }
  })
}

export function estaLiberado(id, estatisticas) {
  const d = avaliarDesbloqueios(estatisticas).find((x) => x.id === id)
  return d ? d.liberado : true
}
