<script setup>
// Hoje: questões feitas contra a meta do ritmo (anel), pontos do dia e dias seguidos.
import { Check, Flame, Target, Zap } from '@lucide/vue'

const props = defineProps({
  feitas: { type: Number, default: 0 },
  meta: { type: Number, default: 20 },
  ritmo: { type: String, default: 'Normal' },
  pontosHoje: { type: Number, default: 0 },
  diasSeguidos: { type: Number, default: 0 },
})
const bateu = computed(() => props.feitas >= props.meta)
const faltam = computed(() => Math.max(0, props.meta - props.feitas))
</script>

<template>
  <section class="cartao" data-guia="inicio-hoje" aria-labelledby="titulo-hoje">
    <h2 id="titulo-hoje" class="titulo-cartao m-0 flex items-center gap-2">
      <Target :size="18" :stroke-width="2" class="text-texto-2" aria-hidden="true" />
      <span>Hoje</span>
    </h2>
    <div class="mt-4 flex items-center gap-5">
      <AppAnelMeta :feitas="feitas" :meta="meta" :tamanho="92" :espessura="9" />
      <div class="min-w-0">
        <p class="m-0 numero-medio leading-none"><Fracao :valor="feitas" :total="meta" /></p>
        <p class="m-0 mt-1.5 text-[13.5px] text-texto-2">questões no ritmo {{ ritmo }}</p>
        <p v-if="bateu" class="m-0 mt-2"><span class="selo" data-tipo="ok"><Check :size="13" :stroke-width="2.6" aria-hidden="true" /> Meta batida</span></p>
        <p v-else class="m-0 mt-2 text-[13.5px] font-semibold">Faltam {{ faltam }}</p>
      </div>
    </div>
    <div class="divisoria my-4" />
    <dl class="m-0 grid grid-cols-2 gap-4">
      <div>
        <dt class="flex items-center gap-1.5 text-[13px] text-texto-2">
          <Zap :size="15" :stroke-width="2" class="text-energia" aria-hidden="true" />
          <span>Pontos hoje</span>
        </dt>
        <dd class="m-0 mt-1 numero-medio leading-none text-energia-texto">+<NumeroAnimado :valor="pontosHoje" /></dd>
      </div>
      <div>
        <dt class="flex items-center gap-1.5 text-[13px] text-texto-2">
          <Flame :size="15" :stroke-width="2" class="text-energia" aria-hidden="true" />
          <span>Dias seguidos</span>
        </dt>
        <dd class="m-0 mt-1 numero-medio leading-none"><NumeroAnimado :valor="diasSeguidos" /></dd>
      </div>
    </dl>
  </section>
</template>
