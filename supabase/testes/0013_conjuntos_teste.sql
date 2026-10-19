-- Teste da migração 0013 sem deixar rastro: o bloco termina com erro de propósito e o banco desfaz tudo.
do $teste$
declare
  a uuid := gen_random_uuid();
  b uuid := gen_random_uuid();
  c uuid;
  r uuid;
  rel text := '';
  n int;
  t text;
begin
  execute $m$
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
$m$;
  insert into auth.users (id, email, aud, role) values (a, 'a@teste.pgc', 'authenticated', 'authenticated'), (b, 'b@teste.pgc', 'authenticated', 'authenticated');
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  insert into public.conjuntos (nome, blocos) values ('  Física de terça ', '[{"tipo":"revisao"},{"tipo":"pratica"}]') returning id, nome into c, t;
  rel := rel || '1 cria e apara o nome: [' || t || ']' || E'\n';
  begin
    insert into public.conjuntos (nome, blocos) values ('Vazio', '[]');
    rel := rel || '2 FALHOU: conjunto sem bloco' || E'\n';
  exception when check_violation then rel := rel || '2 sem bloco recusado' || E'\n';
  end;
  begin
    insert into public.conjuntos (nome, blocos) values ('Sete', '[{},{},{},{},{},{},{}]');
    rel := rel || '3 FALHOU: 7 blocos' || E'\n';
  exception when check_violation then rel := rel || '3 sete blocos recusados' || E'\n';
  end;
  begin
    insert into public.conjuntos (usuario_id, nome, blocos) values (b, 'De outro', '[{}]');
    rel := rel || '4 FALHOU: criou para outra pessoa' || E'\n';
  exception when insufficient_privilege then rel := rel || '4 não cria para outra pessoa' || E'\n';
  end;
  begin
    update public.conjuntos set usuario_id = b where id = c;
    rel := rel || '5 FALHOU: trocou o dono' || E'\n';
  exception when insufficient_privilege or sqlstate 'P0001' then rel := rel || '5 dono não muda' || E'\n';
  end;
  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  select count(*) into n from public.conjuntos where id = c;
  rel := rel || '6 B vê ' || n || ' conjuntos de A (esperado 0)' || E'\n';
  update public.conjuntos set nome = 'invadido' where id = c;
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  select nome into t from public.conjuntos where id = c;
  rel := rel || '7 nome depois da tentativa de B: ' || t || E'\n';
  begin
    update public.revisoes set bloco_atual = 1 where false;
    rel := rel || '8 FALHOU: a pessoa escreve em revisoes' || E'\n';
  exception when insufficient_privilege then rel := rel || '8 revisoes continua só leitura' || E'\n';
  end;
  execute 'reset role';
  insert into public.revisoes (usuario_id, modelo, titulo, total, conjunto_id, blocos) values (a, 'personalizada', 'Teste', 3, c, '[{"tipo":"revisao"}]') returning id into r;
  insert into public.revisao_itens (usuario_id, revisao_id, ordem, bloco, tipo, nivel, bloom, snapshot, semente) values (a, r, 100, 1, 'multipla_escolha', 2, 2, '{}', 'x');
  rel := rel || '9 execução ligada ao conjunto e item no bloco 1' || E'\n';
  select confdeltype::text into t from pg_constraint where conrelid = 'public.revisoes'::regclass and contype = 'f' and pg_get_constraintdef(oid) like '%conjuntos%';
  rel := rel || '10 apagar o conjunto deixa a execução: ' || case when t = 'n' then 'sim (set null)' else 'NÃO ' || coalesce(t, '?') end || E'\n';
  begin
    insert into public.revisao_itens (usuario_id, revisao_id, ordem, bloco, tipo, nivel, bloom, snapshot, semente) values (a, r, 700, 6, 'multipla_escolha', 2, 2, '{}', 'x');
    rel := rel || '11 FALHOU: bloco 6 aceito' || E'\n';
  exception when check_violation then rel := rel || '11 bloco fora de 0 a 5 recusado' || E'\n';
  end;
  raise exception E'RESULTADO\n%', rel;
end;
$teste$;
