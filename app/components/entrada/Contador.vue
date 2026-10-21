<script setup>
// Campo de número com menos e mais (quantas questões, quantas de cada nível). O número também aceita digitação.
import { Minus, Plus } from '@lucide/vue'

const props = defineProps({
  modelValue: { type: Number, required: true },
  min: { type: Number, default: 0 },
  max: { type: Number, default: 10 },
  rotulo: { type: String, required: true },
  podeMais: { type: Boolean, default: true },
})
const emit = defineEmits(['update:modelValue'])
const mudar = (v) => emit('update:modelValue', Math.min(props.max, Math.max(props.min, Math.round(Number(v) || props.min))))
</script>

<template>
  <span class="inline-flex h-10 items-center rounded-[10px] border border-borda-campo bg-campo">
    <button type="button" class="grid h-full w-10 cursor-pointer place-items-center rounded-l-[10px] border-0 bg-transparent text-tinta hover:bg-folha-2 disabled:cursor-default disabled:text-borda-campo disabled:hover:bg-transparent" :disabled="modelValue <= min" :aria-label="`Menos, ${rotulo}`" @click="mudar(modelValue - 1)">
      <Minus :size="16" :stroke-width="2" aria-hidden="true" />
    </button>
    <input
      :value="modelValue"
      type="number"
      inputmode="numeric"
      :min="min"
      :max="max"
      :aria-label="rotulo"
      class="h-full w-10 border-0 bg-transparent p-0 text-center text-[16px] font-bold tabular-nums text-tinta [appearance:textfield] focus:outline-none [&::-webkit-inner-spin-button]:appearance-none"
      @change="mudar($event.target.value)"
    >
    <button type="button" class="grid h-full w-10 cursor-pointer place-items-center rounded-r-[10px] border-0 bg-transparent text-tinta hover:bg-folha-2 disabled:cursor-default disabled:text-borda-campo disabled:hover:bg-transparent" :disabled="modelValue >= max || !podeMais" :aria-label="`Mais, ${rotulo}`" @click="mudar(modelValue + 1)">
      <Plus :size="16" :stroke-width="2" aria-hidden="true" />
    </button>
  </span>
</template>
