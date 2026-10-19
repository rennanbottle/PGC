-- Teste da migração 0018 sem deixar rastro: o bloco termina com erro de propósito e o banco desfaz tudo.
do $teste$
declare
  a uuid := gen_random_uuid();
  b uuid := gen_random_uuid();
  r uuid; p uuid;
  rel text := '';
  n int;
  t text;
  j jsonb;
begin
  execute $m$
-- 0018_provas.sql
-- A Prova (simulado). Usa a mesma execução do estudo (revisoes e revisao_itens), com o que muda:
--   - revisoes.tipo: 'estudo' (padrão: tudo o que já existe continua igual) ou 'prova';
--   - revisoes.prova: a configuração da prova (formato, minutos, relógio, ordem, assuntos com peso, assuntos fracos);
--   - revisoes.termina_em: quando o tempo acaba (o relógio corre mesmo com a tela fechada);
--   - revisoes.entregue_por_tempo: a prova foi entregue sozinha porque o tempo acabou.
-- Uma prova tem até 60 questões, o mesmo limite de um estudo (revisoes.total).
-- Durante a prova as respostas ficam em revisao_itens.rascunho (0012) e nada é corrigido. Ao entregar, o servidor
-- corrige tudo de uma vez com a chave secreta, como no estudo (dificuldade da questão, cartão FSRS, proficiência,
-- pontos).
-- resumo_estudo(): o estudo em andamento e o acerto dos últimos estudos deixam as provas de fora; a prova em
-- andamento aparece à parte (prova_em_andamento). As provas entregues contam como estudos concluídos para os
-- desbloqueios, e as respostas delas contam como respostas.
-- Só acrescenta: nenhum dado nem regra existente é apagado.

alter table public.revisoes
  add column tipo text not null default 'estudo' check (tipo in ('estudo', 'prova')),
  add column prova jsonb check (prova is null or (jsonb_typeof(prova) = 'object' and pg_column_size(prova) <= 8000)),
  add column termina_em timestamptz,
  add column entregue_por_tempo boolean not null default false;

-- Toda prova tem a configuração e o fim do tempo.
alter table public.revisoes add constraint revisoes_prova_completa check (tipo = 'estudo' or (prova is not null and termina_em is not null));

create index revisoes_por_tipo on public.revisoes (usuario_id, tipo, criado_em desc);

create or replace function public.resumo_estudo()
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  with eu as (select (select auth.uid()) as id),
  hoje as (select (now() at time zone 'America/Sao_Paulo')::date as d),
  resp as (
    select (i.respondida_em at time zone 'America/Sao_Paulo')::date as d, i.tipo, i.resultado, i.questao_id, i.assunto_id, i.respondida_em
    from public.revisao_itens i where i.usuario_id = (select id from eu) and i.resultado is not null
  ),
  dias as (select distinct d from resp),
  inicio as (select case when exists (select 1 from dias where d = (select d from hoje)) then (select d from hoje) else (select d from hoje) - 1 end as d),
  seguidos as (
    select count(*) as n from (
      select d, row_number() over (order by d desc) - 1 as k from dias where d <= (select d from inicio)
    ) x
    where x.d = (select d from inicio) - x.k::int
  ),
  conc as (select * from public.revisoes r where r.usuario_id = (select id from eu) and r.status = 'concluida')
  select jsonb_build_object(
    'hoje', (select count(*) from resp where d = (select d from hoje)),
    'dias_seguidos', (select n from seguidos),
    'por_dia', (select coalesce(jsonb_agg(coalesce(c.n, 0) order by g.d), '[]') from generate_series(((select d from hoje) - 13)::timestamp, (select d from hoje)::timestamp, interval '1 day') g(d)
      left join (select d, count(*) as n from resp group by d) c on c.d = g.d::date),
    'semana', (select count(*) from resp where d > (select d from hoje) - 7),
    'semana_anterior', (select count(*) from resp where d <= (select d from hoje) - 7 and d > (select d from hoje) - 14),
    'respondidas', (select count(*) from resp),
    'tipos_usados', (select count(distinct tipo) from resp),
    'revisoes_concluidas', (select count(*) from conc),
    'revisoes_com5', (select count(*) from conc where respondidas >= 5),
    'revisoes_com10', (select count(*) from conc where respondidas >= 10),
    'proficientes', (select count(*) from public.proficiencias p where p.usuario_id = (select id from eu) and p.estado in ('proficiente', 'pronto_para_prova', 'dominado')),
    'dominados', (select count(*) from public.proficiencias p where p.usuario_id = (select id from eu) and p.estado = 'dominado'),
    'pontos', (select coalesce(sum(pontos), 0) from public.pontos_eventos e where e.usuario_id = (select id from eu)),
    'pontos_hoje', (select coalesce(sum(pontos), 0) from public.pontos_eventos e where e.usuario_id = (select id from eu) and (e.criado_em at time zone 'America/Sao_Paulo')::date = (select d from hoje)),
    'vencidas', (select count(*) from public.questao_cartoes c join public.questoes q on q.id = c.questao_id
      where c.usuario_id = (select id from eu) and c.proxima <= (select d from hoje) and q.em_revisao),
    'erros_14', (select count(distinct questao_id) from resp where resultado = 'incorreta' and d > (select d from hoje) - 14),
    'acerto_ultimas', (select coalesce(jsonb_agg(p order by criado_em), '[]') from (
      select round(100.0 * (certas + 0.5 * parciais) / greatest(respondidas, 1)) as p, criado_em from conc
      where respondidas > 0 and tipo = 'estudo' order by criado_em desc limit 8) u),
    'em_andamento', (select to_jsonb(x) from (
      select id, titulo, total, respondidas, status, pausada_em, atualizado_em from public.revisoes r
      where r.usuario_id = (select id from eu) and r.tipo = 'estudo' and r.status in ('em_andamento', 'pausada') order by atualizado_em desc limit 1) x),
    'prova_em_andamento', (select to_jsonb(x) from (
      select id, titulo, total, termina_em, atualizado_em from public.revisoes r
      where r.usuario_id = (select id from eu) and r.tipo = 'prova' and r.status = 'em_andamento' order by atualizado_em desc limit 1) x)
  );
