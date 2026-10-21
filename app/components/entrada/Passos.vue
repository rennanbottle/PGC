<script setup>
// Caminho dos passos de um fluxo (cadastro): um ícone por passo, a linha que enche ao avançar e o visto nos feitos.
// Passos feitos são botões: voltam para aquele passo. O passo atual tem aria-current="step".
// Uso: <EntradaPassos :passos="[{ nome: 'Seus dados', icone: IdCard }, ...]" :atual="2" @ir="(n) => ..." />
import { Check } from '@lucide/vue'

const props = defineProps({
  passos: { type: Array, required: true },
  atual: { type: Number, required: true },
  rotulo: { type: String, default: 'Etapas' },
})
const emit = defineEmits(['ir'])

const total = computed(() => props.passos.length)
const preenchido = computed(() => `${(Math.max(0, props.atual - 1) / Math.max(1, total.value - 1)) * 100}%`)
const estado = (i) => (i + 1 < props.atual ? 'feito' : i + 1 === props.atual ? 'atual' : 'depois')
const SUFIXO = { feito: ', concluído', atual: ', passo atual', depois: ', a fazer' }
</script>

<template>
  <nav class="passos relative" :aria-label="rotulo" :style="{ '--n': total }">
    <div class="passos-trilho" aria-hidden="true"><i :style="{ width: preenchido }" /></div>
    <ol class="relative m-0 grid list-none p-0" :style="{ gridTemplateColumns: `repeat(${total}, minmax(0, 1fr))` }">
      <li v-for="(p, i) in passos" :key="p.nome" :data-estado="estado(i)" :aria-current="estado(i) === 'atual' ? 'step' : undefined">
        <button v-if="estado(i) === 'feito'" type="button" class="passos-alvo" @click="emit('ir', i + 1)">
          <span class="passos-bola" aria-hidden="true"><Check :size="17" :stroke-width="2.6" /></span>
          <span class="passos-nome">{{ p.nome }}<span class="so-leitor">{{ SUFIXO.feito }}, voltar para este passo</span></span>
        </button>
        <div v-else class="passos-alvo">
          <span class="passos-bola" aria-hidden="true"><component :is="p.icone" :size="17" :stroke-width="2" /></span>
          <span class="passos-nome">{{ p.nome }}<span class="so-leitor">{{ SUFIXO[estado(i)] }}</span></span>
        </div>
      </li>
    </ol>
  </nav>
</template>

<style scoped>
.passos-trilho {
  position: absolute;
  top: 16px;
  left: calc(50% / var(--n));
  right: calc(50% / var(--n));
  height: 3px;
  overflow: hidden;
  border-radius: 99px;
  background: var(--borda);
}
.passos-trilho > i {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: var(--acento);
  transition: width 0.65s cubic-bezier(0.65, 0, 0.35, 1);
}
.passos-alvo {
  display: flex;
  width: 100%;
  flex-direction: column;
  align-items: center;
  gap: 7px;
  padding: 0;
  border: 0;
  border-radius: 12px;
  background: none;
  font: inherit;
  color: inherit;
  text-align: center;
}
button.passos-alvo {
  cursor: pointer;
}
button.passos-alvo:focus-visible {
  outline: 2px solid var(--acento);
  outline-offset: 3px;
}
.passos-bola {
  display: grid;
  width: 34px;
  height: 34px;
  place-items: center;
  border: 1.5px solid var(--borda-campo);
  border-radius: 999px;
  background: var(--folha);
  color: var(--texto-3);
  transition: background-color 0.3s, border-color 0.3s, color 0.3s, box-shadow 0.25s;
}
.passos-nome {
  font-size: 13px;
  font-weight: 500;
  line-height: 1.2;
  color: var(--texto-3);
}
[data-estado='atual'] .passos-bola {
  border: 2px solid var(--acento);
  color: var(--acento);
  box-shadow: 0 0 0 5px var(--acento-suave);
  animation: pop 0.45s var(--ease-mola) 0.4s backwards;
}
[data-estado='atual'] .passos-nome {
  font-weight: 650;
  color: var(--tinta);
}
[data-estado='feito'] .passos-bola {
  border-color: var(--acento);
  background: var(--acento);
  color: var(--sobre-acento);
}
[data-estado='feito'] .passos-bola svg {
  animation: pop 0.4s var(--ease-mola);
}
[data-estado='feito'] .passos-nome {
  color: var(--texto-2);
}
button.passos-alvo:hover .passos-bola {
  box-shadow: 0 0 0 5px var(--acento-suave);
}
button.passos-alvo:hover .passos-nome {
  color: var(--tinta);
}
@media (prefers-reduced-motion: reduce) {
  .passos-trilho > i,
  .passos-bola,
  .passos-bola svg {
    transition: none;
    animation: none !important;
  }
}
:global(:root.menos-movimento) .passos-trilho > i,
:global(:root.menos-movimento) .passos-bola,
:global(:root.menos-movimento) .passos-bola svg {
  transition: none;
  animation: none !important;
}
</style>
