<script setup>
// Aviso calmo no topo das telas de entrada (saiu por inatividade, link vencido, e-mail confirmado).
// Ícone e texto, nunca só cor. tipo: 'info' (cinza) ou 'ok' (verde claro).
import { Info } from '@lucide/vue'

defineProps({
  mensagem: { type: String, default: '' },
  icone: { type: [Object, Function], default: () => Info },
  tipo: { type: String, default: 'info' },
})
</script>

<template>
  <div
    v-if="mensagem"
    role="status"
    class="revela flex items-start gap-3 rounded-[12px] px-3.5 py-3 text-[14.5px] leading-[1.45] text-tinta"
    :class="tipo === 'ok' ? 'bg-ok-suave' : 'border border-borda bg-folha-2'"
  >
    <component :is="icone" :size="18" :stroke-width="2" class="mt-px shrink-0" :class="tipo === 'ok' ? 'text-ok' : 'text-texto-2'" aria-hidden="true" />
    <span>{{ mensagem }}</span>
  </div>
</template>
