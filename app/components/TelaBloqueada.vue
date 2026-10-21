<script setup>
// Tela travada, em duas colunas desencontradas: à esquerda o guia com o cadeado, o nome da tela, o que ela faz, o
// caminho já andado e o próximo passo; à direita (um pouco mais abaixo), cada requisito com barra que cresce,
// a contagem (12/20), quanto falta e uma ação que leva até ele. No celular, uma coluna só.
// Informação nunca só por cor: cada requisito tem o número, "Cumprido" ou "Faltam N" escrito e o ícone.
// Props: nome, resumo, requisitos [{ texto, atual, meta, ok, acao?: { texto, para } }] (de 1 a 5).
// "acoes" (opcional) troca a ação padrão de um requisito pelo texto dele: { 'Questões no seu banco': { texto, para } }.
import { BookOpen, Brain, Check, ClipboardList, Library, Lock, Shapes, Sparkles, Star, Target, Trophy } from '@lucide/vue'
import { estaLiberado } from '#shared/regras/desbloqueios.js'

const props = defineProps({
  nome: { type: String, required: true },
  resumo: { type: String, default: '' },
  requisitos: { type: Array, default: () => [] },
  acoes: { type: Object, default: () => ({}) },
})

// Ação padrão de cada requisito (pelo texto que vem de shared/regras/desbloqueios.js).
// "rotulo" corrige palavras antigas na tela ("material" é "texto" na interface).
const PADRAO = {
  'Matérias criadas': { texto: 'Criar matéria', para: '/materias?nova=1', icone: BookOpen, porque: 'Cada texto da Biblioteca fica guardado dentro de uma matéria.' },
  'Questões no seu banco': { texto: 'Gerar questões', para: '/questoes/gerar', icone: Sparkles, porque: 'Cada estudo usa as questões do seu banco. Com 10, já dá para um estudo curto.' },
  'Estudos concluídos': { texto: 'Estudar agora', para: '/revisar/nova', icone: Brain, porque: 'Conta cada estudo que você termina até a última questão.' },
  'Estudos concluídos com 5 questões ou mais': { texto: 'Estudar 5 questões ou mais', para: '/revisar/nova', icone: Brain, porque: 'Estudos curtos demais não contam: assim o ranking compara estudos de verdade.' },
  'Estudos concluídos com 10 questões ou mais': { texto: 'Estudar 10 questões ou mais', para: '/revisar/nova', icone: Brain },
  'Questões respondidas': { texto: 'Responder questões', para: '/revisar/nova', icone: ClipboardList },
  'Matérias com material conferido': { rotulo: 'Matérias com texto conferido', texto: 'Adicionar texto', para: '/materiais?adicionar=1', icone: Library },
  'Tipos de questão diferentes já respondidos': { texto: 'Gerar outros tipos', para: '/questoes/gerar', icone: Shapes },
  'Assuntos proficientes': { texto: 'Estudar um assunto', para: '/revisar/nova', icone: Target },
  'Assuntos dominados': { texto: 'Estudar um assunto', para: '/revisar/nova', icone: Trophy },
  'Nível da conta': { texto: 'Ganhar pontos', para: '/revisar/nova', icone: Star },
}

// Se a ação leva ao Estudar e ele ainda está travado, o caminho certo é gerar questões primeiro.
const estatisticas = useEstatisticas()
const estudarAberto = computed(() => estaLiberado('revisao', estatisticas.value))
const linhas = computed(() => props.requisitos.map((r, i) => {
  const padrao = PADRAO[r.texto] ?? {}
  let acao = r.acao ?? props.acoes[r.texto] ?? (padrao.para ? { texto: padrao.texto, para: padrao.para } : null)
  if (acao?.para?.startsWith('/revisar') && !estudarAberto.value) acao = { texto: 'Gerar questões primeiro', para: '/questoes/gerar' }
  const atual = Math.min(r.atual, r.meta)
  return {
    ...r,
    i,
    rotulo: padrao.rotulo ?? r.texto,
    porque: padrao.porque ?? '',
    icone: padrao.icone ?? Target,
    acao,
    atual,
    falta: Math.max(0, r.meta - r.atual),
    largura: `${Math.round(Math.min(1, r.atual / r.meta) * 100)}%`,
  }
}))
const cumpridos = computed(() => linhas.value.filter((r) => r.ok).length)
const progresso = computed(() => {
  if (!linhas.value.length) return 0
  return Math.round((linhas.value.reduce((s, r) => s + Math.min(1, r.atual / r.meta), 0) / linhas.value.length) * 100)
})
const proxima = computed(() => linhas.value.find((r) => !r.ok && r.acao) ?? null)
const humor = computed(() => (progresso.value >= 100 ? 'comemorativo' : progresso.value >= 50 ? 'encorajador' : 'curioso'))
const fala = computed(() => {
  if (progresso.value >= 100) return 'Tudo pronto. A tela abre na próxima visita.'
  if (progresso.value >= 50) return 'Você já passou da metade do caminho.'
  const varios = linhas.value.length > 1
  if (progresso.value > 0) return varios ? 'Já começou. Siga os passos ao lado.' : 'Já começou. Falta pouco, veja ao lado.'
  return varios ? 'Ainda trancada. Os passos ao lado abrem esta tela.' : 'Ainda trancada. O passo ao lado abre esta tela.'
})
</script>

