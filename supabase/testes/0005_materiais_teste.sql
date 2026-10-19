-- Teste da migração 0005 sem deixar rastro: o bloco termina com erro de propósito e o banco desfaz tudo.
-- Uso: cole a migração 0005 inteira dentro de execute $m$ ... $m$ (no lugar indicado) e rode no SQL Editor.
do $teste$
declare
  a uuid := gen_random_uuid();
  b uuid := gen_random_uuid();
  ma uuid;
  mb uuid;
  sa uuid;
  mat uuid;
  matb uuid;
  ver uuid;
  tr uuid;
  rel text := '';
  n int;
  v text;
begin
  -- [a migração 0005 é executada aqui: execute $m$ ... $m$;]

  insert into auth.users (id, email, aud, role)
  values (a, 'a@teste.pgc', 'authenticated', 'authenticated'), (b, 'b@teste.pgc', 'authenticated', 'authenticated');
  insert into public.materias (usuario_id, nome) values (b, 'Química') returning id into mb;
  insert into public.materiais (usuario_id, materia_id, titulo, origem, formato) values (b, mb, 'Material de B', 'arquivo', 'pdf') returning id into matb;

  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';

  insert into public.materias (nome) values ('Física') returning id into ma;
  insert into public.assuntos (materia_id, nome) values (ma, 'Cinemática') returning id into sa;
  insert into public.materiais (materia_id, titulo, origem, formato, arquivo_caminho) values (ma, 'Apostila', 'arquivo', 'pdf', a::text || '/x/original.pdf') returning id into mat;
  insert into public.material_versoes (material_id) values (mat) returning id into ver;
  insert into public.material_paginas (versao_id, numero, palavras) values (ver, 1, 120), (ver, 2, 98);
  insert into public.material_trechos (versao_id, ordem, pagina, tipo, texto, assunto_id)
    values (ver, 1, 1, 'texto', 'A velocidade média é a razão entre o deslocamento e o tempo.', sa) returning id into tr;
  insert into public.conceitos (versao_id, trecho_id, tipo, termo, definicao, pagina) values (ver, tr, 'definicao', 'Velocidade média', 'razão entre o deslocamento e o tempo', 1);
  select count(*) into n from public.materiais;
  rel := rel || '1 A cria material, versão, páginas, trecho e conceito; vê materiais: ' || n || ' (esperado 1)' || E'\n';

  begin
    insert into public.materiais (materia_id, titulo, origem, formato) values (mb, 'Invasão', 'arquivo', 'pdf');
    rel := rel || '2 FALHOU: material na matéria de B' || E'\n';
  exception when foreign_key_violation or insufficient_privilege then
    rel := rel || '2 material na matéria de B recusado (' || sqlstate || ')' || E'\n';
  end;

  begin
    insert into public.material_versoes (material_id) values (matb);
    rel := rel || '3 FALHOU: versão no material de B' || E'\n';
  exception when foreign_key_violation or insufficient_privilege then
    rel := rel || '3 versão no material de B recusada (' || sqlstate || ')' || E'\n';
  end;

  begin
    update public.materiais set arquivo_caminho = b::text || '/x/original.pdf' where id = mat;
    rel := rel || '4 FALHOU: caminho na pasta de B aceito' || E'\n';
  exception when check_violation then
    rel := rel || '4 caminho de arquivo fora da própria pasta recusado' || E'\n';
  end;

  select count(*) into n from public.material_trechos where busca @@ websearch_to_tsquery('portuguese', 'velocidades');
  rel := rel || '5 busca no texto acha "velocidades" pelo radical: ' || n || ' (esperado 1)' || E'\n';

  update public.assuntos set arquivado_em = now() where id = sa;
  execute 'reset role';
  -- Sem apagar nada: confere no catálogo que apagar o assunto só limpa a ligação do trecho (set null na coluna do assunto).
  select count(*) into n from pg_constraint where conrelid = 'public.material_trechos'::regclass and contype = 'f' and confrelid = 'public.assuntos'::regclass and confdeltype = 'n';
  rel := rel || '6 apagar assunto só solta o trecho (set null): ' || n || ' ligação (esperado 1)' || E'\n';
  select count(*) into n from pg_constraint where conrelid = 'public.materiais'::regclass and contype = 'f' and confrelid = 'public.materias'::regclass and confdeltype = 'c';
  rel := rel || '7 apagar a matéria leva os materiais junto (cascata): ' || n || ' (esperado 1)' || E'\n';

  execute 'set local role anon';
  begin
    perform count(*) from public.material_trechos;
    rel := rel || '8 FALHOU: visitante leu trechos' || E'\n';
  exception when insufficient_privilege then
    rel := rel || '8 visitante sem acesso' || E'\n';
  end;

  execute 'reset role';
  select public::text || ',' || file_size_limit::text into v from storage.buckets where id = 'materiais';
  rel := rel || '9 bucket materiais privado e com limite: ' || v || ' (esperado false,10485760)' || E'\n';

  raise exception E'RELATORIO (tudo desfeito)\n%', rel;
end
$teste$;
