-- Teste da migração 0011 sem deixar rastro: o bloco termina com erro de propósito e o banco desfaz tudo.
do $teste$
declare
  a uuid := gen_random_uuid();
  b uuid := gen_random_uuid();
  ma uuid; sa uuid; q1 uuid; rv uuid;
  rel text := '';
  n int;
  r jsonb;
begin
  execute $m$
-- Etapa 7: revisões.
--   - revisoes: cada sessão, com a configuração, o andamento, o resumo e os pontos.
--   - revisao_itens: cada questão da sessão, com a questão congelada (o resultado não muda se a questão for editada
--     depois), a semente do embaralhamento, a resposta, a correção, dicas, "não tenho certeza" e pontos.
--   - questao_cartoes: repetição espaçada (FSRS) de cada questão: quando ela volta.
--   - proficiencias: estado de cada assunto, recalculado pelo servidor depois de cada revisão.
--   - pontos_eventos: cada ponto ganho, com o motivo.
-- A pessoa só LÊ estas tabelas. Quem escreve é o servidor, com a chave secreta, depois de corrigir: assim ninguém
-- marca a própria resposta como certa nem inventa pontos (o ranking depende disso).

create table public.revisoes (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references auth.users (id) on delete cascade,
  modelo text not null check (modelo in ('revisao_do_dia', 'reforco_erros', 'estudo_serio', 'rapida', 'desafio', 'intercalada', 'pre_prova', 'personalizada')),
  titulo text not null check (char_length(titulo) between 1 and 120),
  config jsonb not null default '{}' check (jsonb_typeof(config) = 'object' and pg_column_size(config) <= 16000),
  status text not null default 'em_andamento' check (status in ('em_andamento', 'pausada', 'concluida')),
  encerrada_antes boolean not null default false,
  agendada boolean not null default false,
  total integer not null check (total between 1 and 60),
  respondidas integer not null default 0,
  certas integer not null default 0,
  parciais integer not null default 0,
  erradas integer not null default 0,
  incertas integer not null default 0,
  pontos integer not null default 0,
  pontos_detalhe jsonb not null default '[]' check (jsonb_typeof(pontos_detalhe) = 'array'),
  resultado jsonb not null default '{}' check (jsonb_typeof(resultado) = 'object' and pg_column_size(resultado) <= 40000),
  segundos integer not null default 0 check (segundos >= 0),
  atual integer not null default 0,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  pausada_em timestamptz,
  concluida_em timestamptz,
  unique (id, usuario_id)
);

create table public.revisao_itens (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references auth.users (id) on delete cascade,
  revisao_id uuid not null,
  ordem integer not null check (ordem >= 0),
  questao_id uuid,
  assunto_id uuid,
  materia_id uuid,
  tipo text not null,
  nivel smallint not null check (nivel between 1 and 5),
  bloom smallint not null check (bloom between 1 and 6),
  snapshot jsonb not null check (jsonb_typeof(snapshot) = 'object' and pg_column_size(snapshot) <= 60000),
  semente text not null,
  nivel_mostrado smallint check (nivel_mostrado is null or nivel_mostrado between 1 and 5),
  resposta jsonb,
  resultado text check (resultado is null or resultado in ('correta', 'parcial', 'incorreta')),
  credito numeric(4, 3),
  confianca text check (confianca is null or confianca in ('alta', 'baixa')),
  pendente boolean not null default false,
  dicas_usadas smallint not null default 0 check (dicas_usadas between 0 and 3),
  incerta boolean not null default false,
  marcada boolean not null default false,
  previsto numeric(4, 3),
  retencao_antes numeric(4, 3),
  recente boolean not null default false,
  pontos integer not null default 0,
  leu_correcao boolean not null default false,
  segundos integer not null default 0 check (segundos >= 0),
  respondida_em timestamptz,
  unique (revisao_id, ordem),
  foreign key (revisao_id, usuario_id) references public.revisoes (id, usuario_id) on delete cascade,
  foreign key (questao_id, usuario_id) references public.questoes (id, usuario_id) on delete set null (questao_id),
  foreign key (assunto_id, usuario_id) references public.assuntos (id, usuario_id) on delete set null (assunto_id),
  foreign key (materia_id, usuario_id) references public.materias (id, usuario_id) on delete set null (materia_id)
);

