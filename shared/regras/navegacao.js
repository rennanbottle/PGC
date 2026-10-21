// Seções do app: o que aparece no menu lateral (computador) e na barra de baixo (celular).
// "trava" liga a seção a uma regra de desbloqueio (desbloqueios.js); "pronta: false" mostra a tela "chega em breve".
// "grupo" separa o menu em três partes: o seu dia, o que você estuda e a prática.
// Telas que não ficam no menu (Histórico) estão em OUTRAS_SECOES: abrem pelo menu da conta e por links.
import { avaliarDesbloqueios } from './desbloqueios.js'

export const SECOES = [
  { id: 'inicio', nome: 'Início', caminho: '/inicio', icone: 'inicio', grupo: 'dia', pronta: true },
  { id: 'agenda', nome: 'Agenda', caminho: '/agenda', icone: 'agenda', grupo: 'dia', pronta: true, resumo: 'Provas, tarefas e as revisões de cada dia, num calendário só seu.' },
  { id: 'materias', nome: 'Matérias', caminho: '/materias', icone: 'materias', grupo: 'conteudo', pronta: true, resumo: 'O que você estuda, dividido em assuntos. Cada matéria junta os seus textos e questões.' },
  { id: 'materiais', nome: 'Biblioteca', caminho: '/materiais', icone: 'materiais', grupo: 'conteudo', trava: 'materiais', pronta: true, resumo: 'Os textos, apostilas e PDFs de onde saem as suas questões.' },
  { id: 'questoes', nome: 'Questões', caminho: '/questoes', icone: 'questoes', grupo: 'conteudo', pronta: true, resumo: 'Seu banco de questões: geradas pela IA, tiradas dos seus textos ou importadas de provas.' },
  { id: 'revisar', nome: 'Estudar', caminho: '/revisar', icone: 'revisar', grupo: 'pratica', trava: 'revisao', pronta: true, resumo: 'Estudos em blocos de revisão e prática, com as questões do seu banco, em modo foco.' },
  { id: 'prova', nome: 'Prova', caminho: '/prova', icone: 'prova', grupo: 'pratica', trava: 'prova', pronta: true, resumo: 'Simulados com cronômetro, montados do seu jeito, para treinar antes da prova de verdade.' },
  { id: 'ranking', nome: 'Ranking', caminho: '/ranking', icone: 'ranking', grupo: 'pratica', trava: 'desempenho', pronta: true, resumo: 'Seu desempenho ao longo do tempo e, se quiser, a comparação com outras pessoas pelo apelido.' },
]

export const OUTRAS_SECOES = [
  { id: 'historico', nome: 'Histórico', caminho: '/historico', icone: 'historico', trava: 'historico', pronta: true, resumo: 'Tudo o que você fez no PGC, do mais novo ao mais antigo.' },
]

// Barra de baixo do celular: estas quatro e o botão Mais (o resto fica na folha do Mais).
export const BARRA_CELULAR = ['inicio', 'materias', 'revisar', 'agenda']

// Caminhos antigos que agora moram em outra tela.
export const REDIRECIONAMENTOS = { '/desempenho': '/ranking' }

function comEstado(lista, travas) {
  return lista.map((s) => {
    const bloqueio = s.trava ? travas[s.trava] : null
    return { ...s, bloqueio, bloqueada: !!bloqueio && !bloqueio.liberado }
  })
}

export function secoesComEstado(estatisticas) {
  const travas = Object.fromEntries(avaliarDesbloqueios(estatisticas).map((d) => [d.id, d]))
  return comEstado(SECOES, travas)
}

export function todasAsSecoesComEstado(estatisticas) {
  const travas = Object.fromEntries(avaliarDesbloqueios(estatisticas).map((d) => [d.id, d]))
  return comEstado([...SECOES, ...OUTRAS_SECOES], travas)
}

export function secaoAtual(caminho) {
  return [...SECOES, ...OUTRAS_SECOES].find((s) => caminho === s.caminho || caminho.startsWith(`${s.caminho}/`)) ?? null
}
