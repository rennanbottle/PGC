-- 0015_ajustes_teste_escola.sql
-- Ajustes depois do teste do R (11/10/2026). Só alarga regras e muda um padrão: nenhum dado é apagado.
--   - Gerar até 20 questões por vez também com a IA do PGC (ia_geracoes.pedidas ia só até 10).
--   - Cor da matéria: além das 8 cores com nome, qualquer cor no formato #rrggbb (seletor de cor).
--   - Saída por inatividade ligada por padrão (30 minutos), pedido do R para os computadores da escola.
--     Quem ainda não tinha escolhido (vazio) passa a 30; dá para trocar para "Nunca" no perfil.

alter table public.ia_geracoes drop constraint if exists ia_geracoes_pedidas_check;
alter table public.ia_geracoes add constraint ia_geracoes_pedidas_check check (pedidas between 0 and 40);

alter table public.materias drop constraint if exists materias_cor_check;
alter table public.materias add constraint materias_cor_check
  check (cor in ('azul', 'verde', 'laranja', 'roxo', 'vermelho', 'amarelo', 'rosa', 'cinza') or cor ~ '^#[0-9a-fA-F]{6}$');

alter table public.perfis alter column sair_inativo_min set default 30;
update public.perfis set sair_inativo_min = 30 where sair_inativo_min is null;

-- DESFAZER (antes, volte as matérias com cor #rrggbb para uma cor com nome):
-- alter table public.perfis alter column sair_inativo_min drop default;
-- alter table public.materias drop constraint materias_cor_check;
-- alter table public.materias add constraint materias_cor_check check (cor in ('azul', 'verde', 'laranja', 'roxo', 'vermelho', 'amarelo', 'rosa', 'cinza'));
-- alter table public.ia_geracoes drop constraint ia_geracoes_pedidas_check;
-- alter table public.ia_geracoes add constraint ia_geracoes_pedidas_check check (pedidas between 0 and 10);
