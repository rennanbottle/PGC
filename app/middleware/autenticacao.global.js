// Porteiro de todas as páginas. Roda no servidor (primeira carga) e no navegador (cada troca de tela).
// - Telas de entrada: só para quem não está logado. Logado vai para /inicio.
// - Telas internas: só para quem está logado. Sem sessão, vai para /entrar e volta depois para onde queria.
// - /redefinir-senha: só abre com a sessão criada pelo link de recuperação.
// A proteção dos dados em si está no banco (RLS). Aqui é só o caminho entre as telas.
// A decisão fica em shared/regras/rotas.js, que tem teste.
import { decidirRota } from '#shared/regras/rotas.js'

export default defineNuxtRouteMiddleware(async (para) => {
  // O e-mail padrão do Supabase pode voltar para qualquer endereço do site com "?code=...".
  // Quem trata isso é o servidor, em /auth/retorno; sem este desvio o código se perderia no redirecionamento.
  if (typeof para.query.code === 'string') {
    return navigateTo(`/auth/retorno?code=${encodeURIComponent(para.query.code)}`, { external: true })
  }

  const sessao = useSupabaseSession()
  const { sessaoDeveTerminar, marcarAbaAberta } = useLembrarSessao()

  if (sessao.value && sessaoDeveTerminar()) {
    try {
      await useSupabaseClient().auth.signOut({ scope: 'local' })
    }
    catch {
      // Sem conexão: limpa o estado da tela mesmo assim; o cookie vence sozinho.
    }
    sessao.value = null
    useSupabaseUser().value = null
  }

  const logado = !!sessao.value
  if (logado) marcarAbaAberta()

  const destino = decidirRota({ caminho: para.path, caminhoCompleto: para.fullPath, logado, verApresentacao: para.query.ver === 'apresentacao' })
  if (destino) return navigateTo(destino, { replace: true })
})
