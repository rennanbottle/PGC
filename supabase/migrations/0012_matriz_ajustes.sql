-- Ajustes da matriz de rastreabilidade (06/10).
--   - Cota de IA do PGC: 30 operações de estudo por conta e por dia (antes 10). A geração pela outra IA
--     (modo externa) continua fora da conta, porque não chama serviço do PGC.
--   - Pausa guarda o rascunho: o que estava escrito numa questão ainda não enviada. O rascunho não é corrigido
--     e some quando a resposta é enviada. Só o servidor escreve, como no resto da revisão.

alter table public.revisao_itens add column rascunho jsonb
  check (rascunho is null or (jsonb_typeof(rascunho) = 'object' and pg_column_size(rascunho) <= 8000));

create or replace function public.ia_geracoes_antes_de_inserir()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.modo <> 'externa' and (select count(*) from public.ia_geracoes
      where usuario_id = new.usuario_id and status <> 'falhou' and modo <> 'externa'
        and (criado_em at time zone 'America/Sao_Paulo')::date = (now() at time zone 'America/Sao_Paulo')::date) >= 30 then
    raise exception 'Você já fez as 30 operações com IA de hoje. Amanhã libera de novo; enquanto isso, a geração sem IA e a outra IA continuam abertas.' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create or replace function public.ia_minha_cota()
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select jsonb_build_object(
    'usadas', (select count(*) from public.ia_geracoes
      where usuario_id = (select auth.uid()) and status <> 'falhou' and modo <> 'externa'
        and (criado_em at time zone 'America/Sao_Paulo')::date = (now() at time zone 'America/Sao_Paulo')::date),
    'limite', 30
  );
$$;
