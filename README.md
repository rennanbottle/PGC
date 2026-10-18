# PGC: Plataforma Gerenciamento do Conhecimento

Trabalho do curso de Desenvolvimento de Sistemas. Cada participante do grupo cuida de uma matéria dentro do sistema:
Front-end 2, Back-end, Desenvolvimento de Sistemas, Fundamentos de Segurança de Software e Desenvolvimento de
Aplicativos. O sistema ajuda a pessoa a estudar com várias técnicas, como revisão espaçada, questões, provas e metas.

Plataforma de estudos: matérias, textos, questões, estudos com revisão espaçada, agenda, pontos e ranking.
Feito em **JavaScript** (Nuxt 4 + Vue 3), com o banco no Supabase. Não há TypeScript no projeto: o `tsconfig.json`
existe só para o editor entender os caminhos.

## Equipe

Cada parte do sistema tem um dono (Back-end, Desenvolvimento de Sistemas, Front-end 2, Desenvolvimento de
Aplicativos e Segurança). Quem é dono de quê, como trabalhar no próprio fork e no Codespace, e como as partes se
juntam: [docs/equipe/LEIA-PRIMEIRO.md](docs/equipe/LEIA-PRIMEIRO.md).

No GitHub Codespaces: `npm run codespace:banco` e `npm run dev:local` (banco de demonstração dentro do Codespace).

## Como rodar no seu computador (Windows, VS Code)

Precisa do Node 24 LTS (`node -v` deve mostrar v24.11 ou mais novo).

```powershell
npm install          # baixa as dependências (na primeira vez e quando o package.json mudar, como agora com o KaTeX)
npm test             # roda os testes das regras
npm run build        # confere se o projeto compila para produção
npm run dev          # abre em http://localhost:3000 usando o banco da nuvem (.env)
npm run simular      # mostra como as regras de domínio e pontos se comportam
```

### Banco local (para testes, recomendado pelo professor)

Com o Docker Desktop aberto: `npm run banco:iniciar`, depois `npm run banco:env` e `npm run dev:local`.
O banco local já vem com contas e dados de demonstração (fictícios). Passo a passo completo, contas de teste e
problemas comuns: [docs/BANCO-LOCAL.md](docs/BANCO-LOCAL.md). Para voltar ao banco da nuvem, use `npm run dev`.

### Chaves do `.env`

Copie `.env.example` para `.env` e preencha só no seu computador. Ao ligar, o terminal avisa se faltar alguma
(`[PGC] Faltam chaves no .env`), mostrando só o nome.

| Variável | Para que serve | Onde pegar |
|---|---|---|
| `SUPABASE_URL` e `SUPABASE_KEY` | entrar e ler os seus dados | Supabase, projeto PGC-N, Project Settings: Data API (URL) e API Keys (Publishable key) |
| `SUPABASE_SECRET_KEY` | gravar os estudos e usar a IA do PGC | Supabase, Project Settings, API Keys, parte Secret keys: copie a chave que começa com `sb_secret_`. Não é a mesma do `SUPABASE_KEY` nem a "anon public" |
| `GROQ_API_KEY` | IA do PGC (Groq) | console.groq.com, API Keys |
| `CLOUDFLARE_ACCOUNT_ID` e `CLOUDFLARE_API_TOKEN` | IA do PGC (Cloudflare), opcional | painel da Cloudflare, Workers AI |
| `NUXT_PUBLIC_SITE_URL` | endereço do site no link de prévia (WhatsApp), no robots.txt e no sitemap. Não é segredo | o endereço da Vercel, sem barra no fim; vazio no computador |

Depois de mudar o `.env`, pare o `npm run dev` (Ctrl+C) e rode de novo. A chave secreta abre o banco todo: nunca
mande em chat, print, Git ou ZIP. Se ela vazar, crie outra na mesma página do Supabase e apague a antiga. Em
computador da escola, apague o `.env` ao terminar.

## Documentos

| Arquivo | O que explica |
|---|---|
| `docs/COMO-FUNCIONA.md` | o sistema em linguagem simples: telas, caminho do estudante, regras e onde fica cada coisa no código |
| `docs/DESIGN.md` | o guia visual: cores, fontes, peças prontas e o que é proibido |
| `docs/BANCO-LOCAL.md` | como testar com o banco no próprio computador |

