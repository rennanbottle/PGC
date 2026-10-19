-- 0007_ia.sql
-- IA em cascata: catálogo de modelos, registro de uso, gerações pedidas e donos do sistema. Só acrescenta.
-- Regras:
--   - O catálogo guarda o NOME da variável da chave (GROQ_API_KEY), nunca o valor. Ninguém lê o catálogo direto:
--     só pelas funções abaixo, que devolvem o que cada uma precisa.
--   - Nenhum texto enviado ou recebido dos modelos é guardado. O uso guarda tarefa, resultado, motivo da falha,
--     tempo e tokens (para a cota grátis do dia e o aviso de saúde).
--   - Três falhas seguidas pausam o modelo por 15 minutos; cada nova pausa dobra, até 6 horas. Um sucesso zera.
--   - Gerações: até 10 por pessoa por dia (horário de Brasília). Geração que falhou não conta.
--   - Diagnóstico: só para quem está em sistema_donos (tabela sem acesso pelo app; a inclusão é feita à mão no SQL).

create table public.ia_modelos (
  id uuid primary key default gen_random_uuid(),
  provedor text not null check (provedor in ('groq', 'cloudflare', 'gemini', 'openrouter')),
  modelo text not null check (char_length(modelo) between 1 and 120),
  variavel_chave text not null check (variavel_chave ~ '^[A-Z][A-Z0-9_]{2,60}$'),
  tarefas text[] not null default '{}',
  capacidades text[] not null default '{}',
  prioridade integer not null default 100,
  ativo boolean not null default true,
  treina_com_dados boolean not null default false,
  falhas_seguidas integer not null default 0,
  pausa_minutos integer not null default 15,
  pausado_ate timestamptz,
  ultimo_sucesso_em timestamptz,
  ultimo_teste_em timestamptz,
  conferido_na_doc_em date,
  observacao text,
  unique (provedor, modelo)
);

create table public.sistema_donos (
  usuario_id uuid primary key references auth.users (id) on delete cascade,
  incluido_em timestamptz not null default now()
);

create table public.ia_geracoes (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  materia_id uuid not null,
  material_id uuid,
  status text not null default 'pendente' check (status in ('pendente', 'concluida', 'falhou')),
  config jsonb not null default '{}' check (jsonb_typeof(config) = 'object' and pg_column_size(config) <= 8000),
  modelo_id uuid references public.ia_modelos (id) on delete set null,
  modelo_nome text check (modelo_nome is null or char_length(modelo_nome) <= 160),
  pedidas integer not null default 0 check (pedidas between 0 and 10),
  salvas integer not null default 0,
  descartadas jsonb not null default '[]' check (jsonb_typeof(descartadas) = 'array' and pg_column_size(descartadas) <= 20000),
  refeitas integer not null default 0,
  palavras_enviadas integer,
  paginas text check (paginas is null or char_length(paginas) <= 80),
  latencia_ms integer,
  motivo_falha text check (motivo_falha is null or char_length(motivo_falha) <= 400),
  criado_em timestamptz not null default now(),
  concluido_em timestamptz,
  unique (id, usuario_id),
  foreign key (materia_id, usuario_id) references public.materias (id, usuario_id) on delete cascade,
  foreign key (material_id, usuario_id) references public.materiais (id, usuario_id) on delete set null (material_id)
);

create table public.ia_uso (
  id bigint generated always as identity primary key,
  usuario_id uuid references auth.users (id) on delete set null,
  modelo_id uuid references public.ia_modelos (id) on delete set null,
  provedor text not null,
  tarefa text not null check (tarefa in ('gerar', 'refazer', 'gabarito', 'teste')),
  resultado text not null check (resultado in ('ok', 'falha')),
  categoria_falha text check (categoria_falha is null or categoria_falha in ('tempo_esgotado', 'limite', 'http', 'saida_invalida', 'sem_chave')),
  latencia_ms integer,
  tokens_entrada integer not null default 0,
  tokens_saida integer not null default 0,
  criado_em timestamptz not null default now()
);

