<script setup>
// Botão redondo de apagar (só ícone). Fica vermelho e abre a tampa ao passar o mouse.
// Sempre com rótulo para leitores de tela: <BotaoLixeira rotulo="Apagar o assunto Funções" @click="..." />
defineProps({
  rotulo: { type: String, required: true },
  desativado: { type: Boolean, default: false },
})
</script>

<template>
  <button type="button" class="botao-icone pequeno botao-lixeira" :aria-label="rotulo" :title="rotulo" :disabled="desativado">
    <BotaoLixeiraIcone :size="17" />
  </button>
</template>
