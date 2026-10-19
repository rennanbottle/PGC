-- 0004_materias_assuntos.sql
-- Matérias e assuntos de cada pessoa. Só acrescenta: nada existente é apagado.
-- Regras:
--   - Cada pessoa só vê e mexe nas próprias linhas (RLS). Visitante sem login não acessa nada.
--   - O assunto aponta para a matéria pelo par (matéria, dono): ninguém liga um assunto à matéria de outra conta.
--   - Nome repetido não entra (sem diferenciar maiúsculas), entre as matérias ativas e entre os assuntos ativos de uma matéria.
--   - Limites contra abuso: 200 matérias por conta, 300 assuntos por matéria, 2000 assuntos por conta.
--   - A ordem nova vai para o fim da lista quando não é informada.

create function public.tocar_atualizado_em()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.atualizado_em := now();
  return new;
end;
$$;

create table public.materias (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  nome text not null check (char_length(btrim(nome)) between 1 and 80),
  area text not null default 'outra'
    check (area in ('exatas', 'natureza', 'humanas', 'portugues', 'idiomas', 'programacao', 'saude', 'direito', 'outra')),
  cor text not null default 'azul'
    check (cor in ('azul', 'verde', 'laranja', 'roxo', 'vermelho', 'amarelo', 'rosa', 'cinza')),
  descricao text check (descricao is null or char_length(descricao) <= 500),
  ordem integer not null default 0,
  arquivada_em timestamptz,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  unique (id, usuario_id)
);

create table public.assuntos (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  materia_id uuid not null,
  nome text not null check (char_length(btrim(nome)) between 1 and 120),
  ordem integer not null default 0,
  arquivado_em timestamptz,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  unique (id, usuario_id),
  foreign key (materia_id, usuario_id) references public.materias (id, usuario_id) on delete cascade
);

create index materias_usuario_ordem on public.materias (usuario_id, ordem);
create unique index materias_nome_unico on public.materias (usuario_id, lower(btrim(nome))) where arquivada_em is null;
create index assuntos_usuario on public.assuntos (usuario_id);
create index assuntos_materia_usuario on public.assuntos (materia_id, usuario_id);
create unique index assuntos_nome_unico on public.assuntos (materia_id, lower(btrim(nome))) where arquivado_em is null;

-- Antes de inserir: limites e ordem no fim da lista.
create function public.materias_antes_de_inserir()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (select count(*) from public.materias where usuario_id = new.usuario_id) >= 200 then
    raise exception 'Você chegou ao limite de 200 matérias. Arquive ou exclua alguma para criar outra.' using errcode = 'P0001';
  end if;
  if new.ordem is null or new.ordem <= 0 then
    select coalesce(max(ordem), 0) + 1 into new.ordem from public.materias where usuario_id = new.usuario_id;
  end if;
  return new;
end;
$$;

create function public.assuntos_antes_de_gravar()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if (select count(*) from public.assuntos where materia_id = new.materia_id) >= 300 then
      raise exception 'Esta matéria chegou ao limite de 300 assuntos.' using errcode = 'P0001';
    end if;
    if (select count(*) from public.assuntos where usuario_id = new.usuario_id) >= 2000 then
      raise exception 'Você chegou ao limite de 2000 assuntos.' using errcode = 'P0001';
    end if;
  else
    new.atualizado_em := now();
  end if;
  -- Assunto novo ou movido para outra matéria vai para o fim da lista dela.
  if new.ordem is null or new.ordem <= 0 or (tg_op = 'UPDATE' and new.materia_id is distinct from old.materia_id) then
    select coalesce(max(ordem), 0) + 1 into new.ordem from public.assuntos where materia_id = new.materia_id and id <> new.id;
  end if;
  return new;
end;
$$;

create trigger materias_antes_de_inserir before insert on public.materias
  for each row execute function public.materias_antes_de_inserir();
create trigger materias_antes_de_alterar before update on public.materias
  for each row execute function public.tocar_atualizado_em();
create trigger assuntos_antes_de_gravar before insert or update on public.assuntos
  for each row execute function public.assuntos_antes_de_gravar();

alter table public.materias enable row level security;
alter table public.assuntos enable row level security;

create policy "materias: só do dono" on public.materias for all to authenticated
  using ((select auth.uid()) = usuario_id)
  with check ((select auth.uid()) = usuario_id);
create policy "assuntos: só do dono" on public.assuntos for all to authenticated
  using ((select auth.uid()) = usuario_id)
  with check ((select auth.uid()) = usuario_id);

revoke all on public.materias, public.assuntos from anon;
grant select, insert, update, delete on public.materias, public.assuntos to authenticated;

-- Reordenar de uma vez (arrastar na tela). Roda com as permissões de quem chama: o RLS continua valendo.
create function public.reordenar_materias(ids uuid[])
returns void
language sql
security invoker
set search_path = ''
as $$
  update public.materias m set ordem = p.posicao
  from unnest(ids) with ordinality as p (id, posicao)
  where m.id = p.id;
$$;

create function public.reordenar_assuntos(materia uuid, ids uuid[])
returns void
language sql
security invoker
set search_path = ''
as $$
  update public.assuntos a set ordem = p.posicao
  from unnest(ids) with ordinality as p (id, posicao)
  where a.id = p.id and a.materia_id = materia;
$$;

revoke execute on function public.reordenar_materias(uuid[]), public.reordenar_assuntos(uuid, uuid[]) from public, anon;
grant execute on function public.reordenar_materias(uuid[]), public.reordenar_assuntos(uuid, uuid[]) to authenticated;
revoke execute on function public.tocar_atualizado_em(), public.materias_antes_de_inserir(), public.assuntos_antes_de_gravar() from public, anon, authenticated;

-- DESFAZER (apaga todas as matérias e assuntos; só com backup e confirmação):
-- drop function if exists public.reordenar_assuntos(uuid, uuid[]);
-- drop function if exists public.reordenar_materias(uuid[]);
-- drop table if exists public.assuntos;
-- drop table if exists public.materias;
-- drop function if exists public.assuntos_antes_de_gravar();
-- drop function if exists public.materias_antes_de_inserir();
-- drop function if exists public.tocar_atualizado_em();
