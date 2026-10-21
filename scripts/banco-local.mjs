// Liga o app ao banco LOCAL: pergunta ao Supabase CLI o endereço e as chaves do banco que está rodando no Docker e
// escreve o arquivo .env.local (que "npm run dev:local" usa). Uso: npm run banco:env (depois de npm run banco:iniciar).
// Copia do .env as chaves de IA, se existirem. Nunca mostra o valor de nenhuma chave na tela: só os nomes.
// Node 24, sem pacotes. Guia: docs/BANCO-LOCAL.md.
import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const RAIZ = resolve(import.meta.dirname, '..')
const DESTINO = resolve(RAIZ, '.env.local')
const NUVEM = resolve(RAIZ, '.env')
const CABECALHO = '# Gerado por "npm run banco:env"'
const CHAVES_IA = ['GROQ_API_KEY', 'CLOUDFLARE_ACCOUNT_ID', 'CLOUDFLARE_API_TOKEN', 'GEMINI_API_KEY', 'OPENROUTER_API_KEY']

function parar(mensagem) {
  console.error(`\n${mensagem}\n`)
  process.exit(1)
}

// Lê linhas NOME=valor (com ou sem aspas), como no .env e na saída de "supabase status -o env".
function lerVariaveis(texto) {
  const valores = {}
  for (const linha of String(texto ?? '').split(/\r?\n/)) {
    const m = linha.match(/^\s*(?:export\s+)?([A-Z][A-Z0-9_]*)\s*=\s*(.*?)\s*$/)
    if (!m) continue
    let valor = m[2]
    if (valor.length >= 2 && (valor[0] === '"' || valor[0] === "'") && valor.at(-1) === valor[0]) valor = valor.slice(1, -1)
    valores[m[1]] = valor
  }
  return valores
}

console.log('Lendo o endereço e as chaves do banco local (pode levar alguns segundos)...')
// Comando fixo, sem nada digitado pela pessoa: no Windows o npx é um .cmd e só roda pelo shell.
const status = spawnSync('npx --yes supabase@2 status -o env', { cwd: RAIZ, shell: true, encoding: 'utf8' })
if (status.error) parar('Não deu para rodar o npx. Confira se o Node.js está instalado (rode "node -v") e tente de novo.')

const saida = `${status.stdout ?? ''}\n${status.stderr ?? ''}`
if (status.status !== 0) {
  if (/Cannot connect to the Docker daemon|error during connect|docker_engine|Is the docker daemon running|docker daemon is not running/i.test(saida)) {
    parar('O Docker não está ligado. Abra o Docker Desktop, espere aparecer "Engine running" e rode "npm run banco:env" de novo.')
  }
  if (/No such container|not running|supabase start/i.test(saida)) {
    parar('O banco local está desligado. Rode "npm run banco:iniciar", espere terminar e depois "npm run banco:env".')
  }
  if (/ENOTFOUND|ETIMEDOUT|ECONNRESET|network/i.test(saida)) {
    parar('O npx precisa da internet na primeira vez para baixar o Supabase CLI. Confira a conexão e tente de novo.')
  }
  parar('O Supabase CLI não respondeu. Rode "npm run banco:iniciar" e leia a mensagem que ele mostrar.')
}

const lido = lerVariaveis(status.stdout)
const url = lido.API_URL
const chave = lido.PUBLISHABLE_KEY || lido.ANON_KEY
const segredo = lido.SECRET_KEY || lido.SERVICE_ROLE_KEY
if (!url || !chave || !segredo) {
  parar('O Supabase CLI respondeu, mas sem o endereço ou sem as chaves. Rode "npm run banco:iniciar" de novo e depois "npm run banco:env".')
}

// No GitHub Codespaces o navegador fica no computador da pessoa, e "127.0.0.1" seria o computador dela, não o
// Codespace: o app usa o endereço que o Codespaces dá para a porta 54321 (ela fica pública só para isso; o banco é de
// demonstração, com dados inventados).
const codespace = process.env.CODESPACE_NAME
const dominio = process.env.GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN
const enderecoDoApp = codespace && dominio ? `https://${codespace}-54321.${dominio}` : url
if (enderecoDoApp !== url) console.log('Codespace encontrado: o app vai usar o endereço público da porta 54321.')

const linhas = [
  `${CABECALHO}: liga o app ao banco LOCAL (Docker). Não vai para o Git.`,
  '# Para voltar ao banco da nuvem, use "npm run dev" (ele lê o .env).',
  `SUPABASE_URL="${enderecoDoApp}"`,
  `SUPABASE_KEY="${chave}"`,
  `SUPABASE_SECRET_KEY="${segredo}"`,
]
const copiadas = []
if (existsSync(NUVEM)) {
  const nuvem = lerVariaveis(readFileSync(NUVEM, 'utf8'))
  for (const nome of CHAVES_IA) {
    if (!nuvem[nome] || nuvem[nome].includes('"')) continue
    linhas.push(`${nome}="${nuvem[nome]}"`)
    copiadas.push(nome)
  }
}

// Um .env.local escrito à mão não se perde: vira .env.local.antigo.
if (existsSync(DESTINO) && !readFileSync(DESTINO, 'utf8').startsWith(CABECALHO)) {
  renameSync(DESTINO, `${DESTINO}.antigo`)
  console.log('O .env.local que já existia foi guardado como .env.local.antigo.')
}
writeFileSync(DESTINO, `${linhas.join('\n')}\n`, { encoding: 'utf8', mode: 0o600 })

console.log('Pronto: .env.local escrito com SUPABASE_URL, SUPABASE_KEY e SUPABASE_SECRET_KEY do banco local.')
console.log(copiadas.length
  ? `Chaves de IA copiadas do .env: ${copiadas.join(', ')}.`
  : 'Nenhuma chave de IA encontrada no .env: o app abre, mas gerar questões com IA não vai funcionar.')
console.log('Agora rode "npm run dev:local" e entre com ana@pgc.local (a senha está em docs/BANCO-LOCAL.md).')