create table public.questao_cartoes (
  questao_id uuid primary key,
  usuario_id uuid not null references auth.users (id) on delete cascade,
  estabilidade double precision not null,
  dificuldade double precision not null,
  ultimo_dia integer not null,
  repeticoes integer not null default 1,
  proxima date not null,
  ultimo_resultado text,
  respondida_em timestamptz not null default now(),
  foreign key (questao_id, usuario_id) references public.questoes (id, usuario_id) on delete cascade
);

create table public.proficiencias (
  assunto_id uuid primary key,
  usuario_id uuid not null references auth.users (id) on delete cascade,
  theta double precision not null default 0,
  n integer not null default 0,
  proficiencia integer,
  estado text not null default 'nao_iniciado',
  retencao integer,
  respostas integer not null default 0,
  faltam integer,
  proxima_revisao date,
  checklist jsonb not null default '[]',
  atualizado_em timestamptz not null default now(),
  foreign key (assunto_id, usuario_id) references public.assuntos (id, usuario_id) on delete cascade
);

create table public.pontos_eventos (
  id bigint generated always as identity primary key,
  usuario_id uuid not null references auth.users (id) on delete cascade,
  revisao_id uuid,
  motivo text not null check (char_length(motivo) <= 80),
  pontos integer not null,
  criado_em timestamptz not null default now(),
  foreign key (revisao_id, usuario_id) references public.revisoes (id, usuario_id) on delete set null (revisao_id)
);

create index revisoes_usuario_criado on public.revisoes (usuario_id, criado_em desc);
create index revisoes_usuario_status on public.revisoes (usuario_id, status);
create index revisao_itens_revisao_usuario on public.revisao_itens (revisao_id, usuario_id);
create index revisao_itens_usuario_respondida on public.revisao_itens (usuario_id, respondida_em desc);
create index revisao_itens_questao_usuario on public.revisao_itens (questao_id, usuario_id);
create index revisao_itens_assunto_usuario on public.revisao_itens (assunto_id, usuario_id);
create index revisao_itens_materia_usuario on public.revisao_itens (materia_id, usuario_id);
create index questao_cartoes_usuario_proxima on public.questao_cartoes (usuario_id, proxima);
create index questao_cartoes_questao_usuario on public.questao_cartoes (questao_id, usuario_id);
create index proficiencias_usuario on public.proficiencias (usuario_id);
create index proficiencias_assunto_usuario on public.proficiencias (assunto_id, usuario_id);
create index pontos_eventos_usuario_criado on public.pontos_eventos (usuario_id, criado_em desc);
create index pontos_eventos_revisao_usuario on public.pontos_eventos (revisao_id, usuario_id);

alter table public.revisoes enable row level security;
alter table public.revisao_itens enable row level security;
alter table public.questao_cartoes enable row level security;
alter table public.proficiencias enable row level security;
alter table public.pontos_eventos enable row level security;

create policy "revisoes: ler as próprias" on public.revisoes for select to authenticated using ((select auth.uid()) = usuario_id);
create policy "revisao_itens: ler os próprios" on public.revisao_itens for select to authenticated using ((select auth.uid()) = usuario_id);
create policy "questao_cartoes: ler os próprios" on public.questao_cartoes for select to authenticated using ((select auth.uid()) = usuario_id);
create policy "proficiencias: ler as próprias" on public.proficiencias for select to authenticated using ((select auth.uid()) = usuario_id);
create policy "pontos_eventos: ler os próprios" on public.pontos_eventos for select to authenticated using ((select auth.uid()) = usuario_id);

revoke all on public.revisoes, public.revisao_itens, public.questao_cartoes, public.proficiencias, public.pontos_eventos from anon, authenticated;
grant select on public.revisoes, public.revisao_itens, public.questao_cartoes, public.proficiencias, public.pontos_eventos to authenticated;

-- Números do estudo para o cabeçalho, o Início, a tela Revisar e os desbloqueios. Dias no horário de Brasília.
create function public.resumo_estudo()
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
      where respondidas > 0 order by criado_em desc limit 8) u),
    'em_andamento', (select to_jsonb(x) from (
      select id, titulo, total, respondidas, status, pausada_em, atualizado_em from public.revisoes r
      where r.usuario_id = (select id from eu) and r.status in ('em_andamento', 'pausada') order by atualizado_em desc limit 1) x)
  );
