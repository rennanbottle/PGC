<script setup>
// Telas que ainda não foram construídas (hoje, só a Prova). Endereço desconhecido: 404.
// Travada: <TelaBloqueada> mostra o que falta para liberar. Liberada: o guia comemora e a tela diz o que vem e o que
// dá para fazer enquanto isso. Quando a tela de verdade existir (por exemplo pages/prova.vue), o Nuxt usa ela.
import { Brain, CalendarPlus, ClipboardCheck, Layers, Timer } from '@lucide/vue'
import { secoesComEstado } from '#shared/regras/navegacao.js'

const route = useRoute()
const estatisticas = useEstatisticas()
const secao = computed(() => secoesComEstado(estatisticas.value).find((s) => s.id === route.params.secao && !s.pronta) ?? null)

if (!secao.value) {
  throw createError({ statusCode: 404, statusMessage: 'Página não encontrada', fatal: true })
}
useHead({ title: () => `${secao.value?.nome ?? 'PGC'} | PGC` })

// O que a tela vai ter (por seção) e o que fazer enquanto isso.
const PREVIAS = {
  prova: {
    itens: [
      { icone: Timer, titulo: 'Cronômetro', texto: 'Tempo de prova de verdade, com aviso antes de acabar.' },
      { icone: Layers, titulo: 'Várias matérias juntas', texto: 'Você escolhe as matérias e quantas questões de cada.' },
      { icone: ClipboardCheck, titulo: 'Nota no fim', texto: 'Acertos por matéria e as questões para revisar.' },
    ],
    acoes: [
      { texto: 'Começar um estudo', para: '/revisar/nova', icone: Brain, principal: true },
      { texto: 'Marcar prova na agenda', para: '/agenda?novo=prova', icone: CalendarPlus },
    ],
  },
}
const previa = computed(() => PREVIAS[secao.value?.id] ?? { itens: [], acoes: [{ texto: 'Voltar para o início', para: '/inicio', principal: true }] })
</script>

<template>
  <div v-if="secao" class="mx-auto w-full max-w-[1100px]">
    <TelaBloqueada v-if="secao.bloqueada" :nome="secao.nome" :resumo="secao.resumo" :requisitos="secao.bloqueio.requisitos" />

    <div v-else class="grid gap-8 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:gap-14">
      <div class="entra flex flex-col items-start" style="--i: 0">
        <div class="flex items-end gap-4">
          <GuiaPersonagem humor="comemorando" :tamanho="104" class="hidden shrink-0 sm:block" />
          <GuiaPersonagem humor="comemorando" :tamanho="76" class="shrink-0 sm:hidden" />
          <p class="fala-breve relative mb-3 max-w-[230px] rounded-[14px] border border-borda bg-folha px-3 py-2 text-[13.5px] leading-[1.4] text-texto-2">
            Você liberou esta tela. Ela está quase pronta.
          </p>
        </div>
        <div class="mt-5 flex flex-wrap items-center gap-3">
          <TituloPagina>{{ secao.nome }}</TituloPagina>
          <span class="selo" data-tipo="acento">Chega em breve</span>
        </div>
        <p class="m-0 mt-2.5 max-w-[440px] text-[16px] leading-normal text-texto-2">{{ secao.resumo }}</p>
        <div class="mt-6 flex flex-wrap items-center gap-3">
          <NuxtLink
            v-for="a in previa.acoes"
            :key="a.para"
            :to="a.para"
            :class="a.principal ? 'botao' : 'botao-secundario'"
          >
            <component :is="a.icone" v-if="a.icone" :size="18" :stroke-width="2" aria-hidden="true" />
            <span>{{ a.texto }}</span>
          </NuxtLink>
        </div>
        <p v-if="secao.id === 'prova'" class="m-0 mt-3 max-w-[440px] text-[13.5px] leading-[1.45] text-texto-3">
          Enquanto isso, um estudo com muitas questões treina do mesmo jeito.
        </p>
      </div>

      <section v-if="previa.itens.length" class="cartao entra self-start !p-0 lg:mt-14" style="--i: 1" aria-labelledby="titulo-previa">
        <h2 id="titulo-previa" class="titulo-secao px-5 pt-5 sm:px-6">O que vem na {{ secao.nome }}</h2>
        <ul class="m-0 mt-2 list-none divide-y divide-borda p-0 px-5 pb-2 sm:px-6">
          <li v-for="(item, i) in previa.itens" :key="item.titulo" class="entra flex gap-3.5 py-4" :style="{ '--i': i + 2 }">
            <component :is="item.icone" :size="20" :stroke-width="2" class="mt-0.5 shrink-0 text-acento" aria-hidden="true" />
            <div>
              <p class="m-0 text-[15px] font-semibold">{{ item.titulo }}</p>
              <p class="m-0 mt-0.5 text-[14px] leading-[1.45] text-texto-2">{{ item.texto }}</p>
            </div>
          </li>
        </ul>
      </section>
    </div>
  </div>
</template>

<style scoped>
.fala-breve::before {
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
</style>
