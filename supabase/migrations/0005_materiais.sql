-- 0005_materiais.sql
-- Materiais de estudo: arquivo enviado, versões do texto, páginas, trechos e conceitos encontrados.
-- Só acrescenta: nada existente é apagado.
-- Regras:
--   - Cada pessoa só vê e mexe nas próprias linhas (RLS). Visitante sem login não acessa nada.
--   - Toda ligação entre tabelas usa o par (id, dono): ninguém liga o seu trecho ao material de outra conta.
--   - O arquivo fica no bucket privado "materiais", na pasta da própria pessoa: {dono}/{material}/original.{pdf|docx|txt}.
--   - Limites: 10 MB por arquivo, 300 páginas, 300 materiais por conta.

create table public.materiais (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  materia_id uuid not null,
  titulo text not null check (char_length(btrim(titulo)) between 1 and 160),
  origem text not null check (origem in ('arquivo', 'texto_colado')),
  formato text not null check (formato in ('pdf', 'docx', 'txt')),
  status text not null default 'enviando' check (status in ('enviando', 'extraindo', 'aguardando_conferencia', 'pronto', 'erro')),
  arquivo_caminho text check (arquivo_caminho is null or arquivo_caminho like usuario_id::text || '/%'),
  arquivo_nome text check (arquivo_nome is null or char_length(arquivo_nome) <= 200),
  tamanho_bytes integer check (tamanho_bytes is null or tamanho_bytes between 0 and 10485760),
  paginas integer check (paginas is null or paginas between 0 and 300),
  erro_codigo text check (erro_codigo is null or char_length(erro_codigo) <= 60),
  ia_permitida text not null default 'sem_treino' check (ia_permitida in ('nenhuma', 'sem_treino', 'todas')),
  arquivado_em timestamptz,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  unique (id, usuario_id),
  foreign key (materia_id, usuario_id) references public.materias (id, usuario_id) on delete cascade
);

create table public.material_versoes (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  material_id uuid not null,
  numero integer not null default 1 check (numero >= 1),
  total_caracteres integer not null default 0,
  analise jsonb not null default '{}',
  criada_em timestamptz not null default now(),
  aprovada_em timestamptz,
  unique (id, usuario_id),
  unique (material_id, numero),
  foreign key (material_id, usuario_id) references public.materiais (id, usuario_id) on delete cascade
);

create table public.material_paginas (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  versao_id uuid not null,
  numero integer not null check (numero between 1 and 300),
  palavras integer not null default 0,
  conferida_em timestamptz,
  unique (versao_id, numero),
  foreign key (versao_id, usuario_id) references public.material_versoes (id, usuario_id) on delete cascade
);

create table public.material_trechos (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  versao_id uuid not null,
  ordem double precision not null,
  pagina integer not null check (pagina between 1 and 300),
  tipo text not null default 'texto' check (tipo in ('titulo', 'texto', 'lista', 'formula', 'tabela', 'rodape')),
  texto text not null check (char_length(texto) between 1 and 20000),
  usar_em_questoes boolean not null default true,
  assunto_id uuid,
  busca tsvector generated always as (to_tsvector('portuguese', texto)) stored,
  atualizado_em timestamptz not null default now(),
  unique (id, usuario_id),
  foreign key (versao_id, usuario_id) references public.material_versoes (id, usuario_id) on delete cascade,
  foreign key (assunto_id, usuario_id) references public.assuntos (id, usuario_id) on delete set null (assunto_id)
);

create table public.conceitos (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  versao_id uuid not null,
  trecho_id uuid,
  assunto_id uuid,
  tipo text not null check (tipo in ('definicao', 'formula')),
  termo text not null check (char_length(btrim(termo)) between 1 and 200),
  definicao text check (definicao is null or char_length(definicao) <= 2000),
  pagina integer check (pagina is null or pagina between 1 and 300),
  origem text not null default 'material' check (origem in ('material', 'ia', 'manual', 'externo')),
  status text not null default 'sugerido' check (status in ('sugerido', 'aprovado', 'recusado')),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  foreign key (versao_id, usuario_id) references public.material_versoes (id, usuario_id) on delete cascade,
  foreign key (trecho_id, usuario_id) references public.material_trechos (id, usuario_id) on delete set null (trecho_id),
  foreign key (assunto_id, usuario_id) references public.assuntos (id, usuario_id) on delete set null (assunto_id)
);

