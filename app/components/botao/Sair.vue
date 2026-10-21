<script setup>
// Botão de sair da conta: um círculo com o ícone que se abre mostrando "Sair" ao passar o mouse.
// No celular (sem mouse) já aparece aberto.
import { LogOut } from '@lucide/vue'

defineProps({
  texto: { type: String, default: 'Sair' },
  carregando: { type: Boolean, default: false },
})
</script>

<template>
  <button type="button" class="botao-sair" :aria-busy="carregando || undefined" :disabled="carregando">
    <span class="botao-sair-icone">
      <span v-if="carregando" class="rodando" aria-hidden="true" />
      <LogOut v-else :size="18" :stroke-width="2.2" aria-hidden="true" />
    </span>
    <span class="botao-sair-texto">{{ texto }}</span>
  </button>
</template>
