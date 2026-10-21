<script setup>
// Ícone de cada tipo de questão (e das técnicas que tiram questões do texto). Sempre com o nome ao lado, escrito
// por quem usa: o ícone sozinho não diz nada a leitores de tela. O mapa mora em useQuestoes.js (ICONES_TIPO).
import { CircleHelp } from '@lucide/vue'

const props = defineProps({
  tipo: { type: String, default: '' },
  tamanho: { type: Number, default: 18 },
})
const icone = computed(() => ICONES_TIPO[props.tipo] ?? CircleHelp)
</script>

<template>
  <component :is="icone" :size="tamanho" :stroke-width="2" aria-hidden="true" />
</template>