alter table public.questoes add column geracao_id uuid;
alter table public.questoes add column modelo_id uuid references public.ia_modelos (id) on delete set null;
alter table public.questoes add constraint questoes_geracao_fk foreign key (geracao_id, usuario_id)
  references public.ia_geracoes (id, usuario_id) on delete set null (geracao_id);

create index ia_geracoes_usuario_criado on public.ia_geracoes (usuario_id, criado_em desc);
create index ia_geracoes_materia_usuario on public.ia_geracoes (materia_id, usuario_id);
create index ia_geracoes_material_usuario on public.ia_geracoes (material_id, usuario_id);
create index ia_geracoes_modelo on public.ia_geracoes (modelo_id);
create index ia_uso_criado on public.ia_uso (criado_em desc);
create index ia_uso_usuario_criado on public.ia_uso (usuario_id, criado_em desc);
create index ia_uso_modelo on public.ia_uso (modelo_id);
create index questoes_geracao_usuario on public.questoes (geracao_id, usuario_id);
create index questoes_modelo on public.questoes (modelo_id);

-- Limite de gerações por dia (Brasília): pendentes e concluídas contam, as que falharam não.
create function public.ia_geracoes_antes_de_inserir()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (select count(*) from public.ia_geracoes
      where usuario_id = new.usuario_id and status <> 'falhou'
        and (criado_em at time zone 'America/Sao_Paulo')::date = (now() at time zone 'America/Sao_Paulo')::date) >= 10 then
    raise exception 'Você já fez as 10 gerações com IA de hoje. Amanhã libera de novo; enquanto isso, a geração sem IA continua aberta.' using errcode = 'P0001';
  end if;
  return new;
end;
$$;
create trigger ia_geracoes_antes_de_inserir before insert on public.ia_geracoes
  for each row execute function public.ia_geracoes_antes_de_inserir();

alter table public.ia_modelos enable row level security;
alter table public.sistema_donos enable row level security;
alter table public.ia_uso enable row level security;
alter table public.ia_geracoes enable row level security;

-- ia_modelos, sistema_donos e ia_uso: nenhuma política (o app não lê nem escreve direto).
create policy "ia_geracoes: só do dono" on public.ia_geracoes for all to authenticated
  using ((select auth.uid()) = usuario_id) with check ((select auth.uid()) = usuario_id);

revoke all on public.ia_modelos, public.sistema_donos, public.ia_uso, public.ia_geracoes from anon;
revoke all on public.ia_modelos, public.sistema_donos, public.ia_uso from authenticated;
grant select, insert, update, delete on public.ia_geracoes to authenticated;

-- Tokens gastos hoje por provedor (dia do provedor: meia-noite UTC).
create function public.ia_tokens_hoje()
returns table (provedor text, entrada bigint, saida bigint)
language sql
stable
security definer
set search_path = ''
as $$
  select u.provedor, coalesce(sum(u.tokens_entrada), 0), coalesce(sum(u.tokens_saida), 0)
  from public.ia_uso u
  where u.criado_em >= date_trunc('day', now() at time zone 'UTC') at time zone 'UTC'
  group by u.provedor;
$$;

-- Modelos que podem fazer a tarefa agora, na ordem da cascata, com o gasto do dia do provedor.
create function public.ia_modelos_para(p_tarefa text, p_permite_treino boolean)
returns table (id uuid, provedor text, modelo text, variavel_chave text, capacidades text[], prioridade integer, tokens_entrada_hoje bigint, tokens_saida_hoje bigint)
language sql
stable
security definer
set search_path = ''
as $$
  select m.id, m.provedor, m.modelo, m.variavel_chave, m.capacidades, m.prioridade,
    coalesce(t.entrada, 0), coalesce(t.saida, 0)
  from public.ia_modelos m
  left join public.ia_tokens_hoje() t on t.provedor = m.provedor
  where (select auth.uid()) is not null
    and m.ativo
    and (m.pausado_ate is null or m.pausado_ate < now())
    and p_tarefa = any (m.tarefas)
    and (p_permite_treino or not m.treina_com_dados)
  order by m.prioridade, m.modelo;
