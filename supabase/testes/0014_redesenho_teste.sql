-- Teste da migração 0014 sem deixar rastro: o bloco termina com erro de propósito e o banco desfaz tudo.
do $teste$
declare
  a uuid := gen_random_uuid();
  b uuid := gen_random_uuid();
  m uuid; e uuid; r uuid; q1 uuid; q2 uuid; k int;
  hoje date := (now() at time zone 'America/Sao_Paulo')::date;
  rel text := '';
  n int;
  t text;
  j jsonb;
begin
  execute $m$
-- 0014_redesenho.sql
-- Redesenho de outubro de 2026. Só acrescenta ou alarga regras: nenhum dado existente é apagado.
--   - perfis: saída automática por inatividade (sair_inativo_min), quem pode ler os textos novos por padrão
--     (ia_permitida_padrao) e participação no ranking (ranking_participa, só com apelido).
--   - áreas: lista com 11 áreas (entram Matemática, Negócios e gestão, Artes e design). As antigas continuam valendo.
--   - agenda_eventos: provas, trabalhos, tarefas, estudos, lembretes e compromissos de cada pessoa.
--   - agenda_revisoes(): quantas questões voltam para revisão em cada dia, por matéria.
--   - desempenho_resumo(): números da parte "Você" do Ranking (a antiga tela Desempenho).
--   - ranking_periodo(): ranking da semana, do mês ou geral, só com apelido e pontos de quem escolheu participar.

-- 1. Perfil -----------------------------------------------------------------------------------------------------------

alter table public.perfis
  add column sair_inativo_min smallint
    check (sair_inativo_min is null or sair_inativo_min in (15, 30, 60, 120, 240)),
  add column ia_permitida_padrao text not null default 'sem_treino'
    check (ia_permitida_padrao in ('nenhuma', 'sem_treino', 'todas')),
  add column ranking_participa boolean not null default false,
  add constraint perfis_ranking_com_apelido check (not ranking_participa or apelido is not null);

grant update (sair_inativo_min, ia_permitida_padrao, ranking_participa) on public.perfis to authenticated;

-- Mesma função da 0001, agora também tirando do ranking quem apaga o apelido (sem apelido não há o que mostrar).
create or replace function public.perfis_antes_de_alterar()
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
  if new.apelido is null then
    new.ranking_participa := false;
  end if;
  return new;
end;
$$;

-- 2. Áreas ------------------------------------------------------------------------------------------------------------
-- A lista nova contém todas as antigas, então nenhuma linha existente fica inválida.

alter table public.materias drop constraint if exists materias_area_check;
alter table public.materias add constraint materias_area_check
  check (area in ('matematica', 'natureza', 'humanas', 'portugues', 'idiomas', 'programacao', 'exatas', 'saude', 'direito', 'negocios', 'artes', 'outra'));

alter table public.perfis drop constraint if exists perfis_areas_interesse_check;
alter table public.perfis add constraint perfis_areas_interesse_check
  check (
    cardinality(areas_interesse) <= 11
    and areas_interesse <@ array['matematica', 'natureza', 'humanas', 'portugues', 'idiomas', 'programacao', 'exatas', 'saude', 'direito', 'negocios', 'artes']::text[]
  );

-- Mesma função da 0003, com a lista nova de áreas.
create or replace function public.criar_perfil()
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
  apelido_pedido text := left(btrim(coalesce(meta ->> 'apelido', '')), 24);
  areas text[] := '{}';
  ritmo_final text;
  objetivo_final text;
  aceite timestamptz;
