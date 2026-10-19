-- Teste da migração 0002 (áreas de interesse) sem deixar rastro: o bloco termina com erro de propósito
-- e o banco desfaz tudo. O relatório vem na mensagem do erro final.
-- Uso: com a 0002 aplicada (ou colada antes deste bloco), rode no SQL Editor.
do $teste$
declare
  a uuid := gen_random_uuid();
  b uuid := gen_random_uuid();
  rel text := '';
  n int;
  v text;
begin
  insert into auth.users (id, email, raw_user_meta_data, aud, role)
  values
    (a, 'a@teste.pgc', '{"nome_exibicao":"Bia","areas_interesse":["exatas","idiomas","exatas"]}', 'authenticated', 'authenticated'),
    (b, 'b@teste.pgc', '{"nome_exibicao":"Caio","areas_interesse":["exatas","astrologia",7]}', 'authenticated', 'authenticated');

  select array_to_string(areas_interesse, ',') into v from public.perfis where id = a;
  rel := rel || '1 áreas de A, sem repetição: ' || v || ' (esperado exatas,idiomas)' || E'\n';
  select array_to_string(areas_interesse, ',') into v from public.perfis where id = b;
  rel := rel || '2 áreas de B, só as válidas: ' || v || ' (esperado exatas)' || E'\n';

  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';

  update public.perfis set areas_interesse = '{humanas,direito}' where id = a;
  get diagnostics n = row_count;
  rel := rel || '3 A trocou as próprias áreas: ' || n || ' linha (esperado 1)' || E'\n';

  begin
    update public.perfis set areas_interesse = '{astrologia}' where id = a;
    rel := rel || '4 FALHOU: área inválida foi aceita' || E'\n';
  exception when check_violation then
    rel := rel || '4 área inválida recusada' || E'\n';
  end;

  update public.perfis set areas_interesse = '{exatas}' where id = b;
  get diagnostics n = row_count;
  rel := rel || '5 A alterou as áreas de B: ' || n || ' linhas (esperado 0)' || E'\n';

  raise exception E'RELATORIO (tudo desfeito)\n%', rel;
end
$teste$;
