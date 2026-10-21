<script setup>
// Encontrar o erro: a resolução em passos; a pessoa escolhe o passo errado. Teclado: 1 a 9.
// Passo de conta (Δ=b²-4ac) é desenhado como matemática; passo de programa fica em fonte de código.
import { Check, X } from '@lucide/vue'
import { temMatematica } from '#shared/regras/matematica.js'

const props = defineProps({
  questao: { type: Object, required: true },
  correcao: { type: Object, default: null },
  travada: { type: Boolean, default: false },
})
const resposta = defineModel({ type: Object, default: () => ({}) })
function escolher(i) {
  if (!props.travada && i >= 0 && i < props.questao.linhas.length) resposta.value = { linha: i }
}
function estado(i) {
  const d = props.correcao?.detalhe
  if (!d) return resposta.value.linha === i ? 'marcada' : ''
  if (d.certa === i) return 'certa'
  if (resposta.value.linha === i) return 'errada'
  return ''
}
const deConta = computed(() => {
  const linhas = props.questao.linhas ?? []
  return linhas.filter((l) => temMatematica(l)).length >= Math.ceil(linhas.length / 2)
})
defineExpose({ escolher })
</script>

<template>
  <div>
    <p v-if="!correcao" class="m-0 mb-2 text-[13.5px] text-texto-2">Qual passo tem o erro?</p>
    <ol class="m-0 flex list-none flex-col gap-2 p-0" role="radiogroup" aria-label="Passos">
      <li v-for="(l, i) in questao.linhas" :key="i">
        <button type="button" role="radio" :aria-checked="resposta.linha === i" :disabled="travada" class="flex w-full cursor-pointer items-baseline gap-3 rounded-[12px] border bg-campo px-4 py-3 text-left text-tinta disabled:cursor-default" :class="[{ marcada: 'border-tinta bg-folha-2', certa: 'border-ok', errada: 'border-erro', '': 'border-borda-campo hover:border-tinta' }[estado(i)], deConta ? 'text-[16.5px]' : 'font-mono text-[14.5px]']" @click="escolher(i)">
          <b class="shrink-0 whitespace-nowrap font-sans text-[13px] text-texto-2">Passo {{ i + 1 }}</b>
          <TextoRico v-if="deConta" :texto="l" tag="span" class="min-w-0 flex-1" />
          <span v-else class="flex-1 whitespace-pre-wrap">{{ l }}</span>
          <Check v-if="estado(i) === 'certa'" :size="16" :stroke-width="2.6" class="text-ok" aria-label="O erro está aqui" />
          <X v-else-if="estado(i) === 'errada'" :size="16" :stroke-width="2.6" class="text-erro" aria-label="Sua resposta" />
        </button>
      </li>
    </ol>
    <p v-if="correcao?.detalhe?.correcao" class="m-0 mt-3 text-[15px]"><b>Passo {{ correcao.detalhe.certa + 1 }} corrigido:</b> <TextoRico :texto="correcao.detalhe.correcao" tag="span" /></p>
  </div>
</template>