$$;

revoke execute on function public.resumo_estudo() from public, anon;
grant execute on function public.resumo_estudo() to authenticated;

  $m$;
  insert into auth.users (id, email, aud, role) values (a, 'a@teste.pgc', 'authenticated', 'authenticated'), (b, 'b@teste.pgc', 'authenticated', 'authenticated');
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  insert into public.materias (nome) values ('Física') returning id into ma;
  insert into public.assuntos (materia_id, nome) values (ma, 'Queda livre') returning id into sa;
  insert into public.questoes (materia_id, assunto_id, tipo, enunciado, conteudo, origem)
    values (ma, sa, 'multipla_escolha', 'Uma pedra cai por 3 s. Qual a altura?', '{"alternativas":[]}', 'minha') returning id into q1;
  begin
    insert into public.revisoes (usuario_id, modelo, titulo, total) values (a, 'rapida', 'x', 6);
    rel := rel || '1 FALHOU: a pessoa criou revisão direto' || E'\n';
  exception when insufficient_privilege then rel := rel || '1 revisão só pelo servidor' || E'\n';
  end;
  execute 'reset role';
  insert into public.revisoes (usuario_id, modelo, titulo, total, status) values (a, 'rapida', 'Rápida, Física', 3, 'concluida') returning id into rv;
  update public.revisoes set respondidas = 3, certas = 2, parciais = 1 where id = rv;
  insert into public.revisao_itens (usuario_id, revisao_id, ordem, questao_id, assunto_id, materia_id, tipo, nivel, bloom, snapshot, semente, resultado, respondida_em) values
    (a, rv, 0, q1, sa, ma, 'multipla_escolha', 2, 2, '{}', 's', 'correta', now()),
    (a, rv, 1, q1, sa, ma, 'numerica', 2, 3, '{}', 's', 'incorreta', now() - interval '1 day'),
    (a, rv, 2, q1, sa, ma, 'numerica', 2, 3, '{}', 's', 'parcial', now() - interval '2 days'),
    (a, rv, 3, q1, sa, ma, 'numerica', 2, 3, '{}', 's', 'correta', now() - interval '5 days');
  insert into public.questao_cartoes (questao_id, usuario_id, estabilidade, dificuldade, ultimo_dia, proxima) values (q1, a, 3, 5, 20000, (now() at time zone 'America/Sao_Paulo')::date);
  insert into public.pontos_eventos (usuario_id, revisao_id, motivo, pontos) values (a, rv, 'respostas', 30);
  execute 'set local role authenticated';
  r := public.resumo_estudo();
  rel := rel || '2 hoje ' || (r->>'hoje') || ', dias seguidos ' || (r->>'dias_seguidos') || ' (esperado 1 e 3)' || E'\n';
  rel := rel || '3 tipos ' || (r->>'tipos_usados') || ', concluídas ' || (r->>'revisoes_concluidas') || ', erros 14d ' || (r->>'erros_14') || ', pontos ' || (r->>'pontos') || ' (esperado 2, 1, 1, 30)' || E'\n';
  rel := rel || '4 por_dia tem ' || jsonb_array_length(r->'por_dia') || ' dias, último ' || (r->'por_dia'->>13) || ' (esperado 14 e 1)' || E'\n';
  rel := rel || '5 acerto última ' || (r->'acerto_ultimas'->>0) || ' (esperado 83)' || E'\n';
  rel := rel || '6 vencidas ' || (r->>'vencidas') || ' (esperado 1: a questão vence hoje)' || E'\n';
  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  select count(*) into n from public.revisao_itens;
  rel := rel || '7 B vê ' || n || ' itens de A (esperado 0)' || E'\n';
  begin
    update public.revisao_itens set resultado = 'correta';
    rel := rel || '8 FALHOU: update passou' || E'\n';
  exception when insufficient_privilege then rel := rel || '8 itens não se alteram pela pessoa' || E'\n';
  end;
  execute 'reset role';
  select count(*) into n from pg_constraint where conrelid = 'public.revisao_itens'::regclass and contype = 'f' and pg_get_constraintdef(oid) like '%ON DELETE SET NULL (questao_id)%';
  rel := rel || '9 apagar questão solta o item: ' || n || ' (esperado 1)' || E'\n';
  raise exception E'RESULTADO\n%', rel;
end;
$teste$;
