-- 0001_perfis.sql
-- Perfil de cada conta: uma linha por usuário do Supabase Auth, criada sozinha no cadastro.
-- Segurança:
--   - RLS ligada: cada pessoa só lê e altera o próprio perfil.
--   - Ninguém insere nem apaga perfil pela API: ele nasce pelo gatilho do cadastro e some com a conta.
--   - O usuário só consegue alterar as colunas liberadas no GRANT (não muda id, datas nem aceite de privacidade).
--   - Trocar o ritmo de estudo: no máximo uma vez a cada 7 dias, conferido no banco.

create table public.perfis (
  id uuid primary key references auth.users (id) on delete cascade,
  nome_exibicao text not null check (char_length(btrim(nome_exibicao)) between 1 and 60),
  avatar_caminho text check (avatar_caminho is null or char_length(avatar_caminho) <= 300),
  tema text not null default 'sistema' check (tema in ('claro', 'escuro', 'sistema')),
  paleta text not null default 'padrao' check (char_length(paleta) between 1 and 30),
  movimento_reduzido boolean not null default false,
  ritmo text not null default 'normal' check (ritmo in ('tranquilo', 'normal', 'focado', 'obcecado')),
  ritmo_trocado_em timestamptz,
  objetivo text check (objetivo in ('enem', 'vestibular', 'concurso', 'faculdade', 'curso_tecnico', 'por_conta_propria')),
  nivel_na_questao text not null default 'mostrar' check (nivel_na_questao in ('mostrar', 'esconder', 'disfarcar')),
  onboarding jsonb not null default '{}'::jsonb check (jsonb_typeof(onboarding) = 'object'),
  privacidade_aceita_em timestamptz,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

comment on table public.perfis is 'Um perfil por conta. Criado pelo gatilho ao_criar_usuario.';

alter table public.perfis enable row level security;

create policy "perfis: ler o próprio"
  on public.perfis for select to authenticated
  using ((select auth.uid()) = id);

create policy "perfis: alterar o próprio"
  on public.perfis for update to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

-- Permissões por coluna: além da RLS, o banco só deixa mudar o que a tela de perfil pode mudar.
revoke all on public.perfis from anon, authenticated;
grant select on public.perfis to authenticated;
grant update (nome_exibicao, avatar_caminho, tema, paleta, movimento_reduzido, ritmo, objetivo, nivel_na_questao, onboarding)
  on public.perfis to authenticated;

-- Antes de cada alteração: atualiza a data e aplica a regra do ritmo.
create function public.perfis_antes_de_alterar()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.atualizado_em := now();
  if new.ritmo is distinct from old.ritmo then
    if old.ritmo_trocado_em is not null and old.ritmo_trocado_em > now() - interval '7 days' then
      raise exception 'O ritmo só pode ser trocado uma vez a cada 7 dias.' using errcode = 'P0001';
    end if;
    new.ritmo_trocado_em := now();
  end if;
  return new;
end;
$$;

create trigger perfis_antes_de_alterar
  before update on public.perfis
  for each row execute function public.perfis_antes_de_alterar();

-- Cria o perfil quando a conta nasce. Os dados do cadastro chegam em raw_user_meta_data,
-- que é escrito pelo próprio usuário: por isso cada valor é conferido aqui.
create function public.criar_perfil()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  nome text := left(btrim(coalesce(meta ->> 'nome_exibicao', '')), 60);
  ritmo_pedido text := meta ->> 'ritmo';
  objetivo_pedido text := meta ->> 'objetivo';
begin
  if nome = '' then
    nome := 'Estudante';
  end if;
  insert into public.perfis (id, nome_exibicao, ritmo, objetivo, privacidade_aceita_em)
  values (
    new.id,
    nome,
    case when ritmo_pedido in ('tranquilo', 'normal', 'focado', 'obcecado') then ritmo_pedido else 'normal' end,
    case when objetivo_pedido in ('enem', 'vestibular', 'concurso', 'faculdade', 'curso_tecnico', 'por_conta_propria') then objetivo_pedido end,
    case when meta ->> 'privacidade_aceita' = 'true' then now() end
  );
  return new;
end;
$$;

revoke execute on function public.criar_perfil() from public, anon, authenticated;
revoke execute on function public.perfis_antes_de_alterar() from public, anon, authenticated;

create trigger ao_criar_usuario
  after insert on auth.users
  for each row execute function public.criar_perfil();

-- DESFAZER (apaga a tabela e todos os perfis; só rodar com backup e confirmação):
-- drop trigger if exists ao_criar_usuario on auth.users;
-- drop function if exists public.criar_perfil();
-- drop trigger if exists perfis_antes_de_alterar on public.perfis;
-- drop function if exists public.perfis_antes_de_alterar();
-- drop table if exists public.perfis;
