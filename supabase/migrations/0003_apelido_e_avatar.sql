-- 0003_apelido_e_avatar.sql
-- Apelido para o ranking (opcional, único sem diferenciar maiúsculas) e bucket privado "avatares" para a foto de perfil.
-- Só acrescenta: nada existente é apagado.

alter table public.perfis
  add column apelido text
    check (apelido is null or (char_length(apelido) between 2 and 24 and apelido !~ '[[:space:][:cntrl:]]')),
  add constraint perfis_avatar_proprio
    check (avatar_caminho is null or avatar_caminho like id::text || '/%');

create unique index perfis_apelido_unico on public.perfis (lower(apelido)) where apelido is not null;

grant update (apelido) on public.perfis to authenticated;

-- Mesma função da 0002, agora lendo também o apelido. Se o apelido já for de outra pessoa, o cadastro segue sem ele.
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
      where value in ('exatas', 'natureza', 'humanas', 'portugues', 'idiomas', 'programacao', 'saude', 'direito')
      limit 8
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

-- Bucket privado: cada pessoa só enxerga e mexe na própria pasta (nome da pasta = id da pessoa).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatares', 'avatares', false, 262144, array['image/jpeg'])
on conflict (id) do nothing;

create policy "avatares: ver o proprio" on storage.objects for select to authenticated
  using (bucket_id = 'avatares' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "avatares: enviar o proprio" on storage.objects for insert to authenticated
  with check (bucket_id = 'avatares' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "avatares: trocar o proprio" on storage.objects for update to authenticated
  using (bucket_id = 'avatares' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'avatares' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "avatares: apagar o proprio" on storage.objects for delete to authenticated
  using (bucket_id = 'avatares' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- DESFAZER (apaga apelidos e fotos já enviados; só com backup e confirmação):
-- rode de novo o "create or replace function public.criar_perfil()" da 0002
-- drop policy "avatares: ver o proprio" on storage.objects;
-- drop policy "avatares: enviar o proprio" on storage.objects;
-- drop policy "avatares: trocar o proprio" on storage.objects;
-- drop policy "avatares: apagar o proprio" on storage.objects;
-- delete from storage.objects where bucket_id = 'avatares';
-- delete from storage.buckets where id = 'avatares';
-- drop index if exists public.perfis_apelido_unico;
-- alter table public.perfis drop constraint if exists perfis_avatar_proprio, drop column if exists apelido;
