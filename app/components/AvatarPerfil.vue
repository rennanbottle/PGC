<script setup>
// Foto de perfil redonda. Sem foto, mostra a inicial do nome sobre uma cor que vem do próprio nome
// (a mesma pessoa tem sempre a mesma cor). A letra é desenhada num SVG centralizado: nunca fica torta.
import { User } from '@lucide/vue'
import { inicialDoNome } from '#shared/regras/perfil.js'

const props = defineProps({
  src: { type: String, default: null },
  nome: { type: String, default: '' },
  tamanho: { type: Number, default: 60 },
  tracejado: { type: Boolean, default: false },
})
const inicial = computed(() => inicialDoNome(props.nome))
const CORES = ['azul', 'verde', 'laranja', 'roxo', 'rosa', 'vermelho']
const cor = computed(() => {
  let soma = 0
  for (const letra of String(props.nome ?? '')) soma = (soma * 31 + letra.codePointAt(0)) % 997
  return `${corMateria(CORES[soma % CORES.length])}`
})
</script>

<template>
  <span
    class="relative grid shrink-0 place-items-center overflow-hidden rounded-full"
    :class="!src && !inicial ? 'border border-borda-forte bg-folha-2 text-texto-3' : ''"
    :style="{ width: `${tamanho}px`, height: `${tamanho}px`, background: !src && inicial ? cor : undefined }"
  >
    <img v-if="src" :src="src" alt="" class="size-full object-cover">
    <svg v-else-if="inicial" viewBox="0 0 100 100" class="size-full" aria-hidden="true">
      <text
        x="50"
        y="52"
        text-anchor="middle"
        dominant-baseline="central"
        fill="var(--sobre-marca)"
        font-family="'Bricolage Grotesque', 'Onest', sans-serif"
        font-weight="700"
        font-size="48"
      >{{ inicial }}</text>
    </svg>
    <User v-else :size="Math.round(tamanho * 0.48)" :stroke-width="1.8" aria-hidden="true" />
  </span>
</template>
