-- 0017_guias.sql
-- Pedido do R (12/10/2026): sai o mascote, entra o guia escolhido pela pessoa. Um guia pronto (arquivo do site) ou
-- o próprio, criado com uma imagem: a pessoa leva o pedido do PGC a uma IA de imagens, recebe dois mosaicos e o
-- PGC recorta as 12 expressões numa imagem só (sprite), guardada no bucket privado "guias".
--   perfis.guia: id do guia pronto ('gato'...) ou 'proprio'. Vazio = ainda não escolheu (mostra o padrão).
--   perfis.guia_nome: nome que a pessoa deu ao guia próprio (opcional).
--   perfis.guia_versao: muda a cada envio, para as telas baixarem a imagem nova.
-- Só acrescenta colunas e o bucket: nada é apagado.

alter table public.perfis
  add column if not exists guia text check (guia is null or guia ~ '^[a-z0-9_-]{2,30}$'),
  add column if not exists guia_nome text check (guia_nome is null or char_length(guia_nome) between 1 and 30),
  add column if not exists guia_versao integer not null default 0 check (guia_versao between 0 and 100000);

grant update (guia, guia_nome, guia_versao) on public.perfis to authenticated;

-- Bucket privado: cada pessoa só enxerga e mexe na própria pasta (nome da pasta = id da pessoa). Até 3 MB.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('guias', 'guias', false, 3145728, array['image/webp', 'image/png'])
on conflict (id) do nothing;

create policy "guias: ver o proprio" on storage.objects for select to authenticated
  using (bucket_id = 'guias' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "guias: enviar o proprio" on storage.objects for insert to authenticated
  with check (bucket_id = 'guias' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "guias: trocar o proprio" on storage.objects for update to authenticated
  using (bucket_id = 'guias' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'guias' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "guias: apagar o proprio" on storage.objects for delete to authenticated
  using (bucket_id = 'guias' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- DESFAZER (apaga os guias enviados; só com backup e confirmação):
-- drop policy "guias: ver o proprio" on storage.objects;
-- drop policy "guias: enviar o proprio" on storage.objects;
-- drop policy "guias: trocar o proprio" on storage.objects;
-- drop policy "guias: apagar o proprio" on storage.objects;
-- delete from storage.objects where bucket_id = 'guias';
-- delete from storage.buckets where id = 'guias';
-- alter table public.perfis drop column if exists guia_versao, drop column if exists guia_nome, drop column if exists guia;
