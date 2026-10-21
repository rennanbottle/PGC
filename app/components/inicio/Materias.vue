<script setup>
// Matérias num relance: cor, nome, quantos assuntos e quantas questões esperam revisão hoje.
import { BookOpen, ChevronRight, Plus } from '@lucide/vue'

const props = defineProps({
  materias: { type: Array, default: () => [] },
  vencidas: { type: Object, default: () => ({}) },
  noBanco: { type: Number, default: 0 },
  // Sem botão no vazio quando outro cartão já chama para criar a primeira matéria (boas-vindas).
  semAcao: { type: Boolean, default: false },
})
const MAXIMO = 6
const lista = computed(() => props.materias.slice(0, MAXIMO))
const assuntos = (m) => (m.assuntos ?? []).filter((a) => !a.arquivado_em).length
</script>

<template>
  <section class="cartao" aria-labelledby="titulo-materias-inicio">
    <div class="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
      <h2 id="titulo-materias-inicio" class="titulo-cartao m-0 flex items-center gap-2">
        <BookOpen :size="18" :stroke-width="2" class="text-texto-2" aria-hidden="true" />
        <span>Suas matérias</span>
      </h2>
      <span class="flex items-center gap-3 text-[14px]">
        <NuxtLink v-if="noBanco" to="/questoes" class="text-texto-2 no-underline hover:text-tinta">{{ noBanco }} questões no banco</NuxtLink>
        <NuxtLink to="/materias" class="link">Ver todas</NuxtLink>
      </span>
    </div>

    <ul v-if="lista.length" class="m-0 mt-3 grid list-none gap-x-6 p-0 sm:grid-cols-2">
      <li v-for="m in lista" :key="m.id" class="border-b border-borda last:border-b-0 sm:[&:nth-last-child(2):nth-child(odd)]:border-b-0">
        <NuxtLink :to="`/materias/${m.id}`" class="group -mx-2 flex min-h-[52px] items-center gap-3 rounded-[10px] px-2 py-2 no-underline transition-colors hover:bg-folha-2">
          <span class="size-3 shrink-0 rounded-full" :style="{ background: `${corMateria(m.cor)}` }" aria-hidden="true" />
          <span class="min-w-0 flex-1">
            <span class="block truncate text-[15px] font-semibold text-tinta">{{ m.nome }}</span>
            <span class="block text-[12.5px] text-texto-3">{{ assuntos(m) }} {{ assuntos(m) === 1 ? 'assunto' : 'assuntos' }}</span>
          </span>
          <span v-if="vencidas[m.id]" class="selo shrink-0" data-tipo="aviso">{{ vencidas[m.id] }} para revisar</span>
          <ChevronRight :size="16" :stroke-width="2" class="shrink-0 text-texto-3 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
        </NuxtLink>
      </li>
    </ul>
    <div v-else class="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-[14px] bg-folha-2 px-4 py-3.5">
      <p class="m-0 text-[14px] text-texto-2">Nenhuma matéria ainda. Cada matéria junta assuntos, textos e questões.</p>
      <NuxtLink v-if="!semAcao" to="/materias?nova=1" class="botao-secundario botao-p">
        <Plus :size="16" :stroke-width="2.2" aria-hidden="true" />
        <span>Criar matéria</span>
      </NuxtLink>
    </div>
    <p v-if="materias.length > MAXIMO" class="m-0 mt-2 text-[13px] text-texto-3">E mais {{ materias.length - MAXIMO }} em Matérias.</p>
  </section>
</template>
