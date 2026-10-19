-- Teste da migração 0004 sem deixar rastro: o bloco termina com erro de propósito e o banco desfaz tudo.
-- O relatório vem na mensagem do erro final.
-- Uso: cole a migração 0004 inteira dentro de execute $m$ ... $m$ (no lugar indicado) e rode no SQL Editor.
do $teste$
declare
  a uuid := gen_random_uuid();
  b uuid := gen_random_uuid();
  ma uuid;
  ma2 uuid;
  mb uuid;
  s1 uuid;
  s2 uuid;
  s3 uuid;
  rel text := '';
  n int;
  v text;
begin
  -- [a migração 0004 é executada aqui: execute $m$ ... $m$;]

  insert into auth.users (id, email, aud, role)
  values (a, 'a@teste.pgc', 'authenticated', 'authenticated'), (b, 'b@teste.pgc', 'authenticated', 'authenticated');
  insert into public.materias (usuario_id, nome) values (b, 'Química') returning id into mb;

  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';

  insert into public.materias (nome, area, cor) values ('Física', 'exatas', 'azul') returning id into ma;
  insert into public.materias (nome) values ('Biologia') returning id into ma2;
  select string_agg(nome || ':' || ordem, ',' order by ordem) into v from public.materias;
  rel := rel || '1 A vê só as próprias, em ordem: ' || v || ' (esperado Física:1,Biologia:2)' || E'\n';

  begin
    insert into public.materias (nome) values ('  física ');
    rel := rel || '2 FALHOU: nome repetido aceito' || E'\n';
  exception when unique_violation then
    rel := rel || '2 nome repetido recusado' || E'\n';
  end;

  insert into public.assuntos (materia_id, nome) values (ma, 'Cinemática') returning id into s1;
  insert into public.assuntos (materia_id, nome) values (ma, 'Óptica') returning id into s2;
  insert into public.assuntos (materia_id, nome) values (ma, 'Ondas') returning id into s3;
  select string_agg(nome || ':' || ordem, ',' order by ordem) into v from public.assuntos where materia_id = ma;
  rel := rel || '3 assuntos entram no fim da lista: ' || v || E'\n';

  begin
    insert into public.assuntos (materia_id, nome) values (mb, 'Invasão');
    rel := rel || '4 FALHOU: assunto na matéria de B' || E'\n';
  exception when foreign_key_violation or insufficient_privilege then
    rel := rel || '4 assunto na matéria de B recusado (' || sqlstate || ')' || E'\n';
  end;

  update public.materias set nome = 'Hackeada' where id = mb;
  get diagnostics n = row_count;
  rel := rel || '5 A alterou a matéria de B: ' || n || ' linhas (esperado 0)' || E'\n';

  begin
    update public.materias set usuario_id = b where id = ma;
    rel := rel || '6 FALHOU: A passou a matéria para B' || E'\n';
  exception when insufficient_privilege or foreign_key_violation then
    rel := rel || '6 passar a matéria para outra conta recusado (' || sqlstate || ')' || E'\n';
  end;

  perform public.reordenar_assuntos(ma, array[s3, s1, s2]);
  select string_agg(nome, ',' order by ordem) into v from public.assuntos where materia_id = ma;
  rel := rel || '7 reordenar: ' || v || ' (esperado Ondas,Cinemática,Óptica)' || E'\n';

  update public.assuntos set materia_id = ma2 where id = s2;
  select m.nome || ':' || a2.ordem into v from public.assuntos a2 join public.materias m on m.id = a2.materia_id where a2.id = s2;
  rel := rel || '8 mover assunto para outra matéria: ' || v || ' (esperado Biologia:1)' || E'\n';

  update public.assuntos set arquivado_em = now() where id = s1;
  insert into public.assuntos (materia_id, nome) values (ma, 'cinemática');
  rel := rel || '9 nome de assunto arquivado pode ser usado de novo' || E'\n';

  -- Conferido no catálogo (sem apagar nada): a ligação assunto -> matéria é "on delete cascade".
  select count(*) into n from pg_constraint where conrelid = 'public.assuntos'::regclass and contype = 'f' and confrelid = 'public.materias'::regclass and confdeltype = 'c';
  rel := rel || '10 excluir a matéria apaga os assuntos (cascata): ' || n || ' ligação (esperado 1)' || E'\n';

  execute 'reset role';
  execute 'set local role anon';
  begin
    perform count(*) from public.materias;
    rel := rel || '11 FALHOU: visitante leu matérias' || E'\n';
  exception when insufficient_privilege then
    rel := rel || '11 visitante sem acesso' || E'\n';
  end;

  raise exception E'RELATORIO (tudo desfeito)\n%', rel;
end
$teste$;