begin
  if nome = '' then
    nome := 'Estudante';
  end if;
  if char_length(apelido_pedido) < 2 or apelido_pedido ~ '[[:space:][:cntrl:]]' then
    apelido_pedido := null;
  end if;
  if jsonb_typeof(meta -> 'areas_interesse') = 'array' then
    select coalesce(array_agg(distinct a), '{}') into areas
    from (
      select value as a
      from jsonb_array_elements_text(meta -> 'areas_interesse')
      where value in ('matematica', 'natureza', 'humanas', 'portugues', 'idiomas', 'programacao', 'exatas', 'saude', 'direito', 'negocios', 'artes')
      limit 11
    ) escolhidas;
  end if;
  ritmo_final := case when ritmo_pedido in ('tranquilo', 'normal', 'focado', 'obcecado') then ritmo_pedido else 'normal' end;
  objetivo_final := case when objetivo_pedido in ('enem', 'vestibular', 'concurso', 'faculdade', 'curso_tecnico', 'por_conta_propria') then objetivo_pedido end;
  aceite := case when meta ->> 'privacidade_aceita' = 'true' then now() end;

  begin
    insert into public.perfis (id, nome_exibicao, ritmo, objetivo, privacidade_aceita_em, areas_interesse, apelido)
    values (new.id, nome, ritmo_final, objetivo_final, aceite, areas, apelido_pedido);
  exception when unique_violation then
    insert into public.perfis (id, nome_exibicao, ritmo, objetivo, privacidade_aceita_em, areas_interesse)
    values (new.id, nome, ritmo_final, objetivo_final, aceite, areas);
  end;
  return new;
end;
$$;

revoke execute on function public.criar_perfil() from public, anon, authenticated;

-- 3. Agenda -----------------------------------------------------------------------------------------------------------
-- Cada linha é um item num dia. "Repetir toda semana" cria uma linha por semana com o mesmo valor em "serie",
-- para editar ou apagar todas juntas. O plano até a prova cria estudos com origem 'plano' ligados à prova
-- (plano_de): apagar a prova apaga o plano.

create table public.agenda_eventos (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  tipo text not null default 'estudo' check (tipo in ('prova', 'trabalho', 'tarefa', 'estudo', 'lembrete', 'pessoal')),
  titulo text not null check (char_length(btrim(titulo)) between 1 and 120),
  data date not null,
  hora time,
  duracao_min smallint check (duracao_min is null or duracao_min between 5 and 600),
  materia_id uuid,
  assuntos uuid[] not null default '{}' check (cardinality(assuntos) <= 30),
  notas text check (notas is null or char_length(notas) <= 2000),
  concluido_em timestamptz,
  serie uuid,
  origem text not null default 'pessoa' check (origem in ('pessoa', 'plano')),
  plano_de uuid,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  unique (id, usuario_id),
  constraint agenda_eventos_plano_tem_prova check (origem = 'pessoa' or plano_de is not null),
  foreign key (materia_id, usuario_id) references public.materias (id, usuario_id) on delete set null (materia_id),
  foreign key (plano_de, usuario_id) references public.agenda_eventos (id, usuario_id) on delete cascade
);

create index agenda_eventos_usuario_data on public.agenda_eventos (usuario_id, data);
create index agenda_eventos_materia_usuario on public.agenda_eventos (materia_id, usuario_id);
create index agenda_eventos_plano_usuario on public.agenda_eventos (plano_de, usuario_id);
create index agenda_eventos_serie on public.agenda_eventos (usuario_id, serie) where serie is not null;

create function public.agenda_eventos_antes_de_gravar()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if (select count(*) from public.agenda_eventos where usuario_id = new.usuario_id) >= 3000 then
      raise exception 'Sua agenda chegou ao limite de 3000 itens. Apague itens antigos para criar outros.' using errcode = 'P0001';
    end if;
  else
    new.atualizado_em := now();
  end if;
  new.titulo := btrim(new.titulo);
  return new;
end;
$$;

create trigger agenda_eventos_antes_de_gravar before insert or update on public.agenda_eventos
  for each row execute function public.agenda_eventos_antes_de_gravar();

alter table public.agenda_eventos enable row level security;

create policy "agenda_eventos: só do dono" on public.agenda_eventos for all to authenticated
  using ((select auth.uid()) = usuario_id)
  with check ((select auth.uid()) = usuario_id);

revoke all on public.agenda_eventos from anon, authenticated;
grant select, insert, delete on public.agenda_eventos to authenticated;
grant update (tipo, titulo, data, hora, duracao_min, materia_id, assuntos, notas, concluido_em, serie) on public.agenda_eventos to authenticated;
revoke execute on function public.agenda_eventos_antes_de_gravar() from public, anon, authenticated;

