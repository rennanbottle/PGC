// Proficiência por assunto no modelo de Elo com acerto ao acaso (família da TRI usada no ENEM).
// Referências: Pelánek (2016), "Applications of the Elo rating system in adaptive educational systems";
// modelo logístico de 3 parâmetros da Teoria de Resposta ao Item (Birnbaum, 1968).
// Função pura. θ (theta) = habilidade da pessoa no assunto; b = dificuldade da questão.

export const B_INICIAL = { 1: -1.5, 2: -0.5, 3: 0.5, 4: 1.3, 5: 2.0 } // fácil, normal, difícil, muito difícil, desafio extremo

const sigmoide = (x) => 1 / (1 + Math.exp(-x))

// Chance de acertar no chute: múltipla escolha com k alternativas = 1/k; resposta digitada ~ 0.
export function chanceChute(tipo, alternativas = 5) {
  if (['multipla_escolha', 'lacuna_opcoes', 'interpretar', 'texto_base', 'prever_resultado'].includes(tipo)) return 1 / alternativas
  if (tipo === 'verdadeiro_falso' || tipo === 'certo_errado') return 1 / 2
  if (tipo === 'vf_justificado') return 1 / 6 // 2 (V/F) x 3 justificativas
  if (tipo === 'assercao_razao') return 1 / 5
  return 0.02
}

export function probabilidade(theta, b, c = 0) {
  return c + (1 - c) * sigmoide(theta - b)
}

// Escala exibida: 0 a 1000, média 500 (parecida com a do ENEM, mas NÃO é nota do ENEM).
export const escala = (theta) => Math.round(Math.max(0, Math.min(1000, 500 + 100 * theta)))

// Crédito efetivo da resposta: dicas reduzem, parcial vale metade.
export function credito(resultado, dicas = 0) {
  const base = resultado === 'correta' ? 1 : resultado === 'parcial' ? 0.5 : 0
  return base * Math.max(0.25, 1 - 0.25 * dicas)
}

// Atualiza habilidade e dificuldade. Quanto mais evidência, menor o passo (a estimativa estabiliza).
export function atualizar({ theta, n }, questao, resposta) {
  const c = chanceChute(questao.tipo, questao.alternativas)
  const p = probabilidade(theta, questao.b, c)
  const s = credito(resposta.resultado, resposta.dicas)
  const peso = resposta.emProva ? 1.25 : 1
  const kTheta = (0.8 / (1 + 0.05 * n)) * peso
  const kB = 0.4 / (1 + 0.05 * (questao.m ?? 0))
  return {
    aluno: { theta: theta + kTheta * (s - p), n: n + 1 },
    questao: { ...questao, b: questao.b - kB * (s - p), m: (questao.m ?? 0) + 1 },
    previsto: p,
    surpresa: s - p,
  }
}
