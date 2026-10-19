-- 0002_perfis_areas.sql
-- Áreas que a pessoa estuda, escolhidas no passo 3 do cadastro. Só acrescenta: nada existente é apagado.

alter table public.perfis
  add column areas_interesse text[] not null default '{}'
  check (
    cardinality(areas_interesse) <= 8
    and areas_interesse <@ array['exatas', 'natureza', 'humanas', 'portugues', 'idiomas', 'programacao', 'saude', 'direito']::text[]
  );

grant update (areas_interesse) on public.perfis to authenticated;

-- Mesma função da 0001, agora lendo também as áreas (conferidas, sem repetição, no máximo 8).
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
  areas text[] := '{}';
begin
  if nome = '' then
    nome := 'Estudante';
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
  insert into public.perfis (id, nome_exibicao, ritmo, objetivo, privacidade_aceita_em, areas_interesse)
  values (
    new.id,
    nome,
    case when ritmo_pedido in ('tranquilo', 'normal', 'focado', 'obcecado') then ritmo_pedido else 'normal' end,
    case when objetivo_pedido in ('enem', 'vestibular', 'concurso', 'faculdade', 'curso_tecnico', 'por_conta_propria') then objetivo_pedido end,
    case when meta ->> 'privacidade_aceita' = 'true' then now() end,
    areas
  );
  return new;
end;
$$;

revoke execute on function public.criar_perfil() from public, anon, authenticated;

-- DESFAZER (apaga as áreas já escolhidas; só com backup e confirmação):
-- rode de novo o "create or replace function public.criar_perfil()" da 0001
-- alter table public.perfis drop column if exists areas_interesse;
