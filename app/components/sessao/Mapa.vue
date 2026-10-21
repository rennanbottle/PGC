<script setup>
// Mapa das questões: respondida, atual, em branco e marcada para voltar. Nunca só por cor: borda, fundo e a bandeira.
import { Flag } from '@lucide/vue'

defineProps({
  itens: { type: Array, required: true },
  atual: { type: Number, required: true },
  inicio: { type: Number, default: 0 }, // número da primeira questão (num conjunto, o mapa mostra só o bloco atual)
})
const emit = defineEmits(['ir'])
</script>

<template>
  <div>
    <div class="grid grid-cols-5 gap-1.5">
      <button
        v-for="(it, i) in itens"
        :key="it.id"
        type="button"
        class="relative grid h-9 cursor-pointer place-items-center rounded-[7px] border text-[13px] tabular-nums"
        :class="i === atual ? 'border-2 border-acento bg-acento-suave font-bold text-acento' : it.respondida ? 'border-borda bg-folha-3 text-texto-2' : 'border-borda-campo bg-transparent text-texto-2'"
        :aria-label="`Questão ${inicio + i + 1}, ${it.respondida ? 'respondida' : 'em branco'}${it.marcada ? ', marcada para voltar' : ''}${i === atual ? ', atual' : ''}`"
        :aria-current="i === atual ? 'step' : undefined"
        @click="emit('ir', i)"
      >
        {{ inicio + i + 1 }}
        <Flag v-if="it.marcada" :size="11" :stroke-width="2.4" class="absolute -right-1 -top-1 text-acento" aria-hidden="true" />
      </button>
    </div>
    <ul class="m-0 mt-2.5 flex list-none flex-col gap-1 p-0 text-[12.5px] text-texto-2">
      <li class="flex items-center gap-2"><span class="size-3 rounded-[3px] border border-borda bg-folha-3" aria-hidden="true" />respondida</li>
      <li class="flex items-center gap-2"><span class="size-3 rounded-[3px] border-2 border-acento" aria-hidden="true" />atual</li>
      <li class="flex items-center gap-2"><span class="size-3 rounded-[3px] border border-borda-campo" aria-hidden="true" />em branco</li>
      <li class="flex items-center gap-2"><Flag :size="12" :stroke-width="2.2" aria-hidden="true" />marcada para voltar</li>
    </ul>
  </div>
</template>
