<script setup>
// Barra única com a parte dos assuntos em cada grupo de estado (bem, estudando, pedem atenção, não iniciados).
// Cada pedaço mostra o número ao passar o mouse; leitores de tela ouvem o resumo inteiro.
// Uso: <MateriasBarraEstados :grupos="{ bem: 2, estudando: 1, atencao: 0, nao_iniciado: 3 }" />
import { GRUPOS_ESTADO } from '#shared/regras/materias.js'

const props = defineProps({
  grupos: { type: Object, required: true },
  legenda: { type: Boolean, default: false },
  altura: { type: Number, default: 8 },
})

const COR = { bem: 'var(--ok-vivo)', estudando: 'var(--acento)', atencao: 'var(--aviso)', nao_iniciado: 'var(--folha-3)' }
const total = computed(() => GRUPOS_ESTADO.reduce((s, g) => s + (props.grupos[g.id] ?? 0), 0))
const partes = computed(() => GRUPOS_ESTADO
  .map((g) => ({ ...g, n: props.grupos[g.id] ?? 0, cor: COR[g.id] }))
  .filter((g) => g.n > 0))
const resumo = computed(() => {
  if (!total.value) return 'Nenhum assunto ainda.'
  return `${partes.value.map((p) => `${p.n} ${p.nome.toLowerCase()}`).join(', ')}, de ${total.value} ${total.value === 1 ? 'assunto' : 'assuntos'}.`
})
</script>

<template>
  <div>
    <div class="flex w-full gap-[2px] overflow-hidden rounded-full bg-folha-3" :style="{ height: `${altura}px` }" role="img" :aria-label="resumo">
      <span
        v-for="(p, i) in partes"
        :key="p.id"
        class="pedaco h-full"
        :style="{ flexGrow: p.n, background: p.cor, '--i': i }"
        :data-dica="`${p.nome}: ${p.n}`"
      />
    </div>
    <ul v-if="legenda && total" class="m-0 mt-3 flex list-none flex-wrap gap-x-4 gap-y-1.5 p-0 text-[13px] text-texto-2" aria-hidden="true">
      <li v-for="p in partes" :key="p.id" class="inline-flex items-center gap-1.5">
        <span class="ponto-cor" :style="{ background: p.cor, width: '8px', height: '8px' }" />
        <span>{{ p.nome }}</span>
        <strong class="font-semibold text-tinta">{{ p.n }}</strong>
      </li>
    </ul>
  </div>
</template>

<style scoped>
.pedaco {
  flex-basis: 0;
  min-width: 6px;
  transform-origin: left center;
  animation: cresce-x 0.7s var(--ease-saida) backwards;
  animation-delay: calc(var(--i) * 70ms);
}
@media (prefers-reduced-motion: reduce) {
  .pedaco { animation: none; }
}
:global(:root.menos-movimento) .pedaco {
  animation: none;
}
</style>
