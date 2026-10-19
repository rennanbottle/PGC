-- Teste da migração 0012 sem deixar rastro: o bloco termina com erro de propósito e o banco desfaz tudo.
do $teste$
declare
  a uuid := gen_random_uuid();
  ma uuid;
  rel text := '';
  n int;
begin
  execute $m$
-- Ajustes da matriz de rastreabilidade (06/10).
--   - Cota de IA do PGC: 30 operações de estudo por conta e por dia (antes 10). A geração pela outra IA
--     (modo externa) continua fora da conta, porque não chama serviço do PGC.
--   - Pausa guarda o rascunho: o que estava escrito numa questão ainda não enviada. O rascunho não é corrigido
--     e some quando a resposta é enviada. Só o servidor escreve, como no resto da revisão.

alter table public.revisao_itens add column rascunho jsonb
  check (rascunho is null or (jsonb_typeof(rascunho) = 'object' and pg_column_size(rascunho) <= 8000));

create or replace function public.ia_geracoes_antes_de_inserir()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.modo <> 'externa' and (select count(*) from public.ia_geracoes
      where usuario_id = new.usuario_id and status <> 'falhou' and modo <> 'externa'
        and (criado_em at time zone 'America/Sao_Paulo')::date = (now() at time zone 'America/Sao_Paulo')::date) >= 30 then
    raise exception 'Você já fez as 30 operações com IA de hoje. Amanhã libera de novo; enquanto isso, a geração sem IA e a outra IA continuam abertas.' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create or replace function public.ia_minha_cota()
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select jsonb_build_object(
    'usadas', (select count(*) from public.ia_geracoes
      where usuario_id = (select auth.uid()) and status <> 'falhou' and modo <> 'externa'
        and (criado_em at time zone 'America/Sao_Paulo')::date = (now() at time zone 'America/Sao_Paulo')::date),
    'limite', 30
  );
$$;
$m$;
  insert into auth.users (id, email, aud, role) values (a, 'a@teste.pgc', 'authenticated', 'authenticated');
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  insert into public.materias (nome) values ('Física') returning id into ma;
  for i in 1..30 loop
    insert into public.ia_geracoes (materia_id, status) values (ma, 'concluida');
  end loop;
  rel := rel || '1 trinta operações aceitas' || E'\n';
  begin
    insert into public.ia_geracoes (materia_id) values (ma);
    rel := rel || '2 FALHOU: 31ª passou' || E'\n';
  exception when sqlstate 'P0001' then rel := rel || '2 31ª recusada' || E'\n';
  end;
  insert into public.ia_geracoes (materia_id, modo, status) values (ma, 'externa', 'concluida');
  rel := rel || '3 externa passa com o limite cheio' || E'\n';
  select (public.ia_minha_cota()->>'limite')::int into n;
  rel := rel || '4 limite: ' || n || ' (esperado 30)' || E'\n';
  perform 1 from public.revisao_itens where rascunho is not null;
  rel := rel || '5 coluna rascunho existe e a pessoa lê' || E'\n';
  begin
    update public.revisao_itens set rascunho = '{}'::jsonb where false;
    rel := rel || '6 FALHOU: a pessoa escreveu rascunho' || E'\n';
  exception when insufficient_privilege then rel := rel || '6 só o servidor escreve rascunho' || E'\n';
  end;
  raise exception E'RESULTADO\n%', rel;
end;
$teste$;
