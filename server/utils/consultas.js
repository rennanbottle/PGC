// O Supabase devolve no máximo 1000 linhas por pedido. Isto pede em partes até acabar.
// "criar(de, ate)" monta a consulta de novo a cada parte (a consulta não pode ser reaproveitada).
export async function todasAsLinhas(criar, tamanho = 1000, limite = 20000) {
  const linhas = []
  for (let de = 0; de < limite; de += tamanho) {
    const { data, error } = await criar(de, de + tamanho - 1)
    if (error) throw error
    linhas.push(...data)
    if (data.length < tamanho) break
  }
  return linhas
}

export function emLotes(lista, tamanho) {
  const lotes = []
  for (let i = 0; i < lista.length; i += tamanho) lotes.push(lista.slice(i, i + tamanho))
  return lotes
}

export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
