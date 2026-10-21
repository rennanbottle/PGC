<script setup>
// Botão principal do formulário. Durante o envio, mantém a largura, mostra o indicador e bloqueia o segundo clique.
// "bloqueado" desliga o botão sem indicador (por exemplo, durante a pausa depois de muitas tentativas).
// "icone" (opcional, componente do Lucide) aparece antes do texto.
defineProps({
  carregando: { type: Boolean, default: false },
  bloqueado: { type: Boolean, default: false },
  texto: { type: String, required: true },
  textoCarregando: { type: String, default: '' },
  icone: { type: [Object, Function], default: null },
})
</script>

<template>
  <button type="submit" class="botao" :aria-busy="carregando" :disabled="carregando || bloqueado">
    <svg v-if="carregando" class="gira" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true">
      <path d="M21 12a9 9 0 1 1-6.2-8.6" />
    </svg>
    <component :is="icone" v-else-if="icone" :size="18" :stroke-width="2.1" aria-hidden="true" />
    <span>{{ carregando && textoCarregando ? textoCarregando : texto }}</span>
  </button>
</template>
