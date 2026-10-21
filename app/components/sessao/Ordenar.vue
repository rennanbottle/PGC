<script setup>
// Ordenar: subir e descer cada item (botões e setas do teclado no item focado). A resposta é a ordem das posições.
import { ArrowDown, ArrowUp } from '@lucide/vue'

const props = defineProps({
  questao: { type: Object, required: true },
  correcao: { type: Object, default: null },
  travada: { type: Boolean, default: false },
})
const resposta = defineModel({ type: Object, default: () => ({}) })
const ordem = computed(() => (resposta.value.ordem?.length === props.questao.itens.length ? resposta.value.ordem : props.questao.itens.map((_, i) => i)))
onMounted(() => {
  if (!resposta.value.ordem) resposta.value = { ordem: ordem.value }
})
function mover(k, passo) {
  const j = k + passo
  if (props.travada || j < 0 || j >= ordem.value.length) return
  const nova = [...ordem.value]
  ;[nova[k], nova[j]] = [nova[j], nova[k]]
  resposta.value = { ordem: nova }
}
const ok = (k) => (props.correcao ? props.correcao.detalhe?.certa?.[k] === ordem.value[k] : null)
function tecla(e, k) {
  if (e.key === 'ArrowUp') {
    e.preventDefault()
    mover(k, -1)
  }
  if (e.key === 'ArrowDown') {
    e.preventDefault()
    mover(k, 1)
  }
}
</script>

<template>
  <div>
    <p v-if="!correcao" class="m-0 mb-2 text-[13.5px] text-texto-2">Do primeiro ao último. Use os botões ou as setas com o item selecionado.</p>
    <ol class="m-0 flex list-none flex-col gap-2 p-0">
      <li v-for="(p, k) in ordem" :key="p" tabindex="0" class="flex items-center gap-3 rounded-[12px] border bg-campo px-3.5 py-2.5 outline-none focus-visible:outline-2 focus-visible:outline-acento" :class="ok(k) === null ? 'border-borda-campo' : ok(k) ? 'border-ok' : 'border-erro'" @keydown="tecla($event, k)">
        <b class="w-5 shrink-0 text-right tabular-nums text-texto-2">{{ k + 1 }}</b>
        <span class="min-w-0 flex-1 text-[15.5px]">{{ questao.itens[p] }}</span>
        <template v-if="!travada">
          <button type="button" class="grid size-9 cursor-pointer place-items-center rounded-full border-0 bg-transparent text-texto-2 hover:bg-folha-3 hover:text-tinta disabled:opacity-30" :disabled="k === 0" :aria-label="`Subir ${questao.itens[p]}`" @click="mover(k, -1)"><ArrowUp :size="16" :stroke-width="2" aria-hidden="true" /></button>
          <button type="button" class="grid size-9 cursor-pointer place-items-center rounded-full border-0 bg-transparent text-texto-2 hover:bg-folha-3 hover:text-tinta disabled:opacity-30" :disabled="k === ordem.length - 1" :aria-label="`Descer ${questao.itens[p]}`" @click="mover(k, 1)"><ArrowDown :size="16" :stroke-width="2" aria-hidden="true" /></button>
        </template>
      </li>
    </ol>
    <div v-if="correcao && correcao.resultado !== 'correta'" class="mt-3 text-[14px]">
      <p class="m-0 font-semibold text-texto-2">Ordem certa</p>
      <ol class="m-0 mt-1 pl-5"><li v-for="p in correcao.detalhe.certa" :key="p">{{ questao.itens[p] }}</li></ol>
    </div>
  </div>
</template>
