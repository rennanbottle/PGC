<script setup>
// Enquanto a IA do PGC escreve: o guia pensando, a barra e o caminho do que acontece (ler, escrever, conferir,
// salvar). O servidor faz tudo numa chamada só; o passo atual segue o tempo esperado e fecha quando a resposta chega.
import { BookOpen, Check, Save, ShieldCheck, Sparkles } from '@lucide/vue'
import { tempoEstimado } from '#shared/regras/gerar.js'

const props = defineProps({
  segundos: { type: Number, default: 0 },
  quantidade: { type: Number, default: 10 },
  modo: { type: String, default: 'ia' },
  comTexto: { type: Boolean, default: false },
})
const esperado = computed(() => Number.parseInt(tempoEstimado(props.modo, props.quantidade).gerar.replace(/\D/g, ''), 10) || 30)
const passos = computed(() => [
  { icone: BookOpen, texto: props.comTexto ? 'Lendo os textos marcados' : 'Juntando a matéria e os assuntos' },
  { icone: Sparkles, texto: props.modo === 'misto' ? 'Tirando do texto e a IA escrevendo o resto' : `A IA escreve ${props.quantidade} ${props.quantidade === 1 ? 'questão' : 'questões'}` },
  { icone: ShieldCheck, texto: 'O PGC confere cada uma' },
  { icone: Save, texto: 'Salvando no banco' },
])
const atual = computed(() => {
  const s = props.segundos
  if (s < 2) return 0
  if (s < esperado.value * 0.7) return 1
  if (s < esperado.value) return 2
  return 3
})
const largura = computed(() => `${Math.min(94, 6 + (props.segundos / esperado.value) * 82)}%`)
</script>

<template>
  <section class="cartao mx-auto max-w-[600px] px-6 py-8 sm:px-10" aria-labelledby="titulo-progresso" aria-busy="true">
    <div class="flex flex-col items-center text-center">
      <GuiaPersonagem humor="pensando" :tamanho="92" />
      <h2 id="titulo-progresso" class="titulo-secao mt-3">Gerando {{ quantidade }} {{ quantidade === 1 ? 'questão' : 'questões' }}</h2>
      <p class="m-0 mt-1.5 text-[14.5px] text-texto-2">Costuma levar de 10 a 40 segundos. Pode ficar nesta página.</p>
    </div>
    <div class="barra mt-6" role="progressbar" aria-label="Andamento" :aria-valuenow="Math.round(Number.parseFloat(largura))" aria-valuemin="0" aria-valuemax="100">
      <i :style="{ width: largura }" />
    </div>
    <ol class="m-0 mt-6 flex list-none flex-col gap-3 p-0" aria-live="polite">
      <li v-for="(p, i) in passos" :key="i" class="flex items-center gap-3 text-[14.5px]" :class="i > atual ? 'text-texto-3' : 'text-tinta'">
        <span class="grid size-7 shrink-0 place-items-center rounded-full" :class="i < atual ? 'bg-ok-vivo text-folha' : i === atual ? 'bg-acento-suave text-acento' : 'bg-folha-2'">
          <Check v-if="i < atual" :size="15" :stroke-width="2.8" aria-hidden="true" />
          <span v-else-if="i === atual" class="rodando" aria-hidden="true" />
          <component :is="p.icone" v-else :size="15" :stroke-width="2" aria-hidden="true" />
        </span>
        <span :class="i === atual && 'font-semibold'">{{ p.texto }}</span>
        <span v-if="i < atual" class="sr-only">, feito</span>
      </li>
    </ol>
    <p class="m-0 mt-6 text-center text-[13px] tabular-nums text-texto-3">{{ segundos }} s</p>
  </section>
</template>
