-- Teste da migração 0010 sem deixar rastro: o bloco termina com erro de propósito e o banco desfaz tudo.
do $teste$
declare
  a uuid := gen_random_uuid();
  ma uuid;
  g uuid;
  rel text := '';
  n int;
begin
  execute $m$
-- Etapa 6b: jeitos de gerar.
--   - ia_geracoes ganha "modo": ia (IA do PGC), misto (sem IA primeiro, a IA completa) e externa (a pessoa
--     cola a resposta de outra IA). A externa não chama serviço do PGC, então não conta no limite do dia.
--   - Uma geração concluída não volta atrás e o modo não muda depois de criado. Antes dava para marcar uma
--     geração concluída como "falhou" e liberar a cota do dia.

alter table public.ia_geracoes add column modo text not null default 'ia' check (modo in ('ia', 'misto', 'externa'));

create or replace function public.ia_geracoes_antes_de_inserir()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.modo <> 'externa' and (select count(*) from public.ia_geracoes
      where usuario_id = new.usuario_id and status <> 'falhou' and modo <> 'externa'
        and (criado_em at time zone 'America/Sao_Paulo')::date = (now() at time zone 'America/Sao_Paulo')::date) >= 10 then
    raise exception 'Você já fez as 10 gerações com IA de hoje. Amanhã libera de novo; enquanto isso, a geração sem IA e a outra IA continuam abertas.' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create function public.ia_geracoes_antes_de_atualizar()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.modo is distinct from old.modo then
    raise exception 'O jeito da geração não muda depois de criada.' using errcode = 'P0001';
  end if;
  if old.status = 'concluida' and new.status <> 'concluida' then
    raise exception 'Uma geração concluída não volta atrás.' using errcode = 'P0001';
  end if;
  return new;
end;
$$;
create trigger ia_geracoes_antes_de_atualizar before update on public.ia_geracoes
  for each row execute function public.ia_geracoes_antes_de_atualizar();

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
    'limite', 10
  );
$$;

revoke execute on function public.ia_geracoes_antes_de_atualizar() from public, anon, authenticated;

  $m$;
  insert into auth.users (id, email, aud, role) values (a, 'a@teste.pgc', 'authenticated', 'authenticated');
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  insert into public.materias (nome) values ('Física') returning id into ma;

  for i in 1..10 loop
    insert into public.ia_geracoes (materia_id, status) values (ma, 'concluida');
  end loop;
  begin
    insert into public.ia_geracoes (materia_id) values (ma);
    rel := rel || '1 FALHOU: 11ª geração passou' || E'\n';
  exception when sqlstate 'P0001' then rel := rel || '1 11ª geração recusada' || E'\n';
  end;
  insert into public.ia_geracoes (materia_id, modo, status) values (ma, 'externa', 'concluida') returning id into g;
  rel := rel || '2 externa passa mesmo com o limite cheio' || E'\n';
  select (public.ia_minha_cota()->>'usadas')::int into n;
  rel := rel || '3 cota usada: ' || n || ' (esperado 10)' || E'\n';
  begin
    update public.ia_geracoes set status = 'falhou' where materia_id = ma and modo = 'ia';
    rel := rel || '4 FALHOU: concluída voltou para falhou' || E'\n';
  exception when sqlstate 'P0001' then rel := rel || '4 concluída não volta atrás' || E'\n';
  end;
  begin
    update public.ia_geracoes set modo = 'ia' where id = g;
    rel := rel || '5 FALHOU: modo mudou' || E'\n';
  exception when sqlstate 'P0001' then rel := rel || '5 modo não muda' || E'\n';
  end;
  raise exception E'RESULTADO\n%', rel;
end;
$teste$;
