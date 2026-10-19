-- Teste da migração 0001 sem deixar rastro: tudo roda dentro de um bloco que termina com erro de propósito,
-- então o banco desfaz tudo sozinho. O relatório vem na mensagem do erro final.
-- Uso: cole a migração 0001 inteira no lugar indicado e rode no SQL Editor (ou pelo Claude).
do $teste$
declare
  a uuid := gen_random_uuid();
  b uuid := gen_random_uuid();
  rel text := '';
  n int;
  v text;
begin
  -- [a migração 0001 é executada antes deste bloco, na mesma transação]

  insert into auth.users (id, email, raw_user_meta_data, aud, role)
  values
    (a, 'a@teste.pgc', '{"nome_exibicao":"  Ana  ","ritmo":"focado","objetivo":"enem","privacidade_aceita":"true"}', 'authenticated', 'authenticated'),
    (b, 'b@teste.pgc', '{"ritmo":"invalido","objetivo":"<script>"}', 'authenticated', 'authenticated');

  select nome_exibicao || '/' || ritmo || '/' || coalesce(objetivo, '-') || '/' || (privacidade_aceita_em is not null)::text into v from public.perfis where id = a;
  rel := rel || '1 perfil A criado: ' || v || E'\n';
  select nome_exibicao || '/' || ritmo || '/' || coalesce(objetivo, '-') || '/' || (privacidade_aceita_em is not null)::text into v from public.perfis where id = b;
  rel := rel || '2 perfil B com dados inválidos corrigidos: ' || v || E'\n';

  -- Agora age como a pessoa A, logada.
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';

  select count(*) into n from public.perfis;
  rel := rel || '3 A enxerga perfis: ' || n || ' (esperado 1)' || E'\n';

  update public.perfis set nome_exibicao = 'Invasora' where id = b;
  get diagnostics n = row_count;
  rel := rel || '4 A alterou o perfil de B: ' || n || ' linhas (esperado 0)' || E'\n';

  update public.perfis set tema = 'escuro' where id = a;
  get diagnostics n = row_count;
  rel := rel || '5 A alterou o próprio tema: ' || n || ' linha (esperado 1)' || E'\n';

  begin
    update public.perfis set privacidade_aceita_em = null where id = a;
    rel := rel || '6 FALHOU: A mudou coluna protegida' || E'\n';
  exception when insufficient_privilege then
    rel := rel || '6 coluna protegida recusada: ok' || E'\n';
  end;

  begin
    insert into public.perfis (id, nome_exibicao) values (gen_random_uuid(), 'Falso');
    rel := rel || '7 FALHOU: A inseriu perfil' || E'\n';
  exception when insufficient_privilege then
    rel := rel || '7 inserir perfil recusado: ok' || E'\n';
  end;

  begin
    delete from public.perfis where id = a;
    rel := rel || '8 FALHOU: A apagou perfil' || E'\n';
  exception when insufficient_privilege then
    rel := rel || '8 apagar perfil recusado: ok' || E'\n';
  end;

  update public.perfis set ritmo = 'obcecado' where id = a;
  rel := rel || '9 primeira troca de ritmo: ok' || E'\n';
  begin
    update public.perfis set ritmo = 'normal' where id = a;
    rel := rel || '10 FALHOU: segunda troca no mesmo dia passou' || E'\n';
  exception when raise_exception then
    rel := rel || '10 segunda troca em menos de 7 dias recusada: ok' || E'\n';
  end;

  execute 'reset role';
  perform set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true);
  execute 'set local role anon';
  begin
    select count(*) into n from public.perfis;
    rel := rel || '11 FALHOU: visitante leu perfis: ' || n || E'\n';
  exception when insufficient_privilege then
    rel := rel || '11 visitante sem login não lê nada: ok' || E'\n';
  end;

  raise exception E'RELATORIO (tudo desfeito)\n%', rel;
end
$teste$;
