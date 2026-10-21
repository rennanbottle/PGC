<script setup>
// Anel da meta do dia. Enche ao aparecer; fica verde (com o visto ao lado, escrito por quem usa) ao bater a meta.
// Sozinho não diz nada a leitores de tela: quem usa escreve o número ao lado.
const props = defineProps({
  feitas: { type: Number, default: 0 },
  meta: { type: Number, default: 20 },
  tamanho: { type: Number, default: 26 },
  espessura: { type: Number, default: 3.5 },
})
const centro = computed(() => props.tamanho / 2)
const raio = computed(() => (props.tamanho - props.espessura) / 2)
const volta = computed(() => 2 * Math.PI * raio.value)
const fracao = computed(() => (props.meta > 0 ? Math.min(1, props.feitas / props.meta) : 0))
</script>

<template>
  <svg :width="tamanho" :height="tamanho" :viewBox="`0 0 ${tamanho} ${tamanho}`" class="shrink-0" aria-hidden="true">
    <circle :cx="centro" :cy="centro" :r="raio" fill="none" stroke="var(--folha-3)" :stroke-width="espessura" />
    <circle
      v-if="fracao > 0"
      :cx="centro"
      :cy="centro"
      :r="raio"
      fill="none"
      :stroke="fracao >= 1 ? 'var(--ok-vivo)' : 'var(--acento)'"
      :stroke-width="espessura"
      stroke-linecap="round"
      :stroke-dasharray="`${volta * fracao} ${volta}`"
      :transform="`rotate(-90 ${centro} ${centro})`"
      class="anel-enche transition-[stroke-dasharray] duration-700"
    />
  </svg>
</template>