$$;

revoke execute on function public.resumo_estudo() from public, anon;
grant execute on function public.resumo_estudo() to authenticated;

-- DESFAZER (apaga as provas; só com aprovação):
-- delete from public.revisoes where tipo = 'prova';
-- drop index public.revisoes_por_tipo;
-- alter table public.revisoes drop constraint revisoes_prova_completa;
-- alter table public.revisoes drop column entregue_por_tempo, drop column termina_em, drop column prova, drop column tipo;
-- e recriar resumo_estudo() como em 0011_revisoes.sql.
$m$;
  insert into auth.users (id, email, aud, role) values (a, 'a@teste.pgc', 'authenticated', 'authenticated'), (b, 'b@teste.pgc', 'authenticated', 'authenticated');
  insert into public.revisoes (usuario_id, modelo, titulo, total, status) values (a, 'personalizada', 'Estudo aberto', 5, 'em_andamento') returning id into r;
  select tipo into t from public.revisoes where id = r;
  rel := rel || '1 execução sem tipo vira: ' || t || E'\n';
  begin
    insert into public.revisoes (usuario_id, modelo, titulo, total, tipo) values (a, 'personalizada', 'Prova sem tempo', 10, 'prova');
    rel := rel || '2 FALHOU: prova sem configuração e sem fim' || E'\n';
  exception when check_violation then rel := rel || '2 prova sem configuração recusada' || E'\n';
  end;
  insert into public.revisoes (usuario_id, modelo, titulo, total, tipo, prova, termina_em, status)
    values (a, 'personalizada', 'Simulado ENEM', 60, 'prova', '{"formato":"enem","minutos":180}', now() + interval '3 hours', 'em_andamento') returning id into p;
  rel := rel || '3 prova com 60 questões aceita' || E'\n';
  begin
    insert into public.revisoes (usuario_id, modelo, titulo, total, tipo, prova, termina_em) values (a, 'personalizada', 'Grande demais', 61, 'prova', '{}', now());
    rel := rel || '4 FALHOU: 61 questões' || E'\n';
  exception when check_violation then rel := rel || '4 sessenta e uma recusadas' || E'\n';
  end;
  insert into public.revisoes (usuario_id, modelo, titulo, total, tipo, prova, termina_em, status, respondidas, certas)
    values (a, 'personalizada', 'Prova entregue', 10, 'prova', '{}', now(), 'concluida', 10, 2);
  insert into public.revisoes (usuario_id, modelo, titulo, total, status, respondidas, certas)
    values (a, 'personalizada', 'Estudo feito', 10, 'concluida', 10, 9);
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  j := public.resumo_estudo();
  rel := rel || '5 em andamento: ' || coalesce(j->'em_andamento'->>'titulo', 'nenhum') || E'\n';
  rel := rel || '6 prova em andamento: ' || coalesce(j->'prova_em_andamento'->>'titulo', 'nenhuma') || E'\n';
  rel := rel || '7 acerto dos últimos estudos: ' || (j->'acerto_ultimas')::text || ' (só o estudo, 90)' || E'\n';
  rel := rel || '8 concluídos para desbloqueio: ' || (j->>'revisoes_concluidas') || ' (prova conta, 2)' || E'\n';
  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  select count(*) into n from public.revisoes where id = p;
  rel := rel || '9 B vê ' || n || ' provas de A (esperado 0)' || E'\n';
  j := public.resumo_estudo();
  rel := rel || '10 resumo de B sem a prova de A: ' || case when j->'prova_em_andamento' is null or j->'prova_em_andamento' = 'null'::jsonb then 'sim' else 'NÃO' end || E'\n';
  begin
    update public.revisoes set tipo = 'estudo' where false;
    rel := rel || '11 FALHOU: a pessoa escreve em revisoes' || E'\n';
  exception when insufficient_privilege then rel := rel || '11 revisoes continua só leitura' || E'\n';
  end;
  raise exception E'RESULTADO\n%', rel;
end;
$teste$;
