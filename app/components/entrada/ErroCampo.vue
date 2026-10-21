<script setup>
// Erro de um campo, logo embaixo dele: ícone, texto em vermelho e um tremor curto.
// "vez" muda a cada nova tentativa: o aviso treme de novo mesmo quando o texto se repete.
// Uso: <EntradaErroCampo id="erro-email" :mensagem="erros.email" :vez="tentativa" />
import { CircleAlert } from '@lucide/vue'

defineProps({
  id: { type: String, default: undefined },
  mensagem: { type: String, default: '' },
  vez: { type: Number, default: 0 },
})
</script>

<template>
  <p v-if="mensagem" :id="id" :key="`${mensagem}-${vez}`" class="erro-campo treme">
    <CircleAlert :size="15" :stroke-width="2.2" class="mt-[2px] shrink-0" aria-hidden="true" />
    <span>{{ mensagem }}</span>
  </p>
</template>
