# Configurar o login no painel do Supabase

Feito uma vez, no painel do projeto (supabase.com, projeto do PGC). Nada disso fica no código, por isso está anotado aqui.

## 1. Endereços (Authentication > URL Configuration)

- **Site URL:** `http://localhost:3000`
- **Redirect URLs:** adicionar `http://localhost:3000/**`

Quando o PGC for para a Vercel, troque o Site URL pelo endereço da Vercel e acrescente `https://SEU-ENDERECO.vercel.app/**` nas Redirect URLs.

## 2. Cadastro por e-mail (Authentication > Sign In / Providers > Email)

- **Enable email provider:** ligado
- **Confirm email:** ligado
- **Secure password change:** ligado
- **Minimum password length:** `10`
- **Password requirements:** `Letters and digits`

O mínimo e a exigência precisam bater com `shared/regras/senha.js`. Se mudar num lugar, mude no outro.

## 3. Modelos de e-mail (Authentication > Emails > Templates)

Opcional por enquanto. Sem colar nada, o e-mail padrão do Supabase já funciona: o link passa por `/auth/retorno`, confirma o cadastro e leva para `/inicio` (ou para `/entrar` com o aviso "Cadastro completo", se o e-mail for aberto em outro navegador). Os modelos abaixo deixam o e-mail mais bonito e fazem o link funcionar em qualquer aparelho. O visual final do e-mail fica para o Brevo, perto do fim.

Abra cada modelo, troque o assunto e cole o HTML do arquivo indicado (o conteúdo inteiro):

| Modelo no painel | Assunto | Arquivo |
|---|---|---|
| Confirm signup | `Confirme seu e-mail no PGC` | `supabase/emails/confirmar-cadastro.html` |
| Reset password | `Senha nova no PGC` | `supabase/emails/redefinir-senha.html` |

Os dois links apontam para `/auth/confirmar` no próprio PGC. Assim a confirmação funciona mesmo abrindo o e-mail no celular depois de se cadastrar no computador.

## 4. Limites do envio de e-mail

O envio padrão do Supabase serve só para testes:

- só entrega para e-mails de quem faz parte da organização no Supabase (o seu funciona);
- poucos e-mails por hora para o projeto inteiro.

Se um teste mostrar "Muitos e-mails pedidos agora", espere uma hora. Antes de abrir para outras pessoas, entra um servidor de e-mail próprio (Brevo) e a verificação anti-robô (Turnstile). Os dois estão no plano para o fim.

## 5. Como saber se deu certo

1. `npm run dev` e abra `http://localhost:3000`.
2. Crie uma conta com o seu e-mail.
3. Abra o link do e-mail: deve cair em `/inicio` com "E-mail confirmado".
4. No painel, Table Editor > `perfis`: a linha nova tem nome, ritmo, objetivo e áreas que você escolheu.