$$;

-- Registra uma tentativa e cuida da pausa do modelo. No máximo 120 registros por pessoa por hora.
create function public.ia_registrar(
  p_modelo_id uuid, p_tarefa text, p_ok boolean, p_categoria text, p_latencia integer, p_tokens_entrada integer, p_tokens_saida integer
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  eu uuid := (select auth.uid());
  m public.ia_modelos;
begin
  if eu is null then
    raise exception 'Sem sessão.' using errcode = '42501';
  end if;
  if (select count(*) from public.ia_uso where usuario_id = eu and criado_em > now() - interval '1 hour') >= 120 then
    raise exception 'Muitos pedidos à IA nesta hora. Espere um pouco.' using errcode = 'P0001';
  end if;
  select * into m from public.ia_modelos where id = p_modelo_id;
  if not found then
    raise exception 'Modelo desconhecido.' using errcode = 'P0001';
  end if;
  insert into public.ia_uso (usuario_id, modelo_id, provedor, tarefa, resultado, categoria_falha, latencia_ms, tokens_entrada, tokens_saida)
  values (eu, m.id, m.provedor, p_tarefa, case when p_ok then 'ok' else 'falha' end, case when p_ok then null else p_categoria end,
    greatest(0, least(p_latencia, 600000)), greatest(0, least(coalesce(p_tokens_entrada, 0), 200000)), greatest(0, least(coalesce(p_tokens_saida, 0), 200000)));
  if p_ok then
    update public.ia_modelos set falhas_seguidas = 0, pausa_minutos = 15, ultimo_sucesso_em = now(),
      ultimo_teste_em = case when p_tarefa = 'teste' then now() else ultimo_teste_em end
    where id = m.id;
  elsif p_categoria <> 'sem_chave' then
    if m.falhas_seguidas + 1 >= 3 then
      update public.ia_modelos set falhas_seguidas = 0, pausado_ate = now() + make_interval(mins => m.pausa_minutos),
        pausa_minutos = least(m.pausa_minutos * 2, 360),
        ultimo_teste_em = case when p_tarefa = 'teste' then now() else ultimo_teste_em end
      where id = m.id;
    else
      update public.ia_modelos set falhas_seguidas = m.falhas_seguidas + 1,
        ultimo_teste_em = case when p_tarefa = 'teste' then now() else ultimo_teste_em end
      where id = m.id;
    end if;
  end if;
end;
$$;

-- Gerações da pessoa hoje (Brasília) e o limite.
create function public.ia_minha_cota()
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select jsonb_build_object(
    'usadas', (select count(*) from public.ia_geracoes
      where usuario_id = (select auth.uid()) and status <> 'falhou'
        and (criado_em at time zone 'America/Sao_Paulo')::date = (now() at time zone 'America/Sao_Paulo')::date),
    'limite', 10
  );
$$;

create function public.sou_dono()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.sistema_donos where usuario_id = (select auth.uid()));
$$;

