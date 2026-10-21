<script setup>
// Alternativas da questão: letra, texto e o botão "Certa". "multipla": mais de uma certa.
// Com "mostrarErros" (o editor liga em "Mais detalhes"), cada errada ganha o campo do erro de raciocínio que leva a
// ela. Sem "pedirErro" (questão importada ou escrita pela pessoa), esse campo é opcional.
import { Check, Circle, Plus, X } from '@lucide/vue'
import { LETRAS } from '#shared/regras/questoes.js'

const alternativas = defineModel({ type: Array, required: true })
const props = defineProps({
  multipla: { type: Boolean, default: false },
  pedirErro: { type: Boolean, default: true },
  mostrarErros: { type: Boolean, default: false },
  minimo: { type: Number, default: 4 },
  maximo: { type: Number, default: 5 },
})
const id = useId()

// Chave estável por alternativa (a lista anima quando uma sai).
const chaves = new WeakMap()
let proxima = 0
function chave(a) {
  if (!chaves.has(a)) chaves.set(a, ++proxima)
  return chaves.get(a)
}
function marcar(i) {
  if (props.multipla) alternativas.value[i].correta = !alternativas.value[i].correta
  else alternativas.value.forEach((a, k) => (a.correta = k === i))
}
function tirar(i) {
  if (alternativas.value.length <= props.minimo) return
  const saiu = alternativas.value.splice(i, 1)[0]
  if (saiu.correta && !props.multipla && alternativas.value.length) alternativas.value[0].correta = true
}
function adicionar() {
  if (alternativas.value.length >= props.maximo) return
  alternativas.value.push({ texto: '', correta: false, erro: '' })
  nextTick(() => document.getElementById(`${id}-texto-${alternativas.value.length - 1}`)?.focus())
}
const faltaErro = (a) => props.pedirErro && !a.correta && !String(a.erro ?? '').trim()
</script>

<template>
  <fieldset class="m-0 min-w-0 border-0 p-0">
    <legend class="rotulo">{{ multipla ? 'Alternativas: marque todas as certas' : 'Alternativas: marque a certa' }}</legend>
    <TransitionGroup name="lista" tag="ul" class="m-0 flex list-none flex-col gap-2 p-0">
      <li v-for="(a, i) in alternativas" :key="chave(a)" class="alternativa" :class="a.correta && 'certa'">
        <div class="flex items-center gap-2">
          <span class="letra" aria-hidden="true">
            <Check v-if="a.correta" :size="15" :stroke-width="2.6" />
            <template v-else>{{ LETRAS[i] }}</template>
          </span>
          <label class="so-leitor" :for="`${id}-texto-${i}`">Alternativa {{ LETRAS[i] }}{{ a.correta ? ', a certa' : '' }}</label>
          <input :id="`${id}-texto-${i}`" v-model="a.texto" class="campo min-w-0 flex-1" type="text" maxlength="600" autocomplete="off">
          <button
            type="button"
            class="marca-certa"
            :aria-pressed="a.correta"
            :aria-label="a.correta ? `A alternativa ${LETRAS[i]} é a certa` : `Marcar a alternativa ${LETRAS[i]} como certa`"
            @click="marcar(i)"
          >
            <Check v-if="a.correta" :size="15" :stroke-width="2.6" aria-hidden="true" />
            <Circle v-else :size="15" :stroke-width="2" aria-hidden="true" />
            <span class="hidden sm:inline">{{ a.correta ? 'Certa' : 'Marcar' }}</span>
          </button>
          <button type="button" class="botao-icone pequeno shrink-0" :disabled="alternativas.length <= minimo" :aria-label="`Tirar a alternativa ${LETRAS[i]}`" data-dica="Tirar" @click="tirar(i)">
            <X :size="16" :stroke-width="2" aria-hidden="true" />
          </button>
        </div>
        <Transition name="abre">
          <div v-if="mostrarErros && !a.correta">
            <div class="pb-1 pl-10 pr-12 pt-2">
              <label class="text-[12.5px] font-semibold text-texto-2" :for="`${id}-erro-${i}`">Que erro de raciocínio leva à {{ LETRAS[i] }}{{ pedirErro ? '' : ' (opcional)' }}</label>
              <input :id="`${id}-erro-${i}`" v-model="a.erro" class="campo campo-p mt-1" type="text" maxlength="400" autocomplete="off" :aria-invalid="faltaErro(a)">
            </div>
          </div>
        </Transition>
      </li>
    </TransitionGroup>
    <button v-if="alternativas.length < maximo" type="button" class="botao-fantasma botao-p -ml-2.5 mt-2" @click="adicionar">
      <Plus :size="16" :stroke-width="2" aria-hidden="true" />Alternativa {{ LETRAS[alternativas.length] }}
    </button>
  </fieldset>
</template>

<style scoped>
.letra {
  display: grid;
  flex-shrink: 0;
  place-items: center;
  width: 32px;
  height: 32px;
  border: 1.5px solid var(--borda-campo);
  border-radius: 999px;
  color: var(--texto-2);
  font-size: 14px;
  font-weight: 700;
  transition: background-color 0.18s, color 0.18s, border-color 0.18s;
}
.alternativa.certa .letra {
  border-color: transparent;
  background: var(--ok-suave);
  color: var(--ok);
  animation: estala 0.32s cubic-bezier(0.3, 1.6, 0.5, 1);
}
.marca-certa {
  display: inline-flex;
  flex-shrink: 0;
  align-items: center;
  gap: 6px;
  height: 40px;
  padding: 0 12px;
  border: 1.5px solid var(--borda-campo);
  border-radius: 12px;
  background: transparent;
  color: var(--texto-2);
  font: inherit;
  font-size: 13.5px;
  font-weight: 600;
  cursor: pointer;
  transition: background-color 0.15s, color 0.15s, border-color 0.15s;
}
.marca-certa:hover {
  border-color: var(--ok);
  color: var(--ok);
}
.marca-certa[aria-pressed='true'] {
  border-color: transparent;
  background: var(--ok-suave);
  color: var(--ok);
}
.marca-certa:focus-visible {
  outline: 2px solid var(--acento);
  outline-offset: 2px;
}
@keyframes estala {
  50% { transform: scale(1.18); }
}
@media (prefers-reduced-motion: reduce) {
  .alternativa.certa .letra { animation: none; }
}
:global(:root.menos-movimento) .alternativa.certa .letra {
  animation: none;
}
</style>
