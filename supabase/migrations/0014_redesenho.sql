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
