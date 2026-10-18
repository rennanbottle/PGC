// GET /api/saude
// Um visitante sem login tenta ler a tabela de perfis. A resposta certa é "permissão negada" (código 42501):
// - se ela chega, o servidor alcançou o Supabase com a URL e a chave do .env (conexão ok);
// - e o banco recusou o visitante (proteção ok).
// Nunca devolve chave, e-mail ou conteúdo de tabela.
import { serverSupabaseClient } from '#supabase/server'

export default defineEventHandler(async (event) => {
  const { url, key } = useRuntimeConfig().public.supabase ?? {}
  if (!url || !key) {
    return { conexao: 'sem_configuracao', protecao: 'desconhecida' }
  }

  try {
    const supabase = await serverSupabaseClient(event)
    const { error } = await supabase.from('perfis').select('id').limit(1)
    if (!error) return { conexao: 'ok', protecao: 'aberta' }
    if (error.code === '42501') return { conexao: 'ok', protecao: 'ok' }
    return { conexao: 'falhou', protecao: 'desconhecida', codigo: error.code ?? null }
  } catch {
    return { conexao: 'falhou', protecao: 'desconhecida', codigo: 'rede' }
  }
})
