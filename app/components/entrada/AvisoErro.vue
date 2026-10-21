<script setup>
// Mensagem de erro do formulário: ícone e texto em vermelho (nunca só cor), anunciada a leitores de tela.
// Treme ao aparecer. "caixa" põe um fundo vermelho claro (falha ao entrar, logo acima do botão).
// "vez" muda a cada nova tentativa: treme de novo mesmo quando o texto se repete.
import { CircleAlert } from '@lucide/vue'

defineProps({
  mensagem: { type: String, default: '' },
  caixa: { type: Boolean, default: false },
  vez: { type: Number, default: 0 },
})
</script>

<template>
  <div
    v-if="mensagem"
    :key="`${mensagem}-${vez}`"
    role="alert"
    class="treme flex items-start gap-2.5 text-[14.5px] font-semibold leading-[1.45] text-erro"
    :class="caixa && 'rounded-[12px] bg-erro-suave px-3.5 py-3'"
  >
    <CircleAlert :size="18" :stroke-width="2.1" class="mt-px shrink-0" aria-hidden="true" />
    <span>{{ mensagem }}<slot /></span>
  </div>
</template>