## Pastas

| Pasta | Para que serve |
|---|---|
| `app/` | o que roda no navegador: páginas, componentes, estilos |
| `app/assets/css/main.css` | único lugar com cores (tokens), fontes e as classes das peças |
| `app/layouts/` | molduras: `entrada` (login e cadastro), `default` (telas internas) e `foco` (estudo) |
| `app/middleware/` | porteiro das telas: quem precisa estar logado e quem não |
| `public/fonts/` | Bricolage Grotesque, Onest e JetBrains Mono servidas pelo próprio PGC, com as licenças |
| `server/` | o que roda só no servidor: APIs, links de e-mail, leitura de PDF e DOCX, chamadas de IA, correção dos estudos |
| `shared/regras/` | regras puras (motor de estudo, pontos, desbloqueios, agenda, catálogo de matérias...), cada uma com teste |
| `scripts/` | utilitários de linha de comando (`banco-local.mjs` cria o `.env.local`) |
| `supabase/migrations/` | mudanças no banco, numeradas e com bloco para desfazer |
| `supabase/seed.sql`, `supabase/config.toml` | dados de demonstração e configuração do banco local |
| `supabase/emails/` | modelos dos e-mails de confirmação e de senha nova (colados no painel do Supabase) |
| `.github/workflows/` | testes e build automáticos a cada envio para o GitHub |

## Telas

| Endereço | O que faz |
|---|---|
| `/entrar`, `/criar-conta` | login e cadastro em 3 passos, com o Elo acompanhando |
| `/recuperar-senha`, `/redefinir-senha` | senha nova pelo link do e-mail |
| `/inicio` | o próximo passo, a meta de hoje, a semana, a agenda e as matérias |
| `/agenda` | provas, trabalhos e estudos no mês, na semana ou em lista; plano de estudo até a prova; metas |
| `/materias`, `/materias/[id]` | matérias com assuntos sugeridos e o caminho de cada uma (assuntos, textos, questões, estudar) |
| `/assuntos/[id]` | um assunto por dentro: proficiência, acerto, lembrança, erros, critérios de domínio e a prova de domínio |
| `/materiais` (menu Biblioteca) | os textos: uma caixa só para arquivo, texto colado ou tema; "Confira rapidinho" para aprovar |
| `/materiais/[id]`, `/materiais/[id]/conferir` | leitura do texto e ajuste das páginas |
| `/materiais/buscar` | textos abertos (Wikilivros, Wikiversidade, Wikipédia) e questões do Enem |
| `/questoes` | banco de questões, com filtros e o que está fora dos estudos |
| `/questoes/gerar`, `/questoes/geradas/[id]` | gerar questões (do texto, com a IA do PGC ou com outra IA) e conferir o resultado |
| `/questoes/nova`, `/questoes/[id]`, `/questoes/importar/[id]` | escrever, editar e importar questões |
| `/revisar` (menu Estudar), `/revisar/nova`, `/revisar/[id]`, `/revisar/[id]/resultado` | estudar em blocos de revisão e prática, em modo foco, e ver o resultado |
| `/ranking` | seu desempenho (Você) e, se quiser participar, o ranking pelo apelido (Geral) |
| `/historico` | tudo o que você fez, dia a dia (abre pelo menu da sua foto) |
| `/perfil` | conta, estudo, aparência, privacidade e sessão (sair sozinho depois de um tempo parado) |
| `/prova`, `/prova/nova`, `/prova/[id]`, `/prova/[id]/resultado` | simulados com cronômetro e cartão-resposta (abre com 2 estudos de 10 questões, 40 respostas e 4 tipos) |
| `/` | apresentação pública (a única página feita para aparecer no Google), com `og.png`, ícones, `robots.txt` e `sitemap.xml` |
| `/privacidade` | política de privacidade |
| `/diagnostico` | só para o dono do sistema: uso da IA e testes |
| `/componentes` | vitrine das peças visuais (não aparece no menu) |

## Regras do repositório

- `.env` e `.env.local` nunca entram no Git. `.env.example` só tem os nomes das variáveis.
- Toda cor sai dos tokens em `main.css`.
- Regra de negócio fica em `shared/regras`, com teste. Tela só mostra.
- Mudança no banco só acrescenta, numa migração nova.
