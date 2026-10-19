-- Teste da migração 0003 sem deixar rastro: o bloco termina com erro de propósito e o banco desfaz tudo.
-- O relatório vem na mensagem do erro final.
-- Uso: cole a migração 0003 inteira no lugar indicado (dentro de execute $m$ ... $m$) e rode no SQL Editor.
do $teste$
declare
  a uuid := gen_random_uuid();
  b uuid := gen_random_uuid();
  c uuid := gen_random_uuid();
  d uuid := gen_random_uuid();
  rel text := '';
  n int;
  v text;
begin
  -- [a migração 0003 é executada antes deste bloco, na mesma transação]

  insert into auth.users (id, email, raw_user_meta_data, aud, role)
  values
    (a, 'a@teste.pgc', '{"nome_exibicao":"Bia","apelido":"Bia_Estuda"}', 'authenticated', 'authenticated'),
    (b, 'b@teste.pgc', '{"nome_exibicao":"Caio","apelido":"bia_estuda"}', 'authenticated', 'authenticated'),
    (c, 'c@teste.pgc', '{"nome_exibicao":"Duda","apelido":"x"}', 'authenticated', 'authenticated'),
    (d, 'd@teste.pgc', '{"nome_exibicao":"Edu","apelido":"com espaco"}', 'authenticated', 'authenticated');

  select coalesce(apelido, '-') into v from public.perfis where id = a;
  rel := rel || '1 apelido de A: ' || v || ' (esperado Bia_Estuda)' || E'\n';
  select coalesce(apelido, '-') into v from public.perfis where id = b;
  rel := rel || '2 B com apelido repetido (outra caixa) ficou sem: ' || v || ' (esperado -)' || E'\n';
  select count(*) into n from public.perfis where id in (c, d) and apelido is null;
  rel := rel || '3 apelido curto e com espaço recusados: ' || n || ' de 2 (esperado 2)' || E'\n';
  select count(*) into n from public.perfis where id in (a, b, c, d);
  rel := rel || '4 os 4 cadastros criaram perfil: ' || n || ' (esperado 4)' || E'\n';

  -- Um arquivo de B, colocado antes de trocar de papel.
  insert into storage.objects (bucket_id, name, owner) values ('avatares', b::text || '/avatar.jpg', b);

  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';

  update public.perfis set apelido = 'Bia_Nova' where id = a;
  get diagnostics n = row_count;
  rel := rel || '5 A trocou o próprio apelido: ' || n || ' linha (esperado 1)' || E'\n';

  update public.perfis set apelido = 'Bia_Nova' where id = b;
  get diagnostics n = row_count;
  rel := rel || '6 A mexeu no apelido de B: ' || n || ' linhas (esperado 0)' || E'\n';

  begin
    update public.perfis set apelido = 'bia nova' where id = a;
    rel := rel || '7 FALHOU: apelido com espaço aceito' || E'\n';
  exception when check_violation then
    rel := rel || '7 apelido com espaço recusado' || E'\n';
  end;

  begin
    update public.perfis set avatar_caminho = b::text || '/avatar.jpg' where id = a;
    rel := rel || '8 FALHOU: A apontou para a foto de B' || E'\n';
  exception when check_violation then
    rel := rel || '8 apontar para a foto de outra pessoa recusado' || E'\n';
  end;

  update public.perfis set avatar_caminho = a::text || '/avatar.jpg' where id = a;
  get diagnostics n = row_count;
  rel := rel || '9 A apontou para a própria foto: ' || n || ' linha (esperado 1)' || E'\n';

  select count(*) into n from storage.objects where bucket_id = 'avatares';
  rel := rel || '10 A enxerga arquivos de avatares: ' || n || ' (esperado 0, o único é de B)' || E'\n';

  insert into storage.objects (bucket_id, name, owner) values ('avatares', a::text || '/avatar.jpg', a);
  select count(*) into n from storage.objects where bucket_id = 'avatares';
  rel := rel || '11 A enviou o próprio arquivo e agora enxerga: ' || n || ' (esperado 1)' || E'\n';

  begin
    insert into storage.objects (bucket_id, name, owner) values ('avatares', b::text || '/outro.jpg', a);
    rel := rel || '12 FALHOU: A enviou para a pasta de B' || E'\n';
  exception when insufficient_privilege then
    rel := rel || '12 envio para a pasta de B recusado' || E'\n';
  end;

  raise exception E'RELATORIO (tudo desfeito)\n%', rel;
end
$teste$;
