// Quem pode abrir cada tela. Função pura, usada pelo middleware app/middleware/autenticacao.global.js.
// Devolve o endereço para onde mandar a pessoa, ou null quando ela pode ficar onde está.
// Endereços antigos que viraram parte de outra tela (Desempenho agora mora no Ranking) são trocados antes.
import { REDIRECIONAMENTOS } from './navegacao.js'

export const TELAS_SEM_LOGIN = new Set(['/entrar', '/criar-conta', '/recuperar-senha'])
export const TELAS_ABERTAS = new Set(['/privacidade'])

// "verApresentacao": quem está logado e pediu para ver a apresentação (/?ver=apresentacao, no menu da conta).
export function decidirRota({ caminho, caminhoCompleto = caminho, logado, verApresentacao = false }) {
  // A raiz é a página de apresentação do PGC para quem não está logado; quem está logado vai direto para o Início,
  // a não ser que tenha pedido para ver a apresentação.
  if (caminho === '/') return logado && !verApresentacao ? '/inicio' : null
  const novo = REDIRECIONAMENTOS[caminho.replace(/\/+$/, '')]
  if (novo) return logado ? novo : `/entrar?volta=${encodeURIComponent(novo)}`
  if (TELAS_ABERTAS.has(caminho)) return null
  if (TELAS_SEM_LOGIN.has(caminho)) return logado ? '/inicio' : null
  if (logado) return null
  // Sem sessão numa tela interna.
  if (caminho === '/redefinir-senha') return '/recuperar-senha?link=expirado'
  if (caminhoCompleto === '/inicio') return '/entrar'
  return `/entrar?volta=${encodeURIComponent(caminhoCompleto)}`
}
