<script setup>
// Verdadeiro ou falso (com justificativa escrita, que não é corrigida automaticamente: aparece a esperada para comparar)
// e certo ou errado no estilo Cebraspe. Teclado: 1 e 2.
import { Check, X } from '@lucide/vue'

const props = defineProps({
  questao: { type: Object, required: true },
  correcao: { type: Object, default: null },
  travada: { type: Boolean, default: false },
})
const resposta = defineModel({ type: Object, default: () => ({}) })
const id = useId()
const opcoes = computed(() => (props.questao.tipo === 'certo_errado' ? [{ v: true, n: 'Certo' }, { v: false, n: 'Errado' }] : [{ v: true, n: 'Verdadeira' }, { v: false, n: 'Falsa' }]))
function escolher(v) {
  if (!props.travada) resposta.value = { ...resposta.value, valor: v }
}
function estado(v) {
  const d = props.correcao?.detalhe
  if (!d) return resposta.value.valor === v ? 'marcada' : ''
  if (d.certa === v) return 'certa'
  if (resposta.value.valor === v) return 'errada'
  return ''
}
defineExpose({ escolher: (i) => escolher(opcoes.value[i]?.v) })
</script>

<template>
  <div class="flex flex-col gap-4">
    <div class="grid grid-cols-2 gap-2.5" role="radiogroup" aria-label="Resposta">
      <button
        v-for="(o, i) in opcoes"
        :key="o.n"
        type="button"
        role="radio"
        :aria-checked="resposta.valor === o.v"
        :disabled="travada"
        class="flex cursor-pointer items-center justify-center gap-2 rounded-[12px] border bg-campo px-4 py-4 text-[17px] font-semibold text-tinta disabled:cursor-default"
        :class="{ marcada: 'border-acento bg-acento-suave shadow-[inset_0_0_0_1px_var(--acento)]', certa: 'border-ok text-ok', errada: 'border-erro text-erro', '': 'border-borda-campo hover:border-tinta' }[estado(o.v)]"
        @click="escolher(o.v)"
      >
        <Check v-if="estado(o.v) === 'certa'" :size="17" :stroke-width="2.6" aria-hidden="true" />
        <X v-else-if="estado(o.v) === 'errada'" :size="17" :stroke-width="2.6" aria-hidden="true" />
        {{ o.n }}
        <kbd v-if="!travada" class="hidden rounded-[5px] border border-borda px-1.5 font-sans text-[12px] font-normal text-texto-2 sm:block">{{ i + 1 }}</kbd>
      </button>
    </div>
    <div v-if="questao.pedeJustificativa">
      <label class="text-[13.5px] font-semibold" :for="`${id}-just`">Por quê? <span class="font-normal text-texto-2">(você compara com a esperada na correção)</span></label>
      <textarea :id="`${id}-just`" class="campo mt-1 h-auto min-h-[70px] resize-y py-2.5 text-[15px] leading-[1.5]" :readonly="travada" :value="resposta.justificativa ?? ''" maxlength="1500" @input="resposta = { ...resposta, justificativa: $event.target.value }" />
    </div>
  </div>
</template>
