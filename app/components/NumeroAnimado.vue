<script setup>
// Número que conta até o valor quando aparece na tela e quando muda. Com "menos movimento", aparece direto.
// Uso: <NumeroAnimado :valor="12" />   <NumeroAnimado :valor="68.5" :casas="1" sufixo="%" />
const props = defineProps({
  valor: { type: Number, default: 0 },
  casas: { type: Number, default: 0 },
  sufixo: { type: String, default: '' },
  duracao: { type: Number, default: 850 },
})
const mostrado = ref(props.valor)
const formato = computed(() => new Intl.NumberFormat('pt-BR', { minimumFractionDigits: props.casas, maximumFractionDigits: props.casas }))
const texto = computed(() => `${formato.value.format(mostrado.value)}${props.sufixo}`)

let quadro = null
function semMovimento() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches || document.documentElement.classList.contains('menos-movimento')
}
function animar(de, para) {
  cancelAnimationFrame(quadro)
  if (semMovimento() || de === para) {
    mostrado.value = para
    return
  }
  const inicio = performance.now()
  const passo = (agora) => {
    const t = Math.min(1, (agora - inicio) / props.duracao)
    const suave = 1 - (1 - t) ** 3
    mostrado.value = de + (para - de) * suave
    if (t < 1) quadro = requestAnimationFrame(passo)
    else mostrado.value = para
  }
  quadro = requestAnimationFrame(passo)
}
onMounted(() => animar(0, props.valor))
watch(() => props.valor, (novo) => animar(mostrado.value, novo))
onBeforeUnmount(() => cancelAnimationFrame(quadro))
</script>

<template>
  <span class="tabular-nums">{{ texto }}</span>
</template>
