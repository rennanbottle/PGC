<script setup>
// Resposta numérica: aceita vírgula; a tolerância e a unidade vêm da questão. O que se calcula aparece antes do
// campo ("x_v ="), e quando a resposta tem mais de um número (as duas raízes) há um campo para cada (x₁ e x₂), em
// qualquer ordem.
import { CircleCheck, CircleX } from '@lucide/vue'

const props = defineProps({
  questao: { type: Object, required: true },
  correcao: { type: Object, default: null },
  travada: { type: Boolean, default: false },
})
const resposta = defineModel({ type: Object, default: () => ({}) })
const id = useId()
const campos = computed(() => props.questao.campos ?? null)
const numero = (n) => Number(n).toLocaleString('pt-BR', { maximumFractionDigits: 4 })
const certa = computed(() => props.correcao?.detalhe?.certa)
function mudarValor(i, v) {
  const valores = [...(resposta.value.valores ?? [])]
  valores[i] = v
  resposta.value = { valores }
}
// Cada número certo casa com um escrito (em qualquer ordem): marca qual campo acertou.
const acertos = computed(() => {
  const d = props.correcao?.detalhe
  if (!d || !campos.value) return []
  const usados = new Set()
  return (resposta.value.valores ?? []).map((v) => {
    const lido = Number(String(v ?? '').replace(/\s/g, '').replace(/\./g, '').replace(',', '.'))
    const k = (d.certas ?? []).findIndex((c, i) => !usados.has(i) && Number.isFinite(lido) && Math.abs(lido - c) <= Math.max(Math.abs(c) * (d.tolerancia ?? 0) / 100, 1e-9))
    if (k >= 0) usados.add(k)
    return k >= 0
  })
})
</script>

<template>
  <div>
    <!-- Um número -->
    <template v-if="!campos">
      <label class="text-[13.5px] font-semibold" :for="`${id}-valor`">Sua resposta</label>
      <div class="mt-1 flex items-center gap-3">
        <TextoRico v-if="questao.rotulo" :texto="`$${questao.rotulo} =$`" tag="span" class="shrink-0 text-[19px]" aria-hidden="true" />
        <input
          :id="`${id}-valor`"
          class="campo h-12 w-[200px] text-[18px] tabular-nums"
          :class="correcao && (correcao.resultado === 'correta' ? 'border-ok' : 'border-erro')"
          type="text"
          inputmode="decimal"
          autocomplete="off"
          :readonly="travada"
          :value="resposta.valor ?? ''"
          maxlength="40"
          :aria-label="questao.rotulo ? `Valor de ${questao.rotulo.replace('_', ' ')}` : undefined"
          @input="resposta = { valor: $event.target.value }"
        >
        <span v-if="questao.unidade" class="text-[16px] text-texto-2">{{ questao.unidade }}</span>
      </div>
      <p v-if="!correcao" class="m-0 mt-1.5 text-[13px] text-texto-2">Só o número. Use vírgula para decimal, como 9,8.</p>
      <p v-else-if="correcao.resultado !== 'correta'" class="m-0 mt-2 text-[15px]">
        Certa: <TextoRico v-if="questao.rotulo" :texto="`$${questao.rotulo} =$`" tag="span" /> <b class="tabular-nums">{{ numero(certa) }} {{ questao.unidade }}</b>
      </p>
    </template>

    <!-- Vários números -->
    <template v-else>
      <p class="m-0 text-[13.5px] font-semibold">Suas respostas</p>
      <div class="mt-1.5 flex flex-wrap gap-x-6 gap-y-3">
        <div v-for="(rot, i) in campos" :key="i" class="flex items-center gap-2.5">
          <label :for="`${id}-v${i}`" class="shrink-0 text-[19px]"><TextoRico :texto="`$${rot} =$`" tag="span" /><span class="so-leitor">Valor de {{ rot.replace('_', ' ') }}</span></label>
          <input
            :id="`${id}-v${i}`"
            class="campo h-12 w-[140px] text-[18px] tabular-nums"
            :class="correcao && (acertos[i] ? 'border-ok' : 'border-erro')"
            type="text"
            inputmode="decimal"
            autocomplete="off"
            :readonly="travada"
            :value="resposta.valores?.[i] ?? ''"
            maxlength="40"
            @input="mudarValor(i, $event.target.value)"
          >
          <span v-if="questao.unidade" class="text-[16px] text-texto-2">{{ questao.unidade }}</span>
          <template v-if="correcao">
            <CircleCheck v-if="acertos[i]" :size="18" :stroke-width="2.2" class="text-ok" aria-label="certo" />
            <CircleX v-else :size="18" :stroke-width="2.2" class="text-erro" aria-label="errado" />
          </template>
        </div>
      </div>
      <p v-if="!correcao" class="m-0 mt-2 text-[13px] text-texto-2">Um número em cada campo, em qualquer ordem. Use vírgula para decimal.</p>
      <p v-else-if="correcao.resultado !== 'correta'" class="m-0 mt-2 text-[15px]">
        Certas:
        <template v-for="(c, i) in correcao.detalhe?.certas ?? []" :key="i">
          <TextoRico :texto="`$${campos[i]} =$`" tag="span" /> <b class="tabular-nums">{{ numero(c) }}</b><template v-if="i < (correcao.detalhe?.certas ?? []).length - 1">; </template>
        </template>
      </p>
    </template>
  </div>
</template>
