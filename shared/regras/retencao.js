// Retenção com o modelo FSRS (Free Spaced Repetition Scheduler, versão 5, parâmetros padrão).
// No app usaremos a biblioteca ts-fsrs; esta versão mínima existe para simular e testar a regra.
// Nota (grade): 1 errou, 2 difícil (parcial ou com dica), 3 bom (acertou), 4 fácil (só em cartão com autoavaliação).

const W = [0.40255, 1.18385, 3.173, 15.69105, 7.1949, 0.5345, 1.4604, 0.0046, 1.54575, 0.1192, 1.01925, 1.9395, 0.11, 0.29605, 2.2698, 0.2315, 2.9898, 0.51655, 0.6621]
const F = 19 / 81
const C = -0.5
const clamp = (x, a, b) => Math.max(a, Math.min(b, x))

export const retencao = (dias, S) => Math.pow(1 + (F * dias) / S, C)
const d0 = (g) => clamp(W[4] - Math.exp(W[5] * (g - 1)) + 1, 1, 10)

export function revisar(cartao, nota, dia) {
  if (!cartao) return { S: W[nota - 1], D: d0(nota), ultimo: dia, reps: 1 }
  const t = dia - cartao.ultimo
  const { S, D } = cartao
  const dNovo = clamp(W[7] * d0(4) + (1 - W[7]) * (D + (-W[6] * (nota - 3) * (10 - D)) / 9), 1, 10)
  let sNovo
  if (t < 1) {
    sNovo = S * Math.exp(W[17] * (nota - 3 + W[18]))
  } else {
    const R = retencao(t, S)
    if (nota === 1) {
      sNovo = Math.min(S, W[11] * Math.pow(D, -W[12]) * (Math.pow(S + 1, W[13]) - 1) * Math.exp(W[14] * (1 - R)))
    } else {
      const fator = nota === 2 ? W[15] : nota === 4 ? W[16] : 1
      sNovo = S * (Math.exp(W[8]) * (11 - D) * Math.pow(S, -W[9]) * (Math.exp(W[10] * (1 - R)) - 1) * fator + 1)
    }
  }
  return { S: Math.max(0.1, sNovo), D: dNovo, ultimo: dia, reps: cartao.reps + 1 }
}

// Próxima revisão para manter 90% de chance de lembrar.
export const proximaRevisaoEmDias = (S) => Math.max(1, Math.round(S))
