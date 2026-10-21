<script setup>
// Modo foco (revisão e, depois, prova): sem menu, sem busca, sem barra de baixo. A própria tela tem a barra com o
// progresso e o botão Sair, que pergunta antes de sair.
</script>

<template>
  <div class="min-h-dvh bg-folha">
    <a href="#conteudo" class="pular">Pular para a questão</a>
    <main id="conteudo" tabindex="-1" class="outline-none">
      <slot />
    </main>
  </div>
</template>
