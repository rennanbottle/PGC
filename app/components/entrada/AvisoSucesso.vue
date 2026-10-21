<script setup>
// Aviso de que deu certo: texto com ícone, anunciado a leitores de tela (nunca só cor).
import { CircleCheck } from '@lucide/vue'

defineProps({ mensagem: { type: String, default: '' } })
</script>

<template>
  <div
    v-if="mensagem"
    role="status"
    class="revela flex items-start gap-2.5 rounded-[10px] border border-borda bg-folha-2 px-3.5 py-3 text-[14.5px] font-semibold leading-[1.45] text-ok"
  >
    <CircleCheck :size="18" :stroke-width="2" class="mt-px shrink-0" aria-hidden="true" />
    <span>{{ mensagem }}</span>
  </div>
</template>
