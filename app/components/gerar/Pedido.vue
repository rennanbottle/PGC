<script setup>
// "Pedido para a IA (opcional)": fechado por padrão. Um campo para o que mais a IA deve saber e exemplos que
// preenchem o campo com um clique. Entra no pedido como preferência (as regras do PGC continuam valendo).
import { ChevronDown, MessageSquareText, Plus } from '@lucide/vue'
import { MAX_INSTRUCOES } from '#shared/regras/gerar.js'

const props = defineProps({
  estado: { type: Object, required: true },
  area: { type: String, default: '' },
})
const id = useId()
const aberto = ref(!!props.estado.instrucoes)

const GERAIS = ['Use situações do dia a dia.', 'Cobre os erros que mais caem em prova.', 'Faça enunciados curtos.']
const POR_AREA = {
  matematica: ['Inclua contas com frações.', 'Peça para ler gráficos e tabelas.'],
  exatas: ['Inclua contas com frações.', 'Peça para ler gráficos e tabelas.'],
  natureza: ['Use experimentos simples como exemplo.', 'Peça para ler gráficos e tabelas.'],
  humanas: ['Cobre causas e consequências.', 'Use trechos de documentos da época.'],
  portugues: ['Use textos curtos para interpretar.', 'Cobre o sentido das palavras no texto.'],
  idiomas: ['Escreva os enunciados no idioma estudado.', 'Cobre vocabulário do dia a dia.'],
  programacao: ['Mostre trechos curtos de código.', 'Peça para prever a saída do código.'],
}
const exemplos = computed(() => [...(POR_AREA[props.area] ?? []), ...GERAIS].slice(0, 4))
const usado = (e) => props.estado.instrucoes.includes(e)
function usar(e) {
  if (usado(e)) return
  const atual = props.estado.instrucoes.trim()
  props.estado.instrucoes = `${atual ? `${atual} ` : ''}${e}`.slice(0, MAX_INSTRUCOES)
}
</script>

<template>
  <section class="px-5 py-5 sm:px-7">
    <button
      type="button"
      class="flex w-full items-center gap-3 rounded-[12px] text-left"
      :aria-expanded="aberto"
      :aria-controls="`${id}-c`"
      @click="aberto = !aberto"
    >
      <MessageSquareText :size="20" :stroke-width="2" class="shrink-0 text-texto-2" aria-hidden="true" />
      <span class="min-w-0 flex-1">
        <span class="titulo-secao block">Pedido para a IA <span class="ml-1 align-middle font-sans text-[13.5px] font-medium tracking-normal text-texto-3">opcional</span></span>
        <span class="mt-1 block truncate text-[14px] text-texto-2">{{ estado.instrucoes.trim() || 'Diga o que mais a IA deve levar em conta.' }}</span>
      </span>
      <ChevronDown :size="20" :stroke-width="2" class="seta shrink-0 text-texto-2" :class="aberto && 'rotate-180'" aria-hidden="true" />
    </button>
    <Transition name="abre">
      <div v-if="aberto" :id="`${id}-c`">
        <div class="pt-4">
          <label class="rotulo" :for="`${id}-t`">O que mais a IA deve saber</label>
          <textarea
            :id="`${id}-t`"
            v-model="estado.instrucoes"
            class="campo min-h-[92px] max-w-[640px] resize-y py-2.5"
            rows="3"
            :maxlength="MAX_INSTRUCOES"
            :aria-describedby="`${id}-a`"
          />
          <p :id="`${id}-a`" class="ajuda flex max-w-[640px] justify-between gap-3">
            <span>Vale como preferência: as regras do PGC continuam valendo.</span>
            <Fracao :valor="estado.instrucoes.length" :total="MAX_INSTRUCOES" sem-animacao />
          </p>
          <div class="mt-3 flex flex-wrap gap-2" role="group" aria-label="Exemplos para usar">
            <button v-for="e in exemplos" :key="e" type="button" class="pilula text-[13.5px]" :disabled="usado(e)" @click="usar(e)">
              <Plus :size="14" :stroke-width="2.4" aria-hidden="true" />{{ e }}
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </section>
</template>

<style scoped>
.seta {
  transition: transform 0.25s var(--ease-saida);
}
.pilula:disabled {
  opacity: 0.45;
  cursor: default;
}
</style>
