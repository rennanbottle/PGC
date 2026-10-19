-- Teste da migração 0006 sem deixar rastro: o bloco termina com erro de propósito e o banco desfaz tudo.
-- Uso: cole a migração 0006 inteira dentro de execute $m$ ... $m$ (no lugar indicado) e rode no SQL Editor.
do $teste$
declare
  a uuid := gen_random_uuid();
  b uuid := gen_random_uuid();
  ma uuid;
  ma2 uuid;
  mb uuid;
  sa uuid;
  sa2 uuid;
  mat uuid;
  ver uuid;
  tr uuid;
  con uuid;
  q1 uuid;
  q2 uuid;
  q3 uuid;
  rel text := '';
  n int;
  v text;
  r jsonb;
  ok boolean;
begin
  -- [a migração 0006 é executada aqui: execute $m$ ... $m$;]

  insert into auth.users (id, email, aud, role)
  values (a, 'a@teste.pgc', 'authenticated', 'authenticated'), (b, 'b@teste.pgc', 'authenticated', 'authenticated');
  insert into public.materias (usuario_id, nome) values (b, 'Química') returning id into mb;

  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';

  insert into public.materias (nome) values ('Física') returning id into ma;
  insert into public.materias (nome) values ('Biologia') returning id into ma2;
  insert into public.assuntos (materia_id, nome) values (ma, 'Queda livre') returning id into sa;
  insert into public.assuntos (materia_id, nome) values (ma2, 'Citologia') returning id into sa2;
  insert into public.materiais (materia_id, titulo, origem, formato) values (ma, 'Apostila', 'arquivo', 'pdf') returning id into mat;
  insert into public.material_versoes (material_id) values (mat) returning id into ver;
  insert into public.material_trechos (versao_id, ordem, pagina, tipo, texto) values (ver, 1, 1, 'texto', 'Trajetória é o conjunto de posições ocupadas por um móvel.') returning id into tr;
  insert into public.conceitos (versao_id, trecho_id, tipo, termo, definicao, pagina, status) values (ver, tr, 'definicao', 'Trajetória', 'é o conjunto de posições', 1, 'aprovado') returning id into con;

  insert into public.questoes (materia_id, assunto_id, tipo, enunciado, conteudo, origem)
    values (ma, sa, 'multipla_escolha', 'Uma pedra cai por 3 s. Qual a altura?', '{"alternativas":[]}', 'minha') returning id into q1;
  select em_revisao, dificuldade_b::text into ok, v from public.questoes where id = q1;
  rel := rel || '1 A cria questão: nas revisões ' || ok || ', dificuldade inicial ' || v || ' (esperado true, -0.5)' || E'\n';

  begin
    insert into public.questoes (materia_id, tipo, enunciado, origem) values (mb, 'cartao', 'Invasão', 'minha');
    rel := rel || '2 FALHOU: questão na matéria de B' || E'\n';
  exception when foreign_key_violation or insufficient_privilege then
    rel := rel || '2 questão na matéria de B recusada (' || sqlstate || ')' || E'\n';
  end;

  begin
    insert into public.questoes (materia_id, assunto_id, tipo, enunciado, origem) values (ma, sa2, 'cartao', 'Assunto trocado', 'minha');
    rel := rel || '3 FALHOU: assunto de outra matéria aceito' || E'\n';
  exception when raise_exception then
    rel := rel || '3 assunto de outra matéria recusado: ' || sqlerrm || E'\n';
  end;

  update public.questoes set nivel = 4 where id = q1;
  select dificuldade_b::text into v from public.questoes where id = q1;
  rel := rel || '4 nível muito difícil ajusta a dificuldade inicial: ' || v || ' (esperado 1.3)' || E'\n';

  update public.questoes set gabarito_confirmado = false where id = q1;
  select em_revisao into ok from public.questoes where id = q1;
  rel := rel || '5 sem gabarito confirmado sai das revisões: ' || (not ok) || E'\n';
  update public.questoes set resolver_comparar = true where id = q1;
  select em_revisao into ok from public.questoes where id = q1;
  rel := rel || '6 "resolver e comparar" volta para as revisões: ' || ok || E'\n';

  insert into public.questoes (materia_id, tipo, enunciado, origem, precisa_imagem) values (ma, 'multipla_escolha', 'Observe o gráfico.', 'importada', true) returning id into q2;
  select em_revisao into ok from public.questoes where id = q2;
  rel := rel || '7 questão que precisa da imagem fica fora: ' || (not ok);
  update public.questoes set imagem_caminho = a::text || '/' || q2::text || '/imagem.jpg' where id = q2;
  select em_revisao into ok from public.questoes where id = q2;
  rel := rel || '; com a imagem entra: ' || ok || E'\n';

  begin
    update public.questoes set imagem_caminho = b::text || '/x/imagem.jpg' where id = q2;
    rel := rel || '8 FALHOU: imagem na pasta de B aceita' || E'\n';
  exception when check_violation then
    rel := rel || '8 imagem fora da própria pasta recusada' || E'\n';
  end;

  insert into public.questoes (materia_id, material_id, versao_id, trecho_id, conceito_id, tipo, enunciado, origem, chave)
    values (ma, mat, ver, tr, con, 'lacuna_digitada', '______ é o conjunto de posições ocupadas por um móvel.', 'material', 'lacuna:' || con::text) returning id into q3;
  update public.material_trechos set tipo = 'texto' where id = tr;
  select material_mudou into ok from public.questoes where id = q3;
  rel := rel || '9 mudar só o tipo do trecho não marca a questão: ' || (not ok) || E'\n';
  update public.material_trechos set texto = 'Trajetória é a linha formada pelas posições de um móvel.' where id = tr;
  select material_mudou, em_revisao into ok, n from (select material_mudou, em_revisao::int as em_revisao from public.questoes where id = q3) x;
  rel := rel || '10 mudar o texto do trecho marca a questão: ' || ok || ', nas revisões ' || n || ' (esperado true, 0)' || E'\n';
  update public.questoes set material_mudou = false where id = q3;
  update public.conceitos set status = 'recusado' where id = con;
  select material_mudou into ok from public.questoes where id = q3;
  rel := rel || '11 recusar o conceito marca a questão: ' || ok || E'\n';

  begin
    insert into public.questoes (materia_id, tipo, enunciado, origem, chave) values (ma, 'cartao', 'De novo', 'material', 'lacuna:' || con::text);
    rel := rel || '12 FALHOU: geração repetida aceita' || E'\n';
  exception when unique_violation then
    rel := rel || '12 mesma geração sem IA não entra duas vezes' || E'\n';
  end;

  r := public.resumo_questoes();
  rel := rel || '13 resumo: ativas ' || (r ->> 'total') || ', nas revisões ' || (r ->> 'em_revisao') || ', material mudou ' || (r -> 'fora' ->> 'material')
    || ', por nível ' || (r ->> 'por_nivel') || ', dias ' || jsonb_array_length(r -> 'dias') || ' (esperado 3, 2, 1, [0, 2, 0, 1, 0], 14)' || E'\n';

  execute 'reset role';
  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  select count(*) into n from public.questoes;
  r := public.resumo_questoes();
  rel := rel || '14 B não vê as questões de A: ' || n || ', resumo de B ' || (r ->> 'total') || ' (esperado 0, 0)' || E'\n';

  execute 'reset role';
  -- Sem apagar nada: confere no catálogo as ligações e os gatilhos.
  select count(*) into n from pg_trigger where tgrelid = 'public.material_trechos'::regclass and tgname = 'material_trechos_saiu' and (tgtype & 2) = 2 and (tgtype & 8) = 8;
  rel := rel || '15 gatilho antes de apagar trecho (juntar na conferência): ' || n || ' (esperado 1)' || E'\n';
  select count(*) into n from pg_constraint where conrelid = 'public.questoes'::regclass and contype = 'f' and confdeltype = 'n';
  rel := rel || '16 ligações que só soltam a questão (assunto, material, versão, trecho, conceito, banco): ' || n || ' (esperado 6)' || E'\n';
  select count(*) into n from pg_constraint where conrelid = 'public.questoes'::regclass and contype = 'f' and confrelid = 'public.materias'::regclass and confdeltype = 'c';
  rel := rel || '17 apagar a matéria leva as questões (cascata): ' || n || ' (esperado 1)' || E'\n';

  execute 'set local role anon';
  begin
    perform count(*) from public.questoes;
    rel := rel || '18 FALHOU: visitante leu questões' || E'\n';
  exception when insufficient_privilege then
    rel := rel || '18 visitante sem acesso às questões' || E'\n';
  end;
  begin
    perform public.resumo_questoes();
    rel := rel || '19 FALHOU: visitante chamou o resumo' || E'\n';
  exception when insufficient_privilege then
    rel := rel || '19 visitante não chama o resumo' || E'\n';
  end;

  execute 'reset role';
  select string_agg(id || ':' || public::text || ':' || file_size_limit::text, ', ' order by id) into v from storage.buckets where id in ('bancos', 'questoes');
  rel := rel || '20 buckets: ' || v || ' (esperado bancos:false:10485760, questoes:false:2097152)' || E'\n';
  select count(*) into n from pg_policies where schemaname = 'storage' and tablename = 'objects' and (policyname like 'bancos:%' or policyname like 'questoes:%');
  rel := rel || '21 políticas de arquivo: ' || n || ' (esperado 8)' || E'\n';

  raise exception E'RESULTADO (desfeito de propósito)\n%', rel;
end;
$teste$;
