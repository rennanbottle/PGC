<script setup>
// Escolher uma alternativa (múltipla escolha, texto-base, prever o resultado) ou várias (múltipla resposta).
// Teclado: 1 a 6 escolhem (tratado na página). Alternativa tirada pela dica fica riscada e não dá para marcar.
import { Check, X } from '@lucide/vue'
import { LETRAS } from '#shared/regras/questoes.js'

const props = defineProps({
  questao: { type: Object, required: true },
  correcao: { type: Object, default: null },
  eliminar: { type: Array, default: () => [] },
  travada: { type: Boolean, default: false },
})
const resposta = defineModel({ type: Object, default: () => ({}) })
const multipla = computed(() => props.questao.tipo === 'multipla_resposta')
const marcada = (p) => (multipla.value ? (resposta.value.marcadas ?? []).includes(p) : resposta.value.escolha === p)
function escolher(p) {
  if (props.travada || props.eliminar.includes(p)) return
  if (multipla.value) {
    const s = new Set(resposta.value.marcadas ?? [])
    if (s.has(p)) s.delete(p)
    else s.add(p)
    resposta.value = { marcadas: [...s].sort((a, b) => a - b) }
  }
  else resposta.value = { escolha: p }
}
function estado(p) {
  const d = props.correcao?.detalhe
  if (!d) return marcada(p) ? 'marcada' : props.eliminar.includes(p) ? 'tirada' : ''
  const certa = multipla.value ? (d.certas ?? []).includes(p) : d.certa === p
  if (certa) return 'certa'
  if (marcada(p)) return 'errada'
  return ''
}
const CLASSE = {
  marcada: 'border-acento bg-acento-suave shadow-[inset_0_0_0_1px_var(--acento)]',
  certa: 'border-ok bg-ok-suave shadow-[inset_0_0_0_1px_var(--ok)]',
  errada: 'border-erro bg-erro-suave shadow-[inset_0_0_0_1px_var(--erro)]',
  tirada: 'border-borda opacity-50',
  '': 'border-borda-campo hover:border-acento hover:bg-folha-2 active:scale-[0.99]',
}
// A animação de acerto e erro só toca quando a correção acaba de chegar (não ao rever uma questão já feita).
const animar = ref(false)
watch(() => props.correcao, (agora, antes) => {
  if (agora && !antes) animar.value = true
})
defineExpose({ escolher })
</script>

<template>
  <div>
    <TextoRico v-if="questao.textoBase" :texto="questao.textoBase" class="mb-5 border-l-2 border-borda-campo pl-4 text-[16.5px] leading-[1.6]" />
    <p v-if="multipla && !correcao" class="m-0 mb-2 text-[13.5px] text-texto-2">Marque todas as certas. Marcar uma errada desconta.</p>
    <ul class="m-0 flex list-none flex-col gap-2.5 p-0" :role="multipla ? 'group' : 'radiogroup'" aria-label="Alternativas">
      <li v-for="(texto, p) in questao.alternativas" :key="p">
        <button
          type="button"
          :role="multipla ? 'checkbox' : 'radio'"
          :aria-checked="marcada(p)"
          :disabled="travada || eliminar.includes(p)"
          class="opcao flex min-h-[52px] w-full cursor-pointer items-center gap-3.5 rounded-[14px] border bg-folha px-4 py-3 text-left text-tinta disabled:cursor-default"
          :class="[CLASSE[estado(p)], animar && estado(p) === 'errada' && 'treme', animar && estado(p) === 'certa' && !marcada(p) && 'revela', correcao && !estado(p) && 'opacity-60']"
          @click="escolher(p)"
        >
          <b
            class="grid size-8 shrink-0 place-items-center border text-[14px] transition-colors"
            :class="[multipla ? 'rounded-[9px]' : 'rounded-full', estado(p) === 'certa' ? 'border-ok-vivo bg-ok-vivo text-folha' : estado(p) === 'errada' ? 'border-erro-vivo bg-erro-vivo text-folha' : marcada(p) ? 'border-acento bg-acento text-folha' : 'border-borda-campo']"
          >
            <Check v-if="estado(p) === 'certa'" :size="17" :stroke-width="3" :class="animar && 'pop'" aria-hidden="true" />
            <X v-else-if="estado(p) === 'errada'" :size="17" :stroke-width="3" aria-hidden="true" />
            <template v-else>{{ LETRAS[p] }}</template>
          </b>
          <TextoRico :texto="texto" tag="span" class="min-w-0 flex-1 text-[16.5px] leading-snug" :class="estado(p) === 'tirada' && 'line-through'" />
          <span v-if="estado(p) === 'certa'" class="shrink-0 text-[13.5px] font-semibold text-ok">{{ marcada(p) ? 'Sua resposta, certa' : 'Certa' }}</span>
          <span v-else-if="estado(p) === 'errada'" class="shrink-0 text-[13.5px] font-semibold text-erro">Sua resposta</span>
          <span v-else-if="estado(p) === 'tirada'" class="shrink-0 text-[12.5px] text-texto-2">tirada pela dica</span>
          <kbd v-else-if="!travada" class="tecla-opcao hidden shrink-0 sm:inline-grid">{{ p + 1 }}</kbd>
        </button>
      </li>
    </ul>
  </div>
</template>

<style scoped>
.opcao {
  transition: border-color 0.15s, background-color 0.15s, transform 0.15s var(--ease-saida), opacity 0.3s;
}
.tecla-opcao {
  place-items: center;
  min-width: 22px;
  height: 22px;
  padding: 0 6px;
  border: 1px solid var(--borda-campo);
  border-bottom-width: 2px;
  border-radius: 6px;
  color: var(--texto-3);
  font-family: var(--font-sans);
  font-size: 11.5px;
  font-weight: 600;
  line-height: 1;
}
.pop {
  animation: pop 0.45s var(--ease-saida) both;
}
/* Errou: a certa aparece logo depois do tremor da escolhida. */
.revela {
  animation: revela-certa 0.5s 0.3s var(--ease-saida) both;
}
@keyframes revela-certa {
  from {
    opacity: 0.4;
    transform: scale(0.98);
  }
  to {
    opacity: 1;
    transform: none;
  }
}
@media (prefers-reduced-motion: reduce) {
  .opcao {
    transition: none;
  }
  .pop,
  .revela {
    animation: none;
  }
}
:global(:root.menos-movimento) .opcao {
  transition: none;
}
:global(:root.menos-movimento) .pop,
:global(:root.menos-movimento) .revela {
  animation: none;
}
</style>
