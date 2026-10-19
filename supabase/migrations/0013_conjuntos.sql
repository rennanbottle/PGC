-- Etapa 8: conjuntos de estudo.
--   - conjuntos: o modelo com nome, em blocos de Revisão e Prática (até 6). É só configuração: a pessoa cria,
--     muda e apaga os próprios. Mudar ou apagar um conjunto não mexe nas execuções já feitas.
--   - revisoes passa a ser a EXECUÇÃO: guarda a cópia dos blocos como estavam no começo (blocos), o bloco em que a
--     pessoa está (bloco_atual), de qual conjunto veio (conjunto_id, que vira vazio se o conjunto for apagado),
--     a geração de IA usada para completar (geracao_id) e o comentário da IA no fim (comentario).
--   - revisao_itens ganha o número do bloco.
-- O nome da tabela continua "revisoes" para não quebrar o que já existe; na tela ela se chama execução.

create table public.conjuntos (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  nome text not null check (char_length(btrim(nome)) between 1 and 80),
  blocos jsonb not null check (jsonb_typeof(blocos) = 'array' and jsonb_array_length(blocos) between 1 and 6 and pg_column_size(blocos) <= 40000),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  unique (id, usuario_id)
);
create index conjuntos_por_pessoa on public.conjuntos (usuario_id, atualizado_em desc);

create function public.conjuntos_antes_de_inserir()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (select count(*) from public.conjuntos where usuario_id = new.usuario_id) >= 100 then
    raise exception 'Você chegou ao limite de 100 conjuntos. Apague algum para salvar outro.' using errcode = 'P0001';
  end if;
  new.nome := btrim(new.nome);
  return new;
end;
$$;
create function public.conjuntos_antes_de_alterar()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.usuario_id is distinct from old.usuario_id then
    raise exception 'O dono do conjunto não muda.' using errcode = 'P0001';
  end if;
  new.nome := btrim(new.nome);
  new.criado_em := old.criado_em;
  new.atualizado_em := now();
  return new;
end;
$$;
create trigger conjuntos_antes_de_inserir before insert on public.conjuntos
  for each row execute function public.conjuntos_antes_de_inserir();
create trigger conjuntos_antes_de_alterar before update on public.conjuntos
  for each row execute function public.conjuntos_antes_de_alterar();

alter table public.conjuntos enable row level security;
create policy "conjuntos: só do dono" on public.conjuntos for all to authenticated
  using ((select auth.uid()) = usuario_id)
  with check ((select auth.uid()) = usuario_id);
revoke all on public.conjuntos from anon;
grant select, insert, update, delete on public.conjuntos to authenticated;
revoke execute on function public.conjuntos_antes_de_inserir(), public.conjuntos_antes_de_alterar() from public, anon, authenticated;

alter table public.revisoes
  add column conjunto_id uuid,
  add column blocos jsonb not null default '[]' check (jsonb_typeof(blocos) = 'array' and jsonb_array_length(blocos) <= 6 and pg_column_size(blocos) <= 60000),
  add column bloco_atual integer not null default 0 check (bloco_atual between 0 and 5),
  add column geracao_id uuid,
  add column comentario jsonb check (comentario is null or (jsonb_typeof(comentario) = 'object' and pg_column_size(comentario) <= 8000)),
  add foreign key (conjunto_id, usuario_id) references public.conjuntos (id, usuario_id) on delete set null (conjunto_id);
create index revisoes_por_conjunto on public.revisoes (conjunto_id, criado_em desc) where conjunto_id is not null;

alter table public.revisao_itens add column bloco integer not null default 0 check (bloco between 0 and 5);
