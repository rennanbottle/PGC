-- 0006_questoes.sql
-- Banco de questões e bancos importados. Só acrescenta: nada existente é apagado.
-- Regras:
--   - Cada pessoa só vê e mexe nas próprias linhas (RLS). Visitante sem login não acessa nada.
--   - Toda ligação usa o par (id, dono): ninguém liga a própria questão à matéria, ao assunto ou ao material de outra conta.
--   - O assunto da questão tem de ser da mesma matéria da questão.
--   - "em_revisao" diz se a questão pode entrar nas revisões: ativa, sem falha de qualidade, com gabarito
--     (ou marcada "resolver e comparar"), com a imagem que cita e sem mudança no trecho do material de onde saiu.
--   - Quando o trecho ou o conceito de origem muda depois de a questão existir, a questão fica marcada
--     "material_mudou" e sai das revisões até a pessoa conferir.
--   - Arquivos: bucket privado "bancos" (prova antiga ou lista para importar, 10 MB) e "questoes" (imagens, 2 MB),
--     sempre na pasta da própria pessoa.
--   - Apagar um banco importado solta as questões já aprovadas dele; os rascunhos o app apaga antes.
--   - Limites: 5000 questões e 100 bancos importados por conta.

create table public.bancos_importados (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  materia_id uuid not null,
  titulo text not null check (char_length(btrim(titulo)) between 1 and 160),
  formato text not null check (formato in ('pdf', 'docx', 'txt', 'csv', 'xlsx')),
  status text not null default 'enviando' check (status in ('enviando', 'lendo', 'aguardando_conferencia', 'concluido', 'erro')),
  arquivo_caminho text check (arquivo_caminho is null or arquivo_caminho like usuario_id::text || '/%'),
  arquivo_nome text check (arquivo_nome is null or char_length(arquivo_nome) <= 200),
  tamanho_bytes integer check (tamanho_bytes is null or tamanho_bytes between 0 and 10485760),
  paginas integer check (paginas is null or paginas between 0 and 300),
  erro_codigo text check (erro_codigo is null or char_length(erro_codigo) <= 60),
  total_reconhecido integer not null default 0,
  total_com_gabarito integer not null default 0,
  total_com_figura integer not null default 0,
  gabarito_pagina integer,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  concluido_em timestamptz,
  unique (id, usuario_id),
  foreign key (materia_id, usuario_id) references public.materias (id, usuario_id) on delete cascade
);

-- O conceito precisa do par (id, dono) para a questão apontar para ele com segurança.
alter table public.conceitos add constraint conceitos_id_usuario_unico unique (id, usuario_id);

create table public.questoes (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  materia_id uuid not null,
  assunto_id uuid,
  material_id uuid,
  versao_id uuid,
  trecho_id uuid,
  conceito_id uuid,
  banco_id uuid,
  tipo text not null check (tipo in (
    'multipla_escolha', 'multipla_resposta', 'verdadeiro_falso', 'certo_errado', 'assercao_razao',
    'lacuna_opcoes', 'lacuna_digitada', 'associar', 'ordenar', 'classificar', 'numerica',
    'encontrar_erro', 'texto_base', 'prever_resultado', 'cartao', 'resposta_curta', 'explicar'
  )),
  nivel smallint not null default 2 check (nivel between 1 and 5),
  bloom smallint not null default 1 check (bloom between 1 and 6),
  -- Ponto de partida da dificuldade (TRI). As respostas corrigem a partir da Etapa 7.
  dificuldade_b real not null default -0.5,
  respostas_b integer not null default 0,
  enunciado text not null check (char_length(btrim(enunciado)) between 1 and 5000),
  conteudo jsonb not null default '{}' check (jsonb_typeof(conteudo) = 'object' and pg_column_size(conteudo) <= 30000),
  explicacao text check (explicacao is null or char_length(explicacao) <= 3000),
  fonte text check (fonte is null or char_length(fonte) <= 200),
  origem text not null check (origem in ('gerada', 'material', 'importada', 'minha')),
  status text not null default 'ativa' check (status in ('rascunho', 'ativa', 'arquivada')),
  gabarito_confirmado boolean not null default true,
  resolver_comparar boolean not null default false,
  qualidade_aprovada boolean not null default true,
  avisos_qualidade jsonb not null default '[]' check (jsonb_typeof(avisos_qualidade) = 'array'),
  precisa_imagem boolean not null default false,
  imagem_caminho text check (imagem_caminho is null or imagem_caminho like usuario_id::text || '/%'),
  material_mudou boolean not null default false,
  numero_original integer check (numero_original is null or numero_original between 1 and 2000),
  trecho_original text check (trecho_original is null or char_length(trecho_original) <= 6000),
  -- Marca de origem da geração sem IA ("lacuna:<conceito>"), para não gerar a mesma questão duas vezes.
  chave text check (chave is null or char_length(chave) <= 200),
  em_revisao boolean generated always as (
    status = 'ativa' and qualidade_aprovada and (gabarito_confirmado or resolver_comparar)
    and not precisa_imagem and not material_mudou
  ) stored,
  busca tsvector generated always as (to_tsvector('portuguese', enunciado)) stored,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  unique (id, usuario_id),
  unique (usuario_id, chave),
  foreign key (materia_id, usuario_id) references public.materias (id, usuario_id) on delete cascade,
  foreign key (assunto_id, usuario_id) references public.assuntos (id, usuario_id) on delete set null (assunto_id),
  foreign key (material_id, usuario_id) references public.materiais (id, usuario_id) on delete set null (material_id),
  foreign key (versao_id, usuario_id) references public.material_versoes (id, usuario_id) on delete set null (versao_id),
  foreign key (trecho_id, usuario_id) references public.material_trechos (id, usuario_id) on delete set null (trecho_id),
  foreign key (conceito_id, usuario_id) references public.conceitos (id, usuario_id) on delete set null (conceito_id),
  foreign key (banco_id, usuario_id) references public.bancos_importados (id, usuario_id) on delete set null (banco_id)
);

