-- 0009_material_fonte.sql
-- Material vindo de fonte aberta (Wikipédia): endereço da página e licença, para citar a fonte como a licença pede.
-- Só acrescenta colunas. O material segue como arquivo TXT guardado na pasta da pessoa.
alter table public.materiais
  add column fonte_url text check (fonte_url is null or (fonte_url like 'https://%' and char_length(fonte_url) <= 500)),
  add column fonte_licenca text check (fonte_licenca is null or char_length(fonte_licenca) <= 80);
