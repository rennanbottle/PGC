-- 0016_geradas_direto_no_estudo.sql
-- Pedido do R (11/10/2026): sem o passo "Manter". Questão gerada pela IA entra direto no Estudar, e a resposta só
-- aparece quando a pessoa responde. Questão com problema sai dos estudos pela correção ("Questão com problema").
-- Nada é apagado:
--   1. Questões geradas que são cópia dos exemplos do pedido da "Outra IA" (algumas IAs copiaram os exemplos em vez
--      de escrever sobre o assunto) vão para as arquivadas. Ficam no banco, fora dos estudos.
--   2. As outras questões geradas que esperavam confirmação passam a valer no Estudar.
-- Questões importadas de arquivo sem resposta continuam esperando: lá falta mesmo a resposta certa.

update public.questoes
   set status = 'arquivada'
 where origem = 'gerada'
   and status = 'ativa'
   and (trim(enunciado) in (
          'Um ônibus percorre 120 km em 2 horas, sempre na mesma velocidade. Qual é a velocidade média dele?',
          'Ao nível do mar, a água pura ferve a 100 °C.',
          'Um tênis custa R$ 80,00 e está com 25% de desconto. Quanto ele passa a custar, em reais?',
          'Segundo o texto, por que o lixo acumulado na rua faz a cidade alagar mais?',
          'A fotossíntese libera gás oxigênio para o ambiente.',
          'Quais destas fontes de energia são renováveis?',
          'A capital do Brasil é ______.',
          'Em qual passo está o erro desta resolução de 2x + 6 = 14?',
          'Uma bola é solta do alto de um prédio e cai sem resistência do ar. O que acontece com a velocidade dela durante a queda?')
        or conteudo->>'assercao' = 'O gelo flutua na água líquida.');

update public.questoes
   set gabarito_confirmado = true
 where origem = 'gerada'
   and not gabarito_confirmado
   and not resolver_comparar;

-- DESFAZER: não há o que desfazer na estrutura. Uma questão arquivada volta pelo banco de questões
-- (filtro "Arquivadas", ação "Desarquivar").
