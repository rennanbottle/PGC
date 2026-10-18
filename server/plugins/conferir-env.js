// Ao ligar o servidor, avisa no terminal quais chaves faltam no .env e o que deixa de funcionar.
// Só os nomes das variáveis aparecem, nunca os valores.
const GRUPOS = [
  { nomes: ['SUPABASE_URL', 'NUXT_PUBLIC_SUPABASE_URL'], falta: 'SUPABASE_URL', uso: 'o sistema todo' },
  { nomes: ['SUPABASE_KEY', 'NUXT_PUBLIC_SUPABASE_KEY'], falta: 'SUPABASE_KEY', uso: 'o sistema todo' },
  { nomes: ['GROQ_API_KEY', 'CLOUDFLARE_API_TOKEN'], falta: 'GROQ_API_KEY ou CLOUDFLARE_API_TOKEN', uso: 'a IA do PGC (a Outra IA funciona sem elas)' },
]

export default defineNitroPlugin(() => {
  const faltam = GRUPOS.filter((g) => !g.nomes.some((n) => process.env[n]))
  const secreta = problemaDaChaveSecreta()
  if (secreta === 'falta') faltam.splice(2, 0, { falta: 'SUPABASE_SECRET_KEY', uso: 'estudar e a IA do PGC' })
  if (secreta === 'publica') console.warn(`[PGC] ${AVISO_CHAVE.publica}`)
  if (!faltam.length) return
  console.warn(`[PGC] Faltam chaves no .env: ${faltam.map((g) => `${g.falta} (para ${g.uso})`).join('; ')}. O README mostra onde pegar cada uma.`)
})
