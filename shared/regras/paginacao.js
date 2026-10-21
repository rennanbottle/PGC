// Números da paginação: sempre a primeira, a última e as vizinhas da atual, com "..." no lugar dos saltos.
// Até 7 páginas aparecem todas. Ex.: 12 páginas na 6 dá [1, '...', 5, 6, 7, '...', 12].
export function paginasVisiveis(total, atual) {
  const n = Math.max(1, Math.floor(total) || 1)
  const p = Math.min(n, Math.max(1, Math.floor(atual) || 1))
  if (n <= 7) return Array.from({ length: n }, (_, i) => i + 1)
  const lista = [1]
  const ini = Math.max(2, Math.min(p - 1, n - 4))
  const fim = Math.min(n - 1, Math.max(p + 1, 5))
  if (ini > 2) lista.push('...')
  for (let i = ini; i <= fim; i++) lista.push(i)
  if (fim < n - 1) lista.push('...')
  lista.push(n)
  return lista
}

// Quantas páginas para "itens" de "porPagina" em "porPagina" (no mínimo 1).
export const totalDePaginas = (itens, porPagina) => Math.max(1, Math.ceil((Number(itens) || 0) / Math.max(1, porPagina)))
