<script setup>
// Pódio dos 3 primeiros do período: os degraus sobem um depois do outro (3º, 2º, 1º), os pontos contam e a
// pessoa aparece destacada, com o guia comemorando ao lado. A coroa do 1º lugar chega por último.
// degraus: saída de podio() (shared/regras/ranking.js), já na ordem 2º, 1º, 3º e com a altura de cada um.
import { Crown } from '@lucide/vue'

defineProps({
  degraus: { type: Array, required: true },
})
const ALTURA = 150
const ATRASO = { 3: 0.05, 2: 0.2, 1: 0.35 }
</script>

<template>
  <ol class="podio m-0 grid list-none items-end gap-2 p-0 sm:gap-4" :style="{ gridTemplateColumns: `repeat(${degraus.length}, minmax(0, 1fr))` }">
    <li
      v-for="d in degraus"
      :key="d.apelido"
      class="flex min-w-0 flex-col items-center"
      :aria-label="`${d.posicao}º lugar: ${d.apelido}${d.eu ? ', você' : ''}, ${d.pontos} pontos`"
    >
      <div class="relative mb-2 mt-6" aria-hidden="true">
        <Crown v-if="d.posicao === 1" class="coroa absolute -top-6 left-1/2 text-energia" :size="22" :stroke-width="2.2" />
        <AvatarPerfil :nome="d.apelido" :tamanho="d.posicao === 1 ? 60 : 48" />
        <GuiaPersonagem v-if="d.eu" humor="comemorando" :tamanho="54" class="elo absolute -bottom-1 -left-[50px]" />
      </div>
      <p class="m-0 max-w-full truncate px-1 text-center text-[14.5px] font-semibold" aria-hidden="true">{{ d.apelido }}</p>
      <p class="m-0 mt-0.5 text-center text-[13px] text-texto-2" aria-hidden="true">
        <strong class="font-titulo text-[19px] text-tinta tabular-nums"><NumeroAnimado :valor="d.pontos" /></strong>
        pontos
      </p>
      <div
        class="degrau mt-2.5 w-full"
        :class="{ eu: d.eu, primeiro: d.posicao === 1 && !d.eu }"
        :style="{ height: `${Math.round(d.altura * ALTURA)}px`, '--atraso': `${ATRASO[d.posicao] ?? 0.4}s` }"
        aria-hidden="true"
      >
        <span class="font-titulo text-[28px] font-bold leading-none">{{ d.posicao }}º</span>
        <span v-if="d.eu" class="mt-1.5 text-[12.5px] font-semibold">Você</span>
      </div>
    </li>
  </ol>
</template>

<style scoped>
.degrau {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding-top: 14px;
  border: 1px solid var(--borda);
  border-bottom: 0;
  border-radius: 14px 14px 0 0;
  background: var(--folha-2);
  color: var(--texto-2);
  transform-origin: bottom center;
  animation: cresce-y 0.8s var(--ease-mola) var(--atraso) backwards;
}
.degrau.primeiro {
  background: var(--energia-suave);
  color: var(--energia-texto);
  border-color: color-mix(in oklab, var(--energia) 35%, var(--borda));
}
.degrau.eu {
  background: var(--acento-suave);
  color: var(--acento);
  border-color: color-mix(in oklab, var(--acento) 50%, var(--borda));
}
.coroa {
  translate: -50% 0;
  animation: pop 0.5s var(--ease-mola) 0.9s backwards;
}
.elo {
  animation: aparece 0.4s var(--ease-saida) 1s backwards;
}
@media (prefers-reduced-motion: reduce) {
  .degrau,
  .coroa,
  .elo {
    animation: none;
  }
}
:global(:root.menos-movimento) .degrau,
:global(:root.menos-movimento) .coroa,
:global(:root.menos-movimento) .elo {
  animation: none;
}
</style>
