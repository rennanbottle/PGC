<script setup>
// Asserção e razão: duas afirmações ligadas por PORQUE e as cinco opções fixas. Teclado: 1 a 5.
import { Check, X } from '@lucide/vue'

const props = defineProps({
  questao: { type: Object, required: true },
  correcao: { type: Object, default: null },
  travada: { type: Boolean, default: false },
})
const resposta = defineModel({ type: Object, default: () => ({}) })
function escolher(id) {
  if (!props.travada && id) resposta.value = { opcao: id }
}
function estado(id) {
  const d = props.correcao?.detalhe
  if (!d) return resposta.value.opcao === id ? 'marcada' : ''
  if (d.certa === id) return 'certa'
  if (resposta.value.opcao === id) return 'errada'
  return ''
}
defineExpose({ escolher: (i) => escolher(props.questao.opcoes?.[i]?.id) })
</script>

<template>
  <div class="flex flex-col gap-4">
    <div class="rounded-[12px] border border-borda bg-folha px-4 py-3 text-[16.5px] leading-[1.6]">
      <p class="m-0"><b class="font-sans text-[13px]">I.</b> <TextoRico :texto="questao.assercao" tag="span" /></p>
      <p class="m-0 my-1.5 font-sans text-[13px] font-bold">PORQUE</p>
      <p class="m-0"><b class="font-sans text-[13px]">II.</b> <TextoRico :texto="questao.razao" tag="span" /></p>
    </div>
    <ul class="m-0 flex list-none flex-col gap-2 p-0" role="radiogroup" aria-label="Opções">
      <li v-for="(o, i) in questao.opcoes" :key="o.id">
        <button
          type="button"
          role="radio"
          :aria-checked="resposta.opcao === o.id"
          :disabled="travada"
          class="flex w-full cursor-pointer items-center gap-3 rounded-[12px] border bg-campo px-4 py-3 text-left text-[15px] text-tinta disabled:cursor-default"
          :class="{ marcada: 'border-acento bg-acento-suave', certa: 'border-ok', errada: 'border-erro', '': 'border-borda-campo hover:border-tinta' }[estado(o.id)]"
          @click="escolher(o.id)"
        >
          <span class="flex-1">{{ o.texto }}</span>
          <span v-if="estado(o.id) === 'certa'" class="flex items-center gap-1 text-[13px] font-semibold text-ok"><Check :size="14" :stroke-width="2.6" aria-hidden="true" />Certa</span>
          <span v-else-if="estado(o.id) === 'errada'" class="flex items-center gap-1 text-[13px] font-semibold text-erro"><X :size="14" :stroke-width="2.6" aria-hidden="true" />Sua resposta</span>
          <kbd v-else-if="!travada" class="hidden rounded-[5px] border border-borda px-1.5 font-sans text-[12px] text-texto-2 sm:block">{{ i + 1 }}</kbd>
        </button>
      </li>
    </ul>
  </div>
</template>
