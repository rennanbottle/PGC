// Cenários de estudo usados nos testes e no script de simulação. Dados fictícios.
let contador = 0
const C = 'correta'
const E = 'incorreta'

export function resposta(dia, nivel, bloom, tipo, resultado, extra = {}) {
  return { dia, questaoId: extra.id ?? `q${contador++}`, tipo, nivel, bloom, resultado, dicas: extra.dicas ?? 0, alternativas: 5 }
}

const sessao = (dia, linhas) => linhas.map(([nivel, bloom, tipo, resultado, extra]) => resposta(dia, nivel, bloom, tipo, resultado, extra))

// 8 questões variadas, 7 certas: tipos diferentes, Bloom de 1 a 5, duas em muito difícil.
const sessaoCompleta = (dia) =>
  sessao(dia, [
    [2, 1, 'multipla_escolha', C],
    [2, 2, 'lacuna_digitada', C],
    [3, 3, 'numerica', C],
    [3, 4, 'encontrar_erro', C],
    [4, 4, 'assercao_razao', C],
    [3, 3, 'ordenar', C],
    [4, 5, 'texto_base', C],
    [2, 2, 'multipla_escolha', E],
  ])

// 8 questões só de múltipla escolha, 7 certas, sem acerto em muito difícil.
const sessaoSoEscolha = (dia) =>
  sessao(dia, [
    [2, 1, 'multipla_escolha', C], [2, 2, 'multipla_escolha', C], [3, 2, 'multipla_escolha', C], [3, 3, 'multipla_escolha', C],
    [2, 3, 'multipla_escolha', C], [4, 4, 'multipla_escolha', E], [3, 3, 'multipla_escolha', C], [2, 2, 'multipla_escolha', C],
  ])

export const CENARIOS = {
  maratona: { nome: '30 questões variadas num dia só, 27 certas', hoje: 0.5, respostas: sessao(0, Array.from({ length: 30 }, (_, i) => [(i % 4) + 1, (i % 5) + 1, ['multipla_escolha', 'numerica', 'ordenar', 'texto_base', 'encontrar_erro'][i % 5], i % 10 === 9 ? E : C])) },
  soEscolha: { nome: '4 sessões em 18 dias, só múltipla escolha, 7 de 8 certas', hoje: 19, respostas: [0, 5, 11, 18].flatMap(sessaoSoEscolha) },
  completo: { nome: '6 sessões em 24 dias, 7 tipos, 7 de 8 certas', hoje: 25, respostas: [0, 4, 9, 14, 19, 24].flatMap(sessaoCompleta) },
  completoEsquecido: { nome: 'Igual ao completo e depois 45 dias sem estudar', hoje: 69, respostas: [0, 4, 9, 14, 19, 24].flatMap(sessaoCompleta) },
  soFaceis: { nome: '40 questões fáceis de memorizar, todas certas, 4 dias', hoje: 10, respostas: [0, 3, 6, 9].flatMap((d) => sessao(d, Array.from({ length: 10 }, () => [1, 1, 'multipla_escolha', C]))) },
  comDicas: { nome: 'Igual ao completo, com dica em todos os acertos', hoje: 25, respostas: [0, 4, 9, 14, 19, 24].flatMap(sessaoCompleta).map((r) => (r.resultado === C ? { ...r, dicas: 1 } : r)) },
  chute: { nome: '21 de múltipla escolha no chute, 5 certas', hoje: 7, respostas: [0, 3, 6].flatMap((d) => sessao(d, Array.from({ length: 7 }, (_, i) => [2, 1, 'multipla_escolha', (i + d) % 4 === 0 ? C : E]))) },
  errosNoFim: { nome: 'Igual ao completo e depois 4 erros seguidos', hoje: 26, respostas: [...[0, 4, 9, 14, 19, 24].flatMap(sessaoCompleta), ...sessao(25, [[3, 3, 'numerica', E], [3, 4, 'encontrar_erro', E], [4, 4, 'assercao_razao', E], [3, 3, 'ordenar', E]])] },
}
