<script setup>
// Texto da política de privacidade (versão do projeto de curso; revisar antes de abrir o PGC ao público).
// Usado na página /privacidade e na janela que abre sem tirar a pessoa do cadastro.
defineProps({ nivelTitulo: { type: Number, default: 2 } })

const secoes = [
  {
    titulo: 'O que fica guardado',
    texto: 'E-mail, senha (cifrada, ninguém consegue ler), nome de exibição, apelido, foto, ritmo, objetivo, áreas de estudo, preferências de tela e tudo que você criar no PGC: matérias, materiais, questões, respostas e progresso.',
  },
  {
    titulo: 'Quem vê',
    texto: 'Só você. Cada linha do banco tem dono, e o banco recusa leitura de qualquer outra conta. O ranking, quando existir, mostra apenas o apelido e os pontos de quem escolher participar.',
  },
  {
    titulo: 'Onde fica',
    texto: 'No Supabase (banco e arquivos) e na Vercel (site). Quando você pedir para gerar questões com IA, o trecho do material usado vai para o provedor de IA escolhido pelo servidor, sem seu nome nem e-mail.',
  },
  {
    titulo: 'Para que serve',
    texto: 'Só para fazer o PGC funcionar para você. Nada é vendido, cedido ou usado para anúncio.',
  },
  {
    titulo: 'Seus direitos',
    texto: 'Você pode corrigir seus dados no perfil e pedir a exclusão da conta, que apaga tudo que é seu. Dúvidas sobre os dados: escreva para o responsável pelo projeto.',
  },
]
</script>

<template>
  <div class="flex flex-col gap-4">
    <p class="m-0 text-[14.5px] text-texto-2">Versão de 3 de outubro de 2026.</p>
    <section v-for="s in secoes" :key="s.titulo">
      <component :is="`h${nivelTitulo}`" class="m-0 mb-1 font-serif text-[20px] font-medium">{{ s.titulo }}</component>
      <p class="m-0 text-[15.5px] leading-[1.6]">{{ s.texto }}</p>
    </section>
  </div>
</template>