create index materiais_usuario_criado on public.materiais (usuario_id, criado_em desc);
create index materiais_materia_usuario on public.materiais (materia_id, usuario_id);
create index material_versoes_material_usuario on public.material_versoes (material_id, usuario_id);
create index material_paginas_versao_usuario on public.material_paginas (versao_id, usuario_id);
create index material_paginas_conferida on public.material_paginas (usuario_id, conferida_em) where conferida_em is not null;
create index material_trechos_versao_usuario on public.material_trechos (versao_id, usuario_id);
create index material_trechos_versao_pagina on public.material_trechos (versao_id, pagina, ordem);
create index material_trechos_assunto_usuario on public.material_trechos (assunto_id, usuario_id);
create index material_trechos_busca on public.material_trechos using gin (busca);
create index conceitos_versao_usuario on public.conceitos (versao_id, usuario_id);
create index conceitos_trecho_usuario on public.conceitos (trecho_id, usuario_id);
create index conceitos_assunto_usuario on public.conceitos (assunto_id, usuario_id);

-- Limite de materiais por conta.
create function public.materiais_antes_de_inserir()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (select count(*) from public.materiais where usuario_id = new.usuario_id) >= 300 then
    raise exception 'Você chegou ao limite de 300 materiais. Arquive ou exclua algum para enviar outro.' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create trigger materiais_antes_de_inserir before insert on public.materiais
  for each row execute function public.materiais_antes_de_inserir();
create trigger materiais_antes_de_alterar before update on public.materiais
  for each row execute function public.tocar_atualizado_em();
create trigger material_trechos_antes_de_alterar before update on public.material_trechos
  for each row execute function public.tocar_atualizado_em();
create trigger conceitos_antes_de_alterar before update on public.conceitos
  for each row execute function public.tocar_atualizado_em();

alter table public.materiais enable row level security;
alter table public.material_versoes enable row level security;
alter table public.material_paginas enable row level security;
alter table public.material_trechos enable row level security;
alter table public.conceitos enable row level security;

create policy "materiais: só do dono" on public.materiais for all to authenticated
  using ((select auth.uid()) = usuario_id) with check ((select auth.uid()) = usuario_id);
create policy "material_versoes: só do dono" on public.material_versoes for all to authenticated
  using ((select auth.uid()) = usuario_id) with check ((select auth.uid()) = usuario_id);
create policy "material_paginas: só do dono" on public.material_paginas for all to authenticated
  using ((select auth.uid()) = usuario_id) with check ((select auth.uid()) = usuario_id);
create policy "material_trechos: só do dono" on public.material_trechos for all to authenticated
  using ((select auth.uid()) = usuario_id) with check ((select auth.uid()) = usuario_id);
create policy "conceitos: só do dono" on public.conceitos for all to authenticated
  using ((select auth.uid()) = usuario_id) with check ((select auth.uid()) = usuario_id);

revoke all on public.materiais, public.material_versoes, public.material_paginas, public.material_trechos, public.conceitos from anon;
grant select, insert, update, delete on public.materiais, public.material_versoes, public.material_paginas, public.material_trechos, public.conceitos to authenticated;
revoke execute on function public.materiais_antes_de_inserir() from public, anon, authenticated;

-- Bucket privado dos arquivos originais.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('materiais', 'materiais', false, 10485760, array[
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain'
])
on conflict (id) do nothing;

create policy "materiais: ver o proprio" on storage.objects for select to authenticated
  using (bucket_id = 'materiais' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "materiais: enviar o proprio" on storage.objects for insert to authenticated
  with check (bucket_id = 'materiais' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "materiais: trocar o proprio" on storage.objects for update to authenticated
  using (bucket_id = 'materiais' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'materiais' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "materiais: apagar o proprio" on storage.objects for delete to authenticated
  using (bucket_id = 'materiais' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- DESFAZER (apaga todos os materiais e arquivos; só com backup e confirmação):
-- remova as 4 políticas "materiais: ..." de storage.objects, os objetos e o bucket "materiais";
-- remova as tabelas conceitos, material_trechos, material_paginas, material_versoes e materiais (nesta ordem)
-- e a função public.materiais_antes_de_inserir().
