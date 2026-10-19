-- 0019_metas_relacionados.sql
-- Metas na Agenda, assuntos relacionados e a conferência do e-mail no cadastro.
--   - metas: o que a pessoa quer cumprir, por semana (toda semana, de domingo a sábado) ou até uma data. Tipos:
--     questões respondidas, minutos de estudo, estudos feitos e assuntos dominados (este só com data). Pode ser de
--     uma matéria ou de todas. O progresso é contado pelo servidor a partir das respostas; a tabela guarda só a meta
--     e quando ela foi batida (batida_em, para as metas com data).
--   - assunto_relacoes: as sugestões de assunto relacionado que a pessoa aceitou ou recusou. O par fica guardado uma
--     vez só, com o menor id primeiro (assunto_a < assunto_b).
--   - email_tem_conta(): diz se um e-mail já tem conta. Só o servidor pode chamar (chave secreta), para o cadastro
--     avisar já no passo 1. Ninguém logado ou anônimo chama direto.
-- Só acrescenta: nenhum dado nem regra existente é apagado.

-- 1. Metas -------------------------------------------------------------------------------------------------------------

create table public.metas (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  tipo text not null check (tipo in ('questoes', 'minutos', 'estudos', 'dominar')),
  alvo integer not null check (alvo between 1 and 10000),
  periodo text not null check (periodo in ('semana', 'data')),
  inicio date not null default (now() at time zone 'America/Sao_Paulo')::date,
  prazo date,
  materia_id uuid,
  batida_em timestamptz,
  arquivada_em timestamptz,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  unique (id, usuario_id),
  constraint metas_prazo check ((periodo = 'data') = (prazo is not null) and (prazo is null or prazo >= inicio)),
  constraint metas_dominar_com_data check (tipo <> 'dominar' or periodo = 'data'),
  foreign key (materia_id, usuario_id) references public.materias (id, usuario_id) on delete cascade
);

create index metas_usuario on public.metas (usuario_id, arquivada_em);
create index metas_materia_usuario on public.metas (materia_id, usuario_id);

create function public.metas_antes_de_gravar()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if (select count(*) from public.metas where usuario_id = new.usuario_id and arquivada_em is null) >= 20 then
      raise exception 'Você já tem 20 metas. Arquive uma para criar outra.' using errcode = 'P0001';
    end if;
  else
    new.atualizado_em := now();
  end if;
  return new;
end;
$$;

create trigger metas_antes_de_gravar before insert or update on public.metas
  for each row execute function public.metas_antes_de_gravar();

alter table public.metas enable row level security;

create policy "metas: só do dono" on public.metas for all to authenticated
  using ((select auth.uid()) = usuario_id)
  with check ((select auth.uid()) = usuario_id);

revoke all on public.metas from anon, authenticated;
grant select, insert, delete on public.metas to authenticated;
grant update (tipo, alvo, periodo, prazo, materia_id, arquivada_em) on public.metas to authenticated;
revoke execute on function public.metas_antes_de_gravar() from public, anon, authenticated;

-- 2. Assuntos relacionados ---------------------------------------------------------------------------------------------

create table public.assunto_relacoes (
  usuario_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  assunto_a uuid not null,
  assunto_b uuid not null,
  status text not null check (status in ('aceito', 'recusado')),
  criado_em timestamptz not null default now(),
  primary key (usuario_id, assunto_a, assunto_b),
  constraint assunto_relacoes_ordem check (assunto_a < assunto_b),
  foreign key (assunto_a, usuario_id) references public.assuntos (id, usuario_id) on delete cascade,
  foreign key (assunto_b, usuario_id) references public.assuntos (id, usuario_id) on delete cascade
);

create index assunto_relacoes_b on public.assunto_relacoes (assunto_b, usuario_id);

alter table public.assunto_relacoes enable row level security;

create policy "assunto_relacoes: só do dono" on public.assunto_relacoes for all to authenticated
  using ((select auth.uid()) = usuario_id)
  with check ((select auth.uid()) = usuario_id);

revoke all on public.assunto_relacoes from anon, authenticated;
grant select, insert, delete on public.assunto_relacoes to authenticated;
grant update (status) on public.assunto_relacoes to authenticated;

-- 3. E-mail já tem conta (só o servidor) -------------------------------------------------------------------------------

create function public.email_tem_conta(p_email text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from auth.users
    where lower(email) = lower(btrim(p_email)) and deleted_at is null
  );
$$;

revoke execute on function public.email_tem_conta(text) from public, anon, authenticated;
grant execute on function public.email_tem_conta(text) to service_role;
