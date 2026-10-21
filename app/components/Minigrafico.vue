<script setup>
// Minigráfico de linha: 2 px na cor de destaque, área quase invisível embaixo e o último ponto marcado.
// A linha se desenha uma vez ao aparecer. Sozinho não diz nada a leitores de tela: quem usa escreve o número e o
// período ao lado.
const props = defineProps({
  valores: { type: Array, required: true },
  largura: { type: Number, default: 200 },
  altura: { type: Number, default: 44 },
  cor: { type: String, default: 'var(--acento)' },
})
const pontos = computed(() => {
  const n = props.valores.length
  const maior = Math.max(1, ...props.valores)
  return props.valores.map((v, i) => ({
    x: n > 1 ? 4 + (i * (props.largura - 8)) / (n - 1) : props.largura / 2,
    y: props.altura - 5 - (v / maior) * (props.altura - 12),
  }))
})
const caminho = computed(() => pontos.value.map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' '))
const area = computed(() => {
  if (pontos.value.length < 2) return ''
  const primeiro = pontos.value[0]
  const ultimo = pontos.value.at(-1)
  return `${caminho.value} L${ultimo.x.toFixed(1)} ${props.altura - 4} L${primeiro.x.toFixed(1)} ${props.altura - 4} Z`
})
const ultimo = computed(() => pontos.value.at(-1))
</script>

<template>
  <svg :width="largura" :height="altura" :viewBox="`0 0 ${largura} ${altura}`" class="max-w-full overflow-visible" aria-hidden="true">
    <line x1="4" :x2="largura - 4" :y1="altura - 4" :y2="altura - 4" stroke="var(--borda)" stroke-width="1" />
    <path v-if="area" :d="area" :fill="cor" opacity="0.08" class="aparece" />
    <path :d="caminho" pathLength="1" fill="none" :stroke="cor" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" class="linha-desenha" />
    <circle v-if="ultimo" :cx="ultimo.x" :cy="ultimo.y" r="4" :fill="cor" stroke="var(--folha)" stroke-width="2" class="ponto-final" />
  </svg>
</template>
