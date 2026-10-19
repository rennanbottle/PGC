-- 0008_ia_so_servidor.sql
-- Ajuste da 0007: escolher modelo e registrar tentativa passam a ser só do servidor (chave secreta do Supabase).
-- Motivo: com as funções abertas a qualquer conta logada, alguém poderia registrar falhas falsas e pausar os modelos.
-- O servidor informa de quem é a tentativa; o limite de 120 registros por pessoa por hora continua.

-- A versão antiga (sem p_usuario) fica no banco, mas ninguém mais pode chamá-la.
revoke execute on function public.ia_registrar(uuid, text, boolean, text, integer, integer, integer) from public, anon, authenticated;

create function public.ia_registrar(
  p_usuario uuid, p_modelo_id uuid, p_tarefa text, p_ok boolean, p_categoria text, p_latencia integer, p_tokens_entrada integer, p_tokens_saida integer
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  m public.ia_modelos;
begin
  if p_usuario is not null and (select count(*) from public.ia_uso where usuario_id = p_usuario and criado_em > now() - interval '1 hour') >= 120 then
    raise exception 'Muitos pedidos à IA nesta hora. Espere um pouco.' using errcode = 'P0001';
  end if;
  select * into m from public.ia_modelos where id = p_modelo_id;
  if not found then
    raise exception 'Modelo desconhecido.' using errcode = 'P0001';
  end if;
  insert into public.ia_uso (usuario_id, modelo_id, provedor, tarefa, resultado, categoria_falha, latencia_ms, tokens_entrada, tokens_saida)
  values (p_usuario, m.id, m.provedor, p_tarefa, case when p_ok then 'ok' else 'falha' end, case when p_ok then null else p_categoria end,
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

create or replace function public.ia_modelos_para(p_tarefa text, p_permite_treino boolean)
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
  where m.ativo
    and (m.pausado_ate is null or m.pausado_ate < now())
    and p_tarefa = any (m.tarefas)
    and (p_permite_treino or not m.treina_com_dados)
  order by m.prioridade, m.modelo;
$$;

revoke execute on function public.ia_registrar(uuid, uuid, text, boolean, text, integer, integer, integer) from public, anon, authenticated;
revoke execute on function public.ia_modelos_para(text, boolean) from public, anon, authenticated;
grant execute on function public.ia_registrar(uuid, uuid, text, boolean, text, integer, integer, integer), public.ia_modelos_para(text, boolean) to service_role;
