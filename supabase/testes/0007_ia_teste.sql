-- Teste da migração 0007 sem deixar rastro: o bloco termina com erro de propósito e o banco desfaz tudo.
-- Uso: cole a migração 0007 inteira dentro de execute $m$ ... $m$ (no lugar indicado) e rode no SQL Editor.
do $teste$
declare
  a uuid := gen_random_uuid();
  ma uuid;
  groq uuid;
  rel text := '';
  n int;
  v text;
  r jsonb;
  ok boolean;
begin
  -- [a migração 0007 é executada aqui: execute $m$ ... $m$;]

  insert into auth.users (id, email, aud, role) values (a, 'a@teste.pgc', 'authenticated', 'authenticated');
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';

  begin
    perform count(*) from public.ia_modelos;
    rel := rel || '1 FALHOU: app leu o catálogo direto' || E'\n';
  exception when insufficient_privilege then
    rel := rel || '1 catálogo fechado para leitura direta' || E'\n';
  end;

  select count(*), string_agg(provedor || ':' || modelo, ', ' order by prioridade) into n, v from public.ia_modelos_para('gerar', false);
  rel := rel || '2 modelos para gerar sem treino: ' || n || ' (' || v || ') (esperado 2: Groq 120b, Cloudflare)' || E'\n';
  select count(*) into n from public.ia_modelos_para('gabarito', false);
  rel := rel || '3 modelos para gabarito: ' || n || ' (esperado 3)' || E'\n';

  select id into groq from public.ia_modelos_para('gerar', false) limit 1;
  perform public.ia_registrar(groq, 'gerar', false, 'limite', 900, 0, 0);
  perform public.ia_registrar(groq, 'gerar', false, 'tempo_esgotado', 40000, 0, 0);
  select count(*) into n from public.ia_modelos_para('gerar', false);
  rel := rel || '4 depois de 2 falhas o Groq continua: ' || n || ' (esperado 2)' || E'\n';
  perform public.ia_registrar(groq, 'gerar', false, 'saida_invalida', 5000, 3000, 2500);
  select count(*), string_agg(provedor, ',') into n, v from public.ia_modelos_para('gerar', false);
  rel := rel || '5 na 3ª falha o Groq pausa: sobram ' || n || ' (' || v || ') (esperado 1, cloudflare)' || E'\n';
  select tokens_entrada_hoje::text || '/' || tokens_saida_hoje::text into v from public.ia_modelos_para('gabarito', false) where provedor = 'groq';
  rel := rel || '6 tokens do Groq hoje somados no 20b: ' || coalesce(v, 'nada') || ' (esperado 3000/2500)' || E'\n';

  insert into public.materias (nome) values ('Física') returning id into ma;
  for i in 1..10 loop
    insert into public.ia_geracoes (materia_id, pedidas) values (ma, 10);
  end loop;
  begin
    insert into public.ia_geracoes (materia_id, pedidas) values (ma, 10);
    rel := rel || '7 FALHOU: 11ª geração aceita' || E'\n';
  exception when raise_exception then
    rel := rel || '7 11ª geração do dia recusada: ' || sqlerrm || E'\n';
  end;
  update public.ia_geracoes set status = 'falhou' where id = (select id from public.ia_geracoes limit 1);
  insert into public.ia_geracoes (materia_id, pedidas) values (ma, 5);
  r := public.ia_minha_cota();
  rel := rel || '8 geração que falhou não conta; cota: ' || r::text || ' (esperado usadas 10, limite 10)' || E'\n';

  select public.sou_dono() into ok;
  rel := rel || '9 pessoa comum não é dono: ' || (not ok) || E'\n';
  begin
    r := public.ia_diagnostico();
    rel := rel || '10 FALHOU: diagnóstico aberto para quem não é dono' || E'\n';
  exception when insufficient_privilege then
    rel := rel || '10 diagnóstico recusado para quem não é dono' || E'\n';
  end;

  execute 'reset role';
  insert into public.sistema_donos (usuario_id) values (a);
  execute 'set local role authenticated';
  r := public.ia_diagnostico();
  rel := rel || '11 dono vê o diagnóstico: modelos ' || jsonb_array_length(r -> 'modelos') || ', dias ' || jsonb_array_length(r -> 'dias')
    || ', falhas ' || (r ->> 'falhas') || ' (esperado 5, 14, limite 1, tempo 1, saída 1)' || E'\n';

  execute 'reset role';
  execute 'set local role anon';
  begin
    perform public.ia_minha_cota();
    rel := rel || '12 FALHOU: visitante chamou a cota' || E'\n';
  exception when insufficient_privilege then
    rel := rel || '12 visitante sem acesso às funções de IA' || E'\n';
  end;

  execute 'reset role';
  raise exception E'RESULTADO (desfeito de propósito)\n%', rel;
end;
$teste$;
