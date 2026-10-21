<script setup>
// Barra de baixo do celular e do tablet (até 1023 px): Início, Matérias, Estudar, Agenda e o botão Mais.
// Mais abre uma folha com as outras telas, o histórico, o perfil, o tema e o botão de sair.
import { Ellipsis, Lock, RotateCcwClock, UserRound } from '@lucide/vue'
import { BARRA_CELULAR } from '#shared/regras/navegacao.js'

const props = defineProps({
  secoes: { type: Array, required: true },
})
const route = useRoute()
const icones = ICONES_SECAO
const sair = useSair()
const janela = ref(null)
const saindo = ref(false)

const naBarra = computed(() => BARRA_CELULAR.map((id) => props.secoes.find((s) => s.id === id)).filter(Boolean))
const noMais = computed(() => props.secoes.filter((s) => !BARRA_CELULAR.includes(s.id)))
const ehAtual = (caminho) => route.path === caminho || route.path.startsWith(`${caminho}/`)
const maisAtivo = computed(() => ['/perfil', '/historico'].some((c) => ehAtual(c)) || noMais.value.some((s) => ehAtual(s.caminho)))

async function sairDaConta() {
  saindo.value = true
  janela.value?.fechar()
  await sair()
}
</script>

<template>
  <nav
    aria-label="Menu principal"
    class="fixed inset-x-0 bottom-0 z-20 grid grid-cols-5 border-t border-borda bg-folha/92 px-1 pb-[calc(8px+env(safe-area-inset-bottom))] pt-2 backdrop-blur-md lg:hidden"
  >
    <NuxtLink v-for="s in naBarra" :key="s.id" :to="s.caminho" class="item-barra" :aria-current="ehAtual(s.caminho) ? 'page' : undefined">
      <span class="icone-barra relative">
        <component :is="icones[s.icone]" :size="21" :stroke-width="ehAtual(s.caminho) ? 2.3 : 1.9" aria-hidden="true" />
        <span v-if="s.bloqueada" class="absolute right-2 top-0 grid size-3.5 place-items-center rounded-full bg-folha-3" aria-hidden="true">
          <Lock :size="8" :stroke-width="2.6" />
        </span>
      </span>
      <span>{{ s.nome }}<span v-if="s.bloqueada" class="so-leitor">, bloqueada</span></span>
    </NuxtLink>
    <button type="button" class="item-barra" :aria-current="maisAtivo ? 'page' : undefined" aria-haspopup="dialog" @click="janela.abrir()">
      <span class="icone-barra"><Ellipsis :size="21" :stroke-width="2" aria-hidden="true" /></span>
      <span>Mais</span>
    </button>
  </nav>

  <JanelaBase ref="janela" titulo="Mais">
    <ul class="m-0 -mx-2 flex list-none flex-col gap-0.5 p-0">
      <li v-for="s in noMais" :key="s.id">
        <NuxtLink :to="s.caminho" class="linha-mais" :aria-current="ehAtual(s.caminho) ? 'page' : undefined" @click="janela.fechar()">
          <component :is="icones[s.icone]" :size="20" :stroke-width="2" aria-hidden="true" />
          <span>{{ s.nome }}</span>
          <template v-if="s.bloqueada">
            <Lock :size="15" :stroke-width="2.2" class="ml-auto text-texto-3" aria-hidden="true" />
            <span class="so-leitor">, bloqueada</span>
          </template>
        </NuxtLink>
      </li>
      <li class="my-1.5 h-px bg-borda" aria-hidden="true" />
      <li>
        <NuxtLink to="/historico" class="linha-mais" :aria-current="ehAtual('/historico') ? 'page' : undefined" @click="janela.fechar()">
          <RotateCcwClock :size="20" :stroke-width="2" aria-hidden="true" />
          <span>Histórico</span>
        </NuxtLink>
      </li>
      <li>
        <NuxtLink to="/perfil" class="linha-mais" :aria-current="ehAtual('/perfil') ? 'page' : undefined" @click="janela.fechar()">
          <UserRound :size="20" :stroke-width="2" aria-hidden="true" />
          <span>Perfil e preferências</span>
        </NuxtLink>
      </li>
    </ul>
    <div class="flex items-center justify-between gap-3 rounded-2xl bg-folha-2 px-4 py-3">
      <span class="text-[15px] font-semibold">Tema</span>
      <SeletorTema />
    </div>
    <BotaoSair class="self-start" texto="Sair da conta" :carregando="saindo" @click="sairDaConta" />
  </JanelaBase>
</template>