-- 4. Revisões de cada dia na agenda -----------------------------------------------------------------------------------
-- Questões que voltam para revisão (cartão FSRS) por dia e por matéria, no horário de Brasília.
-- As atrasadas contam no dia de hoje. Dias passados ficam vazios. Período de até 120 dias.

create function public.agenda_revisoes(p_inicio date, p_fim date)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  with hoje as (select (now() at time zone 'America/Sao_Paulo')::date as d),
  cartoes as (
    select greatest(c.proxima, (select d from hoje)) as dia, q.materia_id
    from public.questao_cartoes c
    join public.questoes q on q.id = c.questao_id
    where c.usuario_id = (select auth.uid()) and q.em_revisao
  ),
  no_periodo as (
    select dia, materia_id, count(*)::int as n
    from cartoes
    where dia between p_inicio and least(p_fim, p_inicio + 120)
    group by dia, materia_id
  )
  select coalesce(jsonb_agg(jsonb_build_object('dia', dia, 'total', total, 'materias', materias) order by dia), '[]'::jsonb)
  from (
    select dia, sum(n)::int as total,
      jsonb_agg(jsonb_build_object('materia_id', materia_id, 'n', n) order by n desc, materia_id) as materias
    from no_periodo
    group by dia
  ) por_dia;
$$;

revoke execute on function public.agenda_revisoes(date, date) from public, anon;
grant execute on function public.agenda_revisoes(date, date) to authenticated;

-- 5. Desempenho (parte "Você" do Ranking) -----------------------------------------------------------------------------
-- Acerto = (certas + metade das parciais) / respondidas, igual ao resumo_estudo(). Semanas = 7 dias corridos
-- terminando hoje (a última da lista é a atual). Só lê as linhas da própria pessoa (RLS).