create index bancos_importados_usuario_criado on public.bancos_importados (usuario_id, criado_em desc);
create index bancos_importados_materia_usuario on public.bancos_importados (materia_id, usuario_id);
create index questoes_usuario_criado on public.questoes (usuario_id, criado_em desc);
create index questoes_materia_usuario on public.questoes (materia_id, usuario_id);
create index questoes_assunto_usuario on public.questoes (assunto_id, usuario_id);
create index questoes_material_usuario on public.questoes (material_id, usuario_id);
create index questoes_versao_usuario on public.questoes (versao_id, usuario_id);
create index questoes_trecho_usuario on public.questoes (trecho_id, usuario_id);
create index questoes_conceito_usuario on public.questoes (conceito_id, usuario_id);
create index questoes_banco_usuario on public.questoes (banco_id, usuario_id, numero_original);
create index questoes_busca on public.questoes using gin (busca);

-- Antes de gravar a questão: limite por conta, assunto da mesma matéria e dificuldade inicial pelo nível.
create function public.questoes_antes_de_gravar()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' and (select count(*) from public.questoes where usuario_id = new.usuario_id) >= 5000 then
    raise exception 'Você chegou ao limite de 5000 questões. Arquive ou exclua algumas para criar outras.' using errcode = 'P0001';
  end if;
  if new.assunto_id is not null and not exists (
    select 1 from public.assuntos where id = new.assunto_id and materia_id = new.materia_id and usuario_id = new.usuario_id
  ) then
    raise exception 'O assunto escolhido não é desta matéria.' using errcode = 'P0001';
  end if;
  -- Enquanto ninguém respondeu, o nível escolhido define o ponto de partida.
  if new.respostas_b = 0 and (tg_op = 'INSERT' or new.nivel is distinct from old.nivel) then
    new.dificuldade_b := (array[-1.5, -0.5, 0.5, 1.3, 2.0])[new.nivel];
  end if;
  if new.imagem_caminho is not null then
    new.precisa_imagem := false;
  end if;
  if tg_op = 'UPDATE' then
    new.atualizado_em := now();
  end if;
  return new;
end;
$$;

create trigger questoes_antes_de_gravar before insert or update on public.questoes
  for each row execute function public.questoes_antes_de_gravar();

create function public.bancos_antes_de_inserir()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (select count(*) from public.bancos_importados where usuario_id = new.usuario_id) >= 100 then
    raise exception 'Você chegou ao limite de 100 bancos importados. Exclua algum para importar outro.' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create trigger bancos_antes_de_inserir before insert on public.bancos_importados
  for each row execute function public.bancos_antes_de_inserir();
create trigger bancos_antes_de_alterar before update on public.bancos_importados
  for each row execute function public.tocar_atualizado_em();

-- Mudou o texto do trecho ou o conceito depois de virar questão: a questão sai das revisões até ser conferida.
-- Roda com a permissão de quem altera; o RLS já limita às questões da própria pessoa.
create function public.trecho_mudou()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    -- Trecho juntado a outro na conferência: a questão que saiu dele precisa ser conferida.
    -- Se a versão inteira está sendo apagada (material excluído), a questão fica como está.
    if exists (select 1 from public.material_versoes where id = old.versao_id) then
      update public.questoes set material_mudou = true where trecho_id = old.id and usuario_id = old.usuario_id;
    end if;
    return old;
  end if;
  if new.texto is distinct from old.texto or (new.usar_em_questoes = false and old.usar_em_questoes) then
    update public.questoes set material_mudou = true where trecho_id = new.id and usuario_id = new.usuario_id;
  end if;
  return new;
end;
$$;

create trigger material_trechos_mudou after update on public.material_trechos
  for each row execute function public.trecho_mudou();
