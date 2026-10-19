// Primeiros passos: missões que levam a pessoa pelas funções na ordem em que fazem sentido,
// dizendo o que cada uma libera. Versão curta (outubro de 2026): ter um texto na Biblioteca ajuda, mas não é obrigatório.
import { ESTATISTICAS_VAZIAS, estaLiberado } from './desbloqueios.js'

const PASSOS = [
  { id: 'materia', texto: 'Criar a primeira matéria', libera: 'Libera a Biblioteca.', acao: { texto: 'Criar matéria', caminho: '/materias?nova=1' }, feito: (e) => e.materias >= 1 },
  { id: 'questoes', texto: 'Ter 10 questões no banco', libera: 'Libera o Estudar.', acao: { texto: 'Gerar questões', caminho: '/questoes/gerar' }, feito: (e) => e.questoesNoBanco >= 10 },
  { id: 'estudo', texto: 'Concluir o primeiro estudo', libera: 'Libera o Histórico.', acao: { texto: 'Estudar', caminho: '/revisar' }, feito: (e) => e.revisoesConcluidas >= 1 },
  { id: 'tres_estudos', texto: 'Concluir 2 estudos', libera: 'Libera o Ranking com o seu desempenho.', acao: { texto: 'Estudar', caminho: '/revisar' }, feito: (e) => e.revisoesConcluidas >= 2 },
  { id: 'proficiente', texto: 'Deixar um assunto proficiente', libera: 'Libera o nível Muito difícil.', feito: (e) => e.assuntosProficientes >= 1 },
  { id: 'prova', texto: 'Cumprir os requisitos da Prova', libera: 'Libera a Prova.', feito: (e) => estaLiberado('prova', e) },
]

export function avaliarPrimeirosPassos(estatisticas) {
  const e = { materiaisEnviados: 0, ...ESTATISTICAS_VAZIAS, ...estatisticas }
  const itens = PASSOS.map(({ feito, ...passo }) => ({ ...passo, feito: feito(e) }))
  const feitos = itens.filter((i) => i.feito).length
  return {
    itens,
    feitos,
    total: itens.length,
    proximo: itens.find((i) => !i.feito) ?? null,
    concluido: feitos === itens.length,
  }
}