create function public.desempenho_resumo()
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  with eu as (select (select auth.uid()) as id),
  hoje as (select (now() at time zone 'America/Sao_Paulo')::date as d),
  resp as (
    select (i.respondida_em at time zone 'America/Sao_Paulo')::date as d, i.tipo, i.nivel, i.resultado, i.materia_id, i.segundos
    from public.revisao_itens i
    where i.usuario_id = (select id from eu) and i.resultado is not null and i.respondida_em is not null
  ),
  conc as (
    select * from public.revisoes r where r.usuario_id = (select id from eu) and r.status = 'concluida'
  ),
  pts as (
    select (e.criado_em at time zone 'America/Sao_Paulo')::date as d, e.pontos
    from public.pontos_eventos e where e.usuario_id = (select id from eu)
  ),
  semanas as (
    select k, (select d from hoje) - 7 * k - 6 as inicio, (select d from hoje) - 7 * k as fim
    from generate_series(0, 7) k
  ),
  dias as (select distinct d from resp)
  select jsonb_build_object(
    'hoje', (select d from hoje),
    'por_dia', (
      select coalesce(jsonb_agg(jsonb_build_object('data', g.d::date, 'n', coalesce(c.n, 0)) order by g.d), '[]'::jsonb)
      from generate_series(((select d from hoje) - 111)::timestamp, (select d from hoje)::timestamp, interval '1 day') g(d)
      left join (select d, count(*)::int as n from resp group by d) c on c.d = g.d::date
    ),
    'semanas', (
      select jsonb_agg(jsonb_build_object(
        'inicio', s.inicio,
        'fim', s.fim,
        'respondidas', (select count(*) from resp r where r.d between s.inicio and s.fim),
        'acerto', (select round(100.0 * (count(*) filter (where r.resultado = 'correta') + 0.5 * count(*) filter (where r.resultado = 'parcial')) / nullif(count(*), 0))
                   from resp r where r.d between s.inicio and s.fim),
        'pontos', (select coalesce(sum(p.pontos), 0) from pts p where p.d between s.inicio and s.fim),
        'minutos', (select coalesce(sum(r.segundos), 0) / 60 from resp r where r.d between s.inicio and s.fim)
      ) order by s.k desc)
      from semanas s
    ),
    'por_tipo', (
      select coalesce(jsonb_agg(jsonb_build_object('tipo', tipo, 'total', total, 'certas', certas, 'parciais', parciais,
        'acerto', round(100.0 * (certas + 0.5 * parciais) / total)) order by total desc, tipo), '[]'::jsonb)
      from (
        select tipo, count(*)::int as total, (count(*) filter (where resultado = 'correta'))::int as certas,
          (count(*) filter (where resultado = 'parcial'))::int as parciais
        from resp group by tipo
      ) t
    ),
    'por_nivel', (
      select coalesce(jsonb_agg(jsonb_build_object('nivel', nivel, 'total', total, 'certas', certas, 'parciais', parciais,
        'acerto', round(100.0 * (certas + 0.5 * parciais) / total)) order by nivel), '[]'::jsonb)
      from (
        select nivel, count(*)::int as total, (count(*) filter (where resultado = 'correta'))::int as certas,
          (count(*) filter (where resultado = 'parcial'))::int as parciais
        from resp group by nivel
      ) t
    ),
    'por_materia', (
      select coalesce(jsonb_agg(jsonb_build_object('materia_id', x.materia_id, 'nome', m.nome, 'cor', m.cor,
        'total', x.total, 'acerto', x.acerto, 'recentes', x.recentes, 'acerto_recente', x.acerto_recente) order by x.total desc, m.nome), '[]'::jsonb)
      from (
        select materia_id,
          count(*)::int as total,
          round(100.0 * (count(*) filter (where resultado = 'correta') + 0.5 * count(*) filter (where resultado = 'parcial')) / count(*)) as acerto,
          (count(*) filter (where d > (select d from hoje) - 30))::int as recentes,
          round(100.0 * (count(*) filter (where resultado = 'correta' and d > (select d from hoje) - 30)
            + 0.5 * count(*) filter (where resultado = 'parcial' and d > (select d from hoje) - 30))
            / nullif(count(*) filter (where d > (select d from hoje) - 30), 0)) as acerto_recente
        from resp where materia_id is not null group by materia_id
      ) x
      join public.materias m on m.id = x.materia_id
    ),
    'sessoes', (
      select coalesce(jsonb_agg(to_jsonb(s) order by s.concluida_em), '[]'::jsonb)
      from (
        select id, titulo, total, respondidas, certas, parciais, erradas, pontos, segundos, concluida_em,
          round(100.0 * (certas + 0.5 * parciais) / greatest(respondidas, 1)) as acerto
        from conc order by concluida_em desc nulls last limit 12
      ) s
    ),
    'proficiencias', (
      select coalesce(jsonb_object_agg(estado, n), '{}'::jsonb)
      from (select estado, count(*)::int as n from public.proficiencias p where p.usuario_id = (select id from eu) group by estado) x
    ),
    'totais', jsonb_build_object(
      'respondidas', (select count(*) from resp),
      'acerto', (select round(100.0 * (count(*) filter (where resultado = 'correta') + 0.5 * count(*) filter (where resultado = 'parcial')) / nullif(count(*), 0)) from resp),
      'dias_estudados', (select count(*) from dias),
      'melhor_sequencia', (
        select coalesce(max(n), 0) from (
          select count(*) as n from (select d, d - (row_number() over (order by d))::int as grupo from dias) x group by grupo
        ) y
      ),
      'minutos', (select coalesce(sum(segundos), 0) / 60 from resp),
      'sessoes', (select count(*) from conc),
      'pontos', (select coalesce(sum(pontos), 0) from pts)
    )
  );
$$;

revoke execute on function public.desempenho_resumo() from public, anon;
grant execute on function public.desempenho_resumo() to authenticated;

-- 6. Ranking ----------------------------------------------------------------------------------------------------------
-- Roda com permissão do dono da função porque soma pontos de outras contas. Por isso devolve só apelido e pontos,
-- e só de quem ligou "Participar do ranking". Abre depois de 3 estudos concluídos com 5 questões ou mais
-- (mesma regra de shared/regras/desbloqueios.js). Semana começa na segunda-feira, horário de Brasília.

create function public.ranking_periodo(p_periodo text default 'semana')
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_eu uuid := (select auth.uid());
  v_agora timestamp := now() at time zone 'America/Sao_Paulo';
  v_inicio timestamptz;
  v_liberado boolean;
  v_participa boolean;
  v_resultado jsonb;
