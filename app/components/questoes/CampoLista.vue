<script setup>
// Lista de textos editável (itens para ordenar, passos, pontos-chave, opções). Botões para subir, descer e tirar.
// A ordem da lista é a ordem certa quando a questão é de ordenar.
import { ArrowDown, ArrowUp, Plus, X } from '@lucide/vue'

const itens = defineModel({ type: Array, required: true })
const props = defineProps({
  rotulo: { type: String, required: true },
  nomeItem: { type: String, default: 'Item' },
  minimo: { type: Number, default: 1 },
  maximo: { type: Number, default: 10 },
  numerado: { type: Boolean, default: true },
  ajuda: { type: String, default: '' },
  textoAdicionar: { type: String, default: 'Adicionar item' },
  longo: { type: Boolean, default: false },
})
const id = useId()

function mover(i, passo) {
  const j = i + passo
  if (j < 0 || j >= itens.value.length) return
  const lista = itens.value
  ;[lista[i], lista[j]] = [lista[j], lista[i]]
}
function tirar(i) {
  if (itens.value.length > props.minimo) itens.value.splice(i, 1)
}
function adicionar() {
  if (itens.value.length < props.maximo) {
    itens.value.push('')
    nextTick(() => document.getElementById(`${id}-${itens.value.length - 1}`)?.focus())
  }
}
</script>

<template>
  <fieldset class="m-0 min-w-0 border-0 p-0">
    <legend class="mb-1 flex w-full items-baseline justify-between">
      <span class="rotulo m-0">{{ rotulo }}</span>
      <span class="text-[13px] text-texto-2"><Fracao :valor="itens.length" :total="maximo" sem-animacao /></span>
    </legend>
    <p v-if="ajuda" class="ajuda m-0 mb-2">{{ ajuda }}</p>
    <ol class="m-0 flex list-none flex-col gap-2 p-0">
      <li v-for="(_, i) in itens" :key="i" class="flex items-start gap-2">
        <span v-if="numerado" class="mt-3 w-5 shrink-0 text-right text-[14px] font-semibold tabular-nums text-texto-2" aria-hidden="true">{{ i + 1 }}</span>
        <label class="so-leitor" :for="`${id}-${i}`">{{ nomeItem }} {{ i + 1 }}</label>
        <textarea v-if="longo" :id="`${id}-${i}`" v-model="itens[i]" class="campo min-h-[46px] flex-1 resize-y py-2.5 leading-normal" rows="2" maxlength="600" />
        <input v-else :id="`${id}-${i}`" v-model="itens[i]" class="campo h-11 flex-1" type="text" maxlength="300" autocomplete="off">
        <span class="flex shrink-0 items-center">
          <button type="button" class="grid size-9 cursor-pointer place-items-center rounded-full text-texto-2 hover:bg-folha-3 hover:text-tinta disabled:opacity-30" :disabled="i === 0" :aria-label="`Subir ${nomeItem.toLowerCase()} ${i + 1}`" @click="mover(i, -1)">
            <ArrowUp :size="16" :stroke-width="2" aria-hidden="true" />
          </button>
          <button type="button" class="grid size-9 cursor-pointer place-items-center rounded-full text-texto-2 hover:bg-folha-3 hover:text-tinta disabled:opacity-30" :disabled="i === itens.length - 1" :aria-label="`Descer ${nomeItem.toLowerCase()} ${i + 1}`" @click="mover(i, 1)">
            <ArrowDown :size="16" :stroke-width="2" aria-hidden="true" />
          </button>
          <button type="button" class="grid size-9 cursor-pointer place-items-center rounded-full text-texto-2 hover:bg-folha-3 hover:text-tinta disabled:opacity-30" :disabled="itens.length <= minimo" :aria-label="`Tirar ${nomeItem.toLowerCase()} ${i + 1}`" @click="tirar(i)">
            <X :size="16" :stroke-width="2" aria-hidden="true" />
          </button>
        </span>
      </li>
    </ol>
    <button v-if="itens.length < maximo" type="button" class="link mt-2 inline-flex items-center gap-1.5 text-[14.5px]" @click="adicionar">
      <Plus :size="15" :stroke-width="2" aria-hidden="true" />{{ textoAdicionar }}
    </button>
  </fieldset>
</template>