-- Diagnóstico (só donos): catálogo, gerações por dia, falhas por motivo e gasto do dia por provedor.
create function public.ia_diagnostico()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.sou_dono() then
    raise exception 'Só o dono do sistema vê o diagnóstico.' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'modelos', coalesce((select jsonb_agg(jsonb_build_object(
        'id', m.id, 'provedor', m.provedor, 'modelo', m.modelo, 'variavel_chave', m.variavel_chave, 'tarefas', m.tarefas,
        'prioridade', m.prioridade, 'ativo', m.ativo, 'treina_com_dados', m.treina_com_dados, 'falhas_seguidas', m.falhas_seguidas,
        'pausado_ate', m.pausado_ate, 'ultimo_sucesso_em', m.ultimo_sucesso_em, 'ultimo_teste_em', m.ultimo_teste_em, 'observacao', m.observacao
      ) order by m.prioridade) from public.ia_modelos m), '[]'),
    'dias', (select jsonb_agg(jsonb_build_object('pedidos', coalesce(c.pedidos, 0), 'ok', coalesce(c.ok, 0)) order by s.k desc)
      from generate_series(0, 13) as s(k)
      left join (select (criado_em at time zone 'America/Sao_Paulo')::date as d, count(*) as pedidos, count(*) filter (where status = 'concluida') as ok
        from public.ia_geracoes where criado_em >= now() - interval '15 days' group by 1) c
        on c.d = (now() at time zone 'America/Sao_Paulo')::date - s.k),
    'falhas', coalesce((select jsonb_object_agg(categoria_falha, n) from (
        select categoria_falha, count(*) as n from public.ia_uso
        where resultado = 'falha' and criado_em >= now() - interval '7 days' group by categoria_falha) f), '{}'),
    'tentativas_7d', (select count(*) from public.ia_uso where criado_em >= now() - interval '7 days'),
    'tokens_hoje', coalesce((select jsonb_object_agg(provedor, jsonb_build_object('entrada', entrada, 'saida', saida)) from public.ia_tokens_hoje()), '{}'),
    'sem_modelo_6h', (select count(*) from public.ia_geracoes where status = 'falhou' and criado_em >= now() - interval '6 hours'),
    'testes_ultima_hora', (select count(*) from public.ia_uso where tarefa = 'teste' and criado_em >= now() - interval '1 hour')
  );
end;
$$;

revoke execute on function public.ia_geracoes_antes_de_inserir(), public.ia_tokens_hoje() from public, anon, authenticated;
revoke execute on function public.ia_modelos_para(text, boolean), public.ia_registrar(uuid, text, boolean, text, integer, integer, integer),
  public.ia_minha_cota(), public.sou_dono(), public.ia_diagnostico() from public, anon;
grant execute on function public.ia_modelos_para(text, boolean), public.ia_registrar(uuid, text, boolean, text, integer, integer, integer),
  public.ia_minha_cota(), public.sou_dono(), public.ia_diagnostico() to authenticated;

-- Catálogo inicial. Ordem provisória do plano: Groq, depois Cloudflare. Gemini e OpenRouter começam desligados
-- (treinam com os dados; só para material liberado). Conferir modelo e limites no painel de cada provedor.
insert into public.ia_modelos (provedor, modelo, variavel_chave, tarefas, capacidades, prioridade, ativo, treina_com_dados, conferido_na_doc_em, observacao) values
  ('groq', 'openai/gpt-oss-120b', 'GROQ_API_KEY', '{gerar,refazer,gabarito,teste}', '{json_object}', 10, true, false, '2026-10-04', 'Plano grátis: amostra de 200 mil tokens por dia e 8 mil por minuto.'),
  ('cloudflare', '@cf/openai/gpt-oss-120b', 'CLOUDFLARE_API_TOKEN', '{gerar,refazer,gabarito,teste}', '{json_object}', 20, true, false, '2026-10-04', '10 mil neurons por dia; zera à meia-noite UTC.'),
  ('groq', 'openai/gpt-oss-20b', 'GROQ_API_KEY', '{gabarito,refazer,teste}', '{json_object}', 30, true, false, '2026-10-04', 'Menor e mais rápido; reserva para tarefas curtas.'),
  ('gemini', 'gemini-2.5-flash-lite', 'GEMINI_API_KEY', '{gerar,refazer,gabarito,teste}', '{json_object}', 40, false, true, null, 'Plano grátis usa os dados para treinar. Conferir o nome do modelo atual antes de ligar.'),
  ('openrouter', 'openrouter/free', 'OPENROUTER_API_KEY', '{gerar,refazer,teste}', '{}', 50, false, true, null, 'Modelos :free usam os dados para treinar. Escolher o modelo antes de ligar.');