-- Antes de apagar: depois, a ligação da questão com o trecho já teria sido solta.
create trigger material_trechos_saiu before delete on public.material_trechos
  for each row execute function public.trecho_mudou();

create function public.conceito_mudou()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.termo is distinct from old.termo or new.definicao is distinct from old.definicao or (new.status = 'recusado' and old.status <> 'recusado') then
    update public.questoes set material_mudou = true where conceito_id = new.id and usuario_id = new.usuario_id;
  end if;
  return new;
end;
$$;

create trigger conceitos_mudou after update on public.conceitos
  for each row execute function public.conceito_mudou();

alter table public.bancos_importados enable row level security;
alter table public.questoes enable row level security;

create policy "bancos_importados: só do dono" on public.bancos_importados for all to authenticated
  using ((select auth.uid()) = usuario_id) with check ((select auth.uid()) = usuario_id);
create policy "questoes: só do dono" on public.questoes for all to authenticated
  using ((select auth.uid()) = usuario_id) with check ((select auth.uid()) = usuario_id);

revoke all on public.bancos_importados, public.questoes from anon;
grant select, insert, update, delete on public.bancos_importados, public.questoes to authenticated;
revoke execute on function public.questoes_antes_de_gravar(), public.bancos_antes_de_inserir(), public.trecho_mudou(), public.conceito_mudou() from public, anon, authenticated;

-- Resumo do banco para a tela de Questões, numa consulta só (com o RLS de quem chama).
-- "dias": questões criadas por dia nos últimos 14 dias, no horário de Brasília (índice 0 = 13 dias atrás).
create function public.resumo_questoes()
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  with q as (
    select * from public.questoes where usuario_id = (select auth.uid())
  ),
  hoje as (select (now() at time zone 'America/Sao_Paulo')::date as d)
  select jsonb_build_object(
    'total', (select count(*) from q where status = 'ativa'),
    'em_revisao', (select count(*) from q where em_revisao),
    'rascunhos', (select count(*) from q where status = 'rascunho'),
    'arquivadas', (select count(*) from q where status = 'arquivada'),
    'fora', jsonb_build_object(
      'gabarito', (select count(*) from q where status = 'ativa' and not gabarito_confirmado and not resolver_comparar),
      'qualidade', (select count(*) from q where status = 'ativa' and not qualidade_aprovada),
      'imagem', (select count(*) from q where status = 'ativa' and precisa_imagem),
      'material', (select count(*) from q where status = 'ativa' and material_mudou)
    ),
    'por_nivel', (select jsonb_agg(coalesce(c.n, 0) order by s.nivel) from generate_series(1, 5) as s(nivel)
      left join (select nivel, count(*) as n from q where status = 'ativa' group by nivel) c on c.nivel = s.nivel),
    'por_tipo', coalesce((select jsonb_object_agg(tipo, n) from (select tipo, count(*) as n from q where status = 'ativa' group by tipo) t), '{}'),
    'semana_origem', coalesce((select jsonb_object_agg(origem, n) from (
      select origem, count(*) as n from q where status <> 'arquivada' and criado_em >= now() - interval '7 days' group by origem) t), '{}'),
    'dias', (select jsonb_agg(coalesce(c.n, 0) order by s.k desc) from hoje
      cross join generate_series(0, 13) as s(k)
      left join (select (criado_em at time zone 'America/Sao_Paulo')::date as d, count(*) as n from q
        where status <> 'arquivada' and criado_em >= now() - interval '15 days' group by 1) c on c.d = hoje.d - s.k)
  );
$$;

revoke execute on function public.resumo_questoes() from public, anon;
grant execute on function public.resumo_questoes() to authenticated;

-- Buckets privados: arquivo de banco para importar e imagens das questões.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('bancos', 'bancos', false, 10485760, array[
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain',
    'text/csv',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  ]),
  ('questoes', 'questoes', false, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy "bancos: ver o proprio" on storage.objects for select to authenticated
  using (bucket_id = 'bancos' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "bancos: enviar o proprio" on storage.objects for insert to authenticated
  with check (bucket_id = 'bancos' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "bancos: trocar o proprio" on storage.objects for update to authenticated
  using (bucket_id = 'bancos' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'bancos' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "bancos: apagar o proprio" on storage.objects for delete to authenticated
  using (bucket_id = 'bancos' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "questoes: ver a propria imagem" on storage.objects for select to authenticated
  using (bucket_id = 'questoes' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "questoes: enviar a propria imagem" on storage.objects for insert to authenticated
  with check (bucket_id = 'questoes' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "questoes: trocar a propria imagem" on storage.objects for update to authenticated
  using (bucket_id = 'questoes' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'questoes' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "questoes: apagar a propria imagem" on storage.objects for delete to authenticated
  using (bucket_id = 'questoes' and (storage.foldername(name))[1] = (select auth.uid())::text);