<template>
  <div class="grid gap-8 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:gap-14">
    <!-- Esquerda: o que é a tela e o caminho -->
    <div class="entra flex flex-col items-start" style="--i: 0">
      <div class="flex items-end gap-4">
        <div class="relative shrink-0">
          <GuiaPersonagem :humor="humor" :tamanho="104" class="hidden sm:block" />
          <GuiaPersonagem :humor="humor" :tamanho="76" class="sm:hidden" />
          <span class="cadeado absolute -right-2 bottom-1 grid size-10 place-items-center rounded-full border border-borda bg-folha text-tinta sm:size-11" aria-hidden="true">
            <Lock :size="19" :stroke-width="2.1" />
          </span>
        </div>
        <p class="fala-trava relative mb-3 max-w-[220px] rounded-[14px] border border-borda bg-folha px-3 py-2 text-[13.5px] leading-[1.4] text-texto-2">{{ fala }}</p>
      </div>

      <TituloPagina class="mt-5">{{ nome }}</TituloPagina>
      <p v-if="resumo" class="m-0 mt-2.5 max-w-[440px] text-[16px] leading-normal text-texto-2">{{ resumo }}</p>

      <div class="mt-6 w-full max-w-[400px]">
        <div class="flex items-baseline justify-between gap-3 text-[14px]">
          <span class="font-semibold">Caminho para abrir</span>
          <span class="flex items-baseline gap-1.5 text-texto-2"><Fracao :valor="cumpridos" :total="linhas.length" /> cumpridos</span>
        </div>
        <div class="barra mt-2" role="img" :aria-label="`${progresso}% do caminho feito`">
          <i :style="{ width: `${progresso}%` }" />
        </div>
      </div>

      <div class="mt-6 flex flex-wrap items-center gap-x-5 gap-y-3">
        <NuxtLink v-if="proxima" :to="proxima.acao.para" class="botao">
          <component :is="proxima.icone" :size="18" :stroke-width="2" aria-hidden="true" />
          <span>{{ proxima.acao.texto }}</span>
        </NuxtLink>
        <NuxtLink to="/inicio" class="link text-[15px]">Ver os primeiros passos</NuxtLink>
      </div>
    </div>

    <!-- Direita: cada requisito (desce um pouco no computador) -->
    <section class="cartao entra self-start !p-0 lg:mt-14" style="--i: 1" aria-labelledby="titulo-requisitos">
      <h2 id="titulo-requisitos" class="titulo-secao px-5 pt-5 sm:px-6">Para abrir esta tela</h2>
      <ul class="m-0 mt-2 list-none divide-y divide-borda p-0 px-5 pb-2 sm:px-6">
        <li
          v-for="r in linhas"
          :key="r.texto"
          class="requisito flex gap-3.5 py-4"
          :style="{ '--i': r.i + 2 }"
        >
          <span
            class="mt-0.5 grid size-9 shrink-0 place-items-center rounded-full"
            :class="r.ok ? 'bg-ok-suave text-ok' : 'bg-folha-2 text-texto-2'"
            aria-hidden="true"
          >
            <Check v-if="r.ok" :size="18" :stroke-width="2.6" class="requisito-visto" />
            <component :is="r.icone" v-else :size="17" :stroke-width="2" />
          </span>
          <div class="min-w-0 flex-1">
            <div class="flex items-baseline justify-between gap-3">
              <p class="m-0 text-[15px] font-semibold leading-snug">
                {{ r.rotulo }}<span class="so-leitor">{{ r.ok ? ', cumprido' : '' }}</span>
              </p>
              <Fracao :valor="r.atual" :total="r.meta" class="shrink-0 text-[15px]" />
            </div>
            <p v-if="r.porque && linhas.length <= 2" class="m-0 mt-1 text-[13.5px] leading-[1.45] text-texto-2">{{ r.porque }}</p>
            <div class="barra fina mt-2.5" :data-tipo="r.ok ? 'ok' : undefined" aria-hidden="true">
              <i :style="{ width: r.largura, animationDelay: `${0.25 + r.i * 0.12}s` }" />
            </div>
            <div class="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1.5">
              <span v-if="r.ok" class="flex items-center gap-1.5 text-[13.5px] font-semibold text-ok">
                <Check :size="15" :stroke-width="2.6" aria-hidden="true" />
                <span>Cumprido</span>
              </span>
              <span v-else class="text-[13.5px] text-texto-2">Faltam {{ r.falta }}</span>
              <NuxtLink v-if="!r.ok && r.acao && linhas.length > 1" :to="r.acao.para" class="link text-[13.5px] sm:ml-auto">{{ r.acao.texto }}</NuxtLink>
            </div>
          </div>
        </li>
      </ul>
    </section>
  </div>
</template>

<style scoped>
.fala-trava::before {
  content: '';
  position: absolute;
  bottom: 12px;
  left: -6.5px;
  width: 12px;
  height: 12px;
  border-bottom: 1px solid var(--borda);
  border-left: 1px solid var(--borda);
  border-radius: 0 0 0 3px;
  background: var(--folha);
  transform: rotate(45deg);
}
.requisito {
  animation: entra 0.5s var(--ease-saida) backwards;
  animation-delay: calc(var(--i, 0) * 70ms + 80ms);
}
.requisito-visto {
  animation: pop 0.45s var(--ease-mola) 0.6s backwards;
}
@media (prefers-reduced-motion: reduce) {
  .requisito,
  .requisito-visto {
    animation: none;
  }
}
:global(:root.menos-movimento) .requisito,
:global(:root.menos-movimento) .requisito-visto {
  animation: none;
}
</style>
