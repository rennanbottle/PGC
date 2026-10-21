<script setup>
// Escolher os assuntos de um bloco, com peso. Abre numa janela; cada mudança já vale para o bloco.
// arvore: matérias com "lista" de assuntos { id, nome, n (questões nas revisões), prof }.
const assuntos = defineModel({ type: Array, required: true })
const props = defineProps({
  arvore: { type: Array, required: true },
  titulo: { type: String, default: 'Assuntos do bloco' },
})
const janela = ref(null)
defineExpose({ abrir: () => janela.value?.abrir() })

const pesoDe = (aid) => assuntos.value.find((a) => a.id === aid)?.peso ?? 0
const marcado = (aid) => pesoDe(aid) > 0
function definir(aid, peso) {
  const outros = assuntos.value.filter((a) => a.id !== aid)
  assuntos.value = peso > 0 ? [...outros, { id: aid, peso }] : outros
}
const alternar = (aid) => definir(aid, marcado(aid) ? 0 : 5)
function alternarMateria(m) {
  const todos = m.lista.every((a) => marcado(a.id))
  const ids = new Set(m.lista.map((a) => a.id))
  const fora = assuntos.value.filter((a) => !ids.has(a.id))
  assuntos.value = todos ? fora : [...fora, ...m.lista.map((a) => ({ id: a.id, peso: pesoDe(a.id) || 5 }))]
}
const soma = computed(() => assuntos.value.reduce((s, a) => s + a.peso, 0))
const pct = (aid) => (soma.value ? Math.round((pesoDe(aid) / soma.value) * 100) : 0)
const vazio = computed(() => !props.arvore.length)
</script>

<template>
  <JanelaBase ref="janela" :titulo="titulo">
    <p v-if="vazio" class="m-0 text-[14.5px] text-texto-2">Nenhum assunto ainda. <NuxtLink to="/materias" class="link">Criar matéria e assuntos</NuxtLink></p>
    <div v-else class="flex max-h-[60dvh] flex-col gap-3 overflow-y-auto pr-1">
      <div v-for="m in arvore" :key="m.id">
        <label class="linha-opcao items-center py-1.5">
          <input type="checkbox" class="so-leitor" :checked="m.lista.every((a) => marcado(a.id))" @change="alternarMateria(m)">
          <span class="caixa mt-0" aria-hidden="true" />
          <span class="size-2 shrink-0 rounded-full" :style="{ background: `${corMateria(m.cor ?? 'cinza')}` }" aria-hidden="true" />
          <b class="text-[15px]">{{ m.nome }}</b>
          <span class="text-[13px] text-texto-2"><Fracao :valor="m.lista.filter((a) => marcado(a.id)).length" :total="m.lista.length" sem-animacao /></span>
        </label>
        <div v-for="a in m.lista" :key="a.id" class="ml-7 grid items-center gap-x-3 gap-y-1 rounded-[10px] py-0.5 pr-2 sm:grid-cols-[minmax(0,1fr)_auto]" :class="marcado(a.id) && 'bg-folha-2'">
          <label class="linha-opcao min-w-0 py-1.5 hover:bg-transparent">
            <input type="checkbox" class="so-leitor" :checked="marcado(a.id)" @change="alternar(a.id)">
            <span class="caixa" aria-hidden="true" />
            <span class="min-w-0"><b class="block text-[14.5px]">{{ a.nome }}</b><span class="block text-[13px] text-texto-2">{{ a.n }} {{ a.n === 1 ? 'questão' : 'questões' }} nas revisões{{ a.prof ? `, proficiência ${a.prof}` : '' }}</span></span>
          </label>
          <span v-if="marcado(a.id)" class="flex items-center gap-2 pl-10 sm:pl-0">
            <EntradaContador :model-value="pesoDe(a.id)" :min="1" :max="10" :rotulo="`Peso de ${a.nome}`" @update:model-value="definir(a.id, $event)" />
            <b class="w-10 text-right text-[13.5px] tabular-nums">{{ pct(a.id) }}%</b>
          </span>
        </div>
      </div>
    </div>
    <div class="flex items-center justify-between gap-3 pt-1">
      <span class="text-[13px] text-texto-2">{{ assuntos.length }} {{ assuntos.length === 1 ? 'assunto marcado' : 'assuntos marcados' }}. O peso diz quanto de cada um entra.</span>
      <button type="button" class="botao h-11" @click="janela?.fechar()">Pronto</button>
    </div>
  </JanelaBase>
</template>
