<script setup>
// Associar colunas: cada item da esquerda recebe uma letra da direita. Sem arrastar: um campo de escolha por item.
import { LETRAS } from '#shared/regras/questoes.js'

const props = defineProps({
  questao: { type: Object, required: true },
  correcao: { type: Object, default: null },
  travada: { type: Boolean, default: false },
})
const resposta = defineModel({ type: Object, default: () => ({}) })
const ligacao = (i) => resposta.value.ligacoes?.[i] ?? ''
function ligar(i, v) {
  resposta.value = { ligacoes: { ...(resposta.value.ligacoes ?? {}), [i]: v === '' ? '' : Number(v) } }
}
const ok = (i) => (props.correcao ? props.correcao.detalhe?.certas?.[i] === Number(ligacao(i)) : null)
</script>

<template>
  <div class="grid gap-5 sm:grid-cols-[1fr_1fr]">
    <ul class="m-0 flex list-none flex-col gap-2 p-0" aria-label="Itens para ligar">
      <li v-for="(t, i) in questao.esquerda" :key="i" class="flex items-center gap-3 rounded-[12px] border bg-campo px-3.5 py-2.5" :class="ok(i) === null ? 'border-borda-campo' : ok(i) ? 'border-ok' : 'border-erro'">
        <span class="min-w-0 flex-1 text-[15.5px]">{{ t }}</span>
        <div class="w-[92px] shrink-0">
          <Selecao :model-value="String(ligacao(i))" :opcoes="questao.direita.map((_, j) => ({ valor: String(j), texto: LETRAS[j] }))" :rotulo="`Par de ${t}`" :desativado="travada" texto-vazio="?" :busca="false" @update:model-value="ligar(i, $event)" />
        </div>
        <span v-if="ok(i) === false" class="text-[13px] font-semibold text-erro">é {{ LETRAS[correcao.detalhe.certas[i]] }}</span>
      </li>
    </ul>
    <ol class="m-0 flex list-none flex-col gap-2 p-0" aria-label="Opções">
      <li v-for="(t, j) in questao.direita" :key="j" class="flex gap-3 rounded-[12px] border border-borda px-3.5 py-2.5 text-[15px]">
        <b class="w-4 shrink-0">{{ LETRAS[j] }}</b><span>{{ t }}</span>
      </li>
    </ol>
  </div>
</template>