begin
  if v_eu is null then
    raise exception 'Entre na sua conta para ver o ranking.' using errcode = '42501';
  end if;
  if p_periodo is null or p_periodo not in ('semana', 'mes', 'geral') then
    raise exception 'Período inválido. Use semana, mes ou geral.' using errcode = '22023';
  end if;

  select count(*) >= 3 into v_liberado
  from public.revisoes r
  where r.usuario_id = v_eu and r.status = 'concluida' and r.respondidas >= 5;

  select coalesce(p.ranking_participa, false) into v_participa from public.perfis p where p.id = v_eu;
  v_participa := coalesce(v_participa, false);

  if not v_liberado then
    return jsonb_build_object('liberado', false, 'participa', v_participa, 'periodo', p_periodo);
  end if;

  v_inicio := case p_periodo
    when 'semana' then date_trunc('week', v_agora) at time zone 'America/Sao_Paulo'
    when 'mes' then date_trunc('month', v_agora) at time zone 'America/Sao_Paulo'
    else '-infinity'::timestamptz
  end;

  with soma as (
    select p.id, p.apelido, coalesce(sum(e.pontos), 0)::int as pontos
    from public.perfis p
    left join public.pontos_eventos e on e.usuario_id = p.id and e.criado_em >= v_inicio
    where p.ranking_participa and p.apelido is not null
    group by p.id, p.apelido
  ),
  posicoes as (
    select id, apelido, pontos, rank() over (order by pontos desc) as posicao from soma
  )
  select jsonb_build_object(
    'liberado', true,
    'participa', v_participa,
    'periodo', p_periodo,
    'inicio', case when p_periodo = 'geral' then null else v_inicio end,
    'participantes', (select count(*) from posicoes),
    'lista', (
      select coalesce(jsonb_agg(jsonb_build_object('posicao', t.posicao, 'apelido', t.apelido, 'pontos', t.pontos, 'eu', t.id = v_eu)
        order by t.posicao, lower(t.apelido)), '[]'::jsonb)
      from (select * from posicoes order by posicao, lower(apelido) limit 50) t
    ),
    'eu', jsonb_build_object(
      'posicao', (select posicao from posicoes where id = v_eu),
      'pontos', (select coalesce(sum(e.pontos), 0)::int from public.pontos_eventos e where e.usuario_id = v_eu and e.criado_em >= v_inicio)
    )
  ) into v_resultado;

  return v_resultado;
end;
$$;

revoke execute on function public.ranking_periodo(text) from public, anon;
grant execute on function public.ranking_periodo(text) to authenticated;

