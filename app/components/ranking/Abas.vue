<script setup>
// Duas ou três abas lado a lado com o marcador que desliza até a escolhida (Você / Geral; Semana / Mês / Geral).
// Teclado: setas, Home e End trocam de aba. Cada aba controla o painel com id `${idBase}-painel-${valor}`.
const modelo = defineModel({ type: String, required: true })
const props = defineProps({
  abas: { type: Array, required: true },
  rotulo: { type: String, required: true },
  idBase: { type: String, required: true },
  pequena: { type: Boolean, default: false },
})
const botoes = ref([])
const indice = computed(() => Math.max(0, props.abas.findIndex((a) => a.valor === modelo.value)))
function teclar(evento, i) {
  const n = props.abas.length
  const destino = { ArrowRight: (i + 1) % n, ArrowLeft: (i - 1 + n) % n, Home: 0, End: n - 1 }[evento.key]
  if (destino === undefined) return
  evento.preventDefault()
  modelo.value = props.abas[destino].valor
  nextTick(() => botoes.value[destino]?.focus())
}
</script>

<template>
  <div
    role="tablist"
    :aria-label="rotulo"
    class="abas-deslizantes relative grid rounded-[14px] border border-borda bg-folha p-1"
    :style="{ gridTemplateColumns: `repeat(${abas.length}, minmax(0, 1fr))`, '--n': abas.length, '--i': indice }"
  >
    <span class="abas-marcador" aria-hidden="true" />
    <button
      v-for="(a, i) in abas"
      :id="`${idBase}-aba-${a.valor}`"
      :key="a.valor"
      ref="botoes"
      type="button"
      role="tab"
      class="relative z-[1] flex items-center justify-center gap-2 rounded-[10px] px-4 font-semibold transition-colors"
      :class="[pequena ? 'h-9 text-[14px]' : 'h-10 text-[14.5px]', a.valor === modelo ? 'text-acento' : 'text-texto-2 hover:text-tinta']"
      :aria-selected="a.valor === modelo"
      :aria-controls="`${idBase}-painel-${a.valor}`"
      :tabindex="a.valor === modelo ? 0 : -1"
      :data-guia="a.guia || undefined"
      @click="modelo = a.valor"
      @keydown="teclar($event, i)"
    >
      <component :is="a.icone" v-if="a.icone" :size="pequena ? 16 : 17" :stroke-width="2" aria-hidden="true" />
      <span>{{ a.texto }}</span>
    </button>
  </div>
</template>

<style scoped>
.abas-marcador {
  position: absolute;
  top: 4px;
  bottom: 4px;
  left: 4px;
  width: calc((100% - 8px) / var(--n));
  border-radius: 10px;
  background: var(--acento-suave);
  transform: translateX(calc(var(--i) * 100%));
  transition: transform 0.4s var(--ease-mola);
}
.abas-deslizantes button:focus-visible {
  outline: 2px solid var(--acento);
  outline-offset: 1px;
}
@media (prefers-reduced-motion: reduce) {
  .abas-marcador {
    transition: none;
  }
}
:global(:root.menos-movimento) .abas-marcador {
  transition: none;
}
</style>