-- DESFAZER (apaga a agenda de todo mundo; só com backup e confirmação):
-- drop function if exists public.ranking_periodo(text);
-- drop function if exists public.desempenho_resumo();
-- drop function if exists public.agenda_revisoes(date, date);
-- drop table if exists public.agenda_eventos;
-- drop function if exists public.agenda_eventos_antes_de_gravar();
-- rode de novo o "create or replace function public.criar_perfil()" da 0003 e o "public.perfis_antes_de_alterar()" da 0001
-- (as áreas novas já gravadas impedem voltar a regra antiga das áreas; troque-as antes por 'outra' ou por uma antiga)
-- alter table public.perfis drop constraint if exists perfis_ranking_com_apelido,
--   drop column if exists ranking_participa, drop column if exists ia_permitida_padrao, drop column if exists sair_inativo_min;
$m$;
  insert into auth.users (id, email, aud, role, raw_user_meta_data) values
    (a, 'a@teste.pgc', 'authenticated', 'authenticated', '{"nome_exibicao":"Ana","areas_interesse":["matematica","artes","invalida","matematica"]}'),
    (b, 'b@teste.pgc', 'authenticated', 'authenticated', '{"nome_exibicao":"Bia","apelido":"bia.b"}');
  select array_to_string(areas_interesse, ',') || ' | ' || coalesce(sair_inativo_min::text, 'nulo') || ' | ' || ia_permitida_padrao || ' | ' || ranking_participa::text
    into t from public.perfis where id = a;
  rel := rel || '1 perfil novo (áreas novas, padrões): ' || t || E'\n';

  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  update public.perfis set sair_inativo_min = 30, ia_permitida_padrao = 'nenhuma' where id = a;
  select sair_inativo_min || ' ' || ia_permitida_padrao into t from public.perfis where id = a;
  rel := rel || '2 grava saída e privacidade: ' || t || E'\n';
  begin
    update public.perfis set sair_inativo_min = 45 where id = a;
    rel := rel || '3 FALHOU: 45 minutos aceito' || E'\n';
  exception when check_violation then rel := rel || '3 45 minutos recusado' || E'\n';
  end;
  update public.perfis set ranking_participa = true where id = a;
  select ranking_participa::text into t from public.perfis where id = a;
  rel := rel || '4 sem apelido não participa: ' || t || ' (esperado false)' || E'\n';
  update public.perfis set apelido = 'ana.estuda', ranking_participa = true where id = a;
  select ranking_participa::text into t from public.perfis where id = a;
  rel := rel || '5 com apelido participa: ' || t || E'\n';
  update public.perfis set apelido = null where id = a;
  select ranking_participa::text into t from public.perfis where id = a;
  rel := rel || '6 apagar o apelido tira do ranking: ' || t || ' (esperado false)' || E'\n';
  update public.perfis set apelido = 'ana.estuda', ranking_participa = true, areas_interesse = array['negocios','exatas'] where id = a;

  insert into public.materias (nome, area) values ('Matemática', 'matematica') returning id into m;
  rel := rel || '7 matéria com área nova criada' || E'\n';
  begin
    insert into public.materias (nome, area) values ('Errada', 'astrologia');
    rel := rel || '8 FALHOU: área inválida aceita' || E'\n';
  exception when check_violation then rel := rel || '8 área inválida recusada' || E'\n';
  end;

  insert into public.agenda_eventos (tipo, titulo, data, materia_id) values ('prova', '  Prova de funções ', hoje + 10, m) returning id, titulo into e, t;
  rel := rel || '9 evento criado e aparado: [' || t || ']' || E'\n';
  insert into public.agenda_eventos (tipo, titulo, data, materia_id, origem, plano_de)
    select 'estudo', 'Estudar funções', hoje + g, m, 'plano', e from generate_series(1, 3) g;
  select count(*) into n from public.agenda_eventos where plano_de = e;
  rel := rel || '10 plano com ' || n || ' estudos' || E'\n';
  begin
    insert into public.agenda_eventos (titulo, data, origem) values ('Plano solto', hoje, 'plano');
    rel := rel || '11 FALHOU: plano sem prova aceito' || E'\n';
  exception when check_violation then rel := rel || '11 plano sem prova recusado' || E'\n';
  end;
  begin
    insert into public.agenda_eventos (usuario_id, titulo, data) values (b, 'Na agenda da Bia', hoje);
    rel := rel || '12 FALHOU: criou na agenda de outra pessoa' || E'\n';
  exception when insufficient_privilege then rel := rel || '12 não cria na agenda de outra pessoa' || E'\n';
  end;
  begin
    update public.agenda_eventos set origem = 'pessoa' where id = e;
    rel := rel || '13 FALHOU: mudou a origem' || E'\n';
  exception when insufficient_privilege then rel := rel || '13 origem não muda pela API' || E'\n';
  end;
  update public.agenda_eventos set concluido_em = now(), titulo = 'Prova de funções e gráficos' where id = e;
  rel := rel || '14 marcou como feito e renomeou' || E'\n';

  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  select count(*) into n from public.agenda_eventos;
  rel := rel || '15 Bia vê ' || n || ' itens da agenda da Ana (esperado 0)' || E'\n';
  delete from public.agenda_eventos where id = e;
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  select count(*) into n from public.agenda_eventos;
  rel := rel || '16 depois da tentativa da Bia, Ana tem ' || n || ' itens (esperado 4)' || E'\n';
  delete from public.agenda_eventos where id = e;
  select count(*) into n from public.agenda_eventos;
  rel := rel || '17 apagar a prova apaga o plano: sobraram ' || n || ' (esperado 0)' || E'\n';
  insert into public.agenda_eventos (tipo, titulo, data, materia_id) values ('trabalho', 'Lista de funções', hoje + 2, m) returning id into e;

  execute 'reset role';
  insert into public.questoes (usuario_id, materia_id, tipo, enunciado, origem) values (a, m, 'multipla_escolha', 'Quanto é 2 + 2?', 'minha') returning id into q1;
  insert into public.questoes (usuario_id, materia_id, tipo, enunciado, origem) values (a, m, 'multipla_escolha', 'Quanto é 3 + 3?', 'minha') returning id into q2;
  insert into public.questao_cartoes (questao_id, usuario_id, estabilidade, dificuldade, ultimo_dia, proxima) values
    (q1, a, 2, 5, 0, hoje - 2), (q2, a, 2, 5, 0, hoje + 3);
  for k in 1..3 loop
    insert into public.revisoes (usuario_id, modelo, titulo, total, respondidas, certas, parciais, erradas, pontos, status, concluida_em)
    values (a, 'personalizada', 'Estudo ' || k, 6, 6, 4, 1, 1, 50, 'concluida', now() - make_interval(days => k)) returning id into r;
    insert into public.revisao_itens (usuario_id, revisao_id, ordem, tipo, nivel, bloom, snapshot, semente, resultado, materia_id, respondida_em, segundos)
    select a, r, g, case when g % 2 = 0 then 'multipla_escolha' else 'verdadeiro_falso' end, 1 + g % 3, 2, '{}', 'x',
      case when g <= 4 then 'correta' when g = 5 then 'parcial' else 'incorreta' end, m, now() - make_interval(days => k), 40
    from generate_series(1, 6) g;
  end loop;
  insert into public.pontos_eventos (usuario_id, motivo, pontos) values (a, 'teste', 120), (b, 'teste', 300);
  update public.perfis set ranking_participa = true where id = b;

  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  j := public.agenda_revisoes(hoje - 5, hoje + 7);
  rel := rel || '18 revisões na agenda: ' || j::text || E'\n';
  j := public.desempenho_resumo();
  rel := rel || '19 desempenho: respondidas ' || (j -> 'totais' ->> 'respondidas') || ', acerto ' || (j -> 'totais' ->> 'acerto')
    || ', dias ' || (j -> 'totais' ->> 'dias_estudados') || ', sequência ' || (j -> 'totais' ->> 'melhor_sequencia')
    || ', por_dia ' || jsonb_array_length(j -> 'por_dia') || ', semanas ' || jsonb_array_length(j -> 'semanas')
    || ', tipos ' || jsonb_array_length(j -> 'por_tipo') || ', matérias ' || (j -> 'por_materia' -> 0 ->> 'nome') || ' ' || (j -> 'por_materia' -> 0 ->> 'acerto')
    || ', sessões ' || jsonb_array_length(j -> 'sessoes') || E'\n';
  j := public.ranking_periodo('semana');
  rel := rel || '20 ranking da semana: ' || j::text || E'\n';

  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  j := public.ranking_periodo('geral');
  rel := rel || '21 Bia ainda travada: ' || j::text || E'\n';
  j := public.desempenho_resumo();
  rel := rel || '22 Bia não vê o desempenho da Ana: respondidas ' || (j -> 'totais' ->> 'respondidas') || E'\n';
  begin
    j := public.ranking_periodo('ano');
    rel := rel || '23 FALHOU: período inválido aceito' || E'\n';
  exception when sqlstate '22023' then rel := rel || '23 período inválido recusado' || E'\n';
  end;
  execute 'reset role';
  execute 'set local role anon';
  begin
    j := public.ranking_periodo('semana');
    rel := rel || '24 FALHOU: visitante leu o ranking' || E'\n';
  exception when insufficient_privilege then rel := rel || '24 visitante não lê o ranking' || E'\n';
  end;
  begin
    perform count(*) from public.agenda_eventos;
    rel := rel || '25 FALHOU: visitante leu a agenda' || E'\n';
  exception when insufficient_privilege then rel := rel || '25 visitante não lê a agenda' || E'\n';
  end;
  execute 'reset role';
  delete from public.materias where id = m;
  select count(*) into n from public.agenda_eventos where id = e and materia_id is null;
  rel := rel || '26 matéria apagada, o trabalho fica na agenda sem matéria: ' || n || ' (esperado 1)' || E'\n';
  raise exception E'RESULTADO\n%', rel;
end;
$teste$;
