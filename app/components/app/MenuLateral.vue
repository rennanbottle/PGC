<script setup>
// Menu lateral do computador (a partir de 1024 px), em três grupos: o seu dia, o que você estuda e a prática.
// A tela atual ganha um fundo azul claro que desliza de um item para o outro.
// Pode ser recolhido (só ícones, com o nome numa dica ao passar o mouse). Seção travada mostra um cadeado.
// Embaixo: o nível da conta com a barra até o próximo e o botão de recolher.
import { ChevronsLeft, ChevronsRight, Lock } from '@lucide/vue'
import { nivelPorPontos, pontosParaNivel } from '#shared/regras/pontos.js'

const props = defineProps({
  secoes: { type: Array, required: true },
  recolhido: { type: Boolean, default: false },
  pontos: { type: Number, default: 0 },
})
const emit = defineEmits(['alternar'])
const route = useRoute()
const icones = ICONES_SECAO
const ehAtual = (caminho) => route.path === caminho || route.path.startsWith(`${caminho}/`)

const grupos = computed(() => {
  const saida = []
  for (const s of props.secoes) {
    const ultimo = saida.at(-1)
    if (ultimo && ultimo.id === s.grupo) ultimo.itens.push(s)
    else saida.push({ id: s.grupo, itens: [s] })
  }
  return saida
})

const nivel = computed(() => nivelPorPontos(props.pontos))
const progressoNivel = computed(() => {
  const de = pontosParaNivel(nivel.value)
  const ate = pontosParaNivel(nivel.value + 1)
  return { falta: ate - props.pontos, pct: Math.round(((props.pontos - de) / Math.max(1, ate - de)) * 100) }
})

// Fundo do item atual: mede o link ativo e desliza até ele.
const nav = ref(null)
const indicador = ref({ top: 0, height: 0, visivel: false })
function medir() {
  const ativo = nav.value?.querySelector('[aria-current="page"]')
  if (!ativo) {
    indicador.value = { ...indicador.value, visivel: false }
    return
  }
  indicador.value = { top: ativo.offsetTop, height: ativo.offsetHeight, visivel: true }
}
watch(() => [route.path, props.recolhido], () => nextTick(medir))
onMounted(() => {
  medir()
  window.addEventListener('resize', medir)
})
onBeforeUnmount(() => window.removeEventListener('resize', medir))
</script>

<template>
  <aside
    class="fixed inset-y-0 left-0 z-20 hidden flex-col pb-4 pt-6 transition-[width] duration-300 ease-[cubic-bezier(.16,1,.3,1)] lg:flex"
    :class="recolhido ? 'w-[80px] px-3.5' : 'w-[248px] px-4'"
  >
    <NuxtLink to="/inicio" class="flex h-10 items-center self-start rounded-xl px-2.5 text-[27px] no-underline">
      <MarcaPgc :so-icone="recolhido" />
      <span class="so-leitor">, ir para o início</span>
    </NuxtLink>

    <nav ref="nav" aria-label="Menu principal" class="menu-deslizante relative mt-8 flex flex-1 flex-col overflow-y-auto">
      <span
        class="pointer-events-none absolute inset-x-0 rounded-xl bg-acento-suave transition-[transform,height,opacity] duration-[420ms] ease-[cubic-bezier(.16,1,.3,1)]"
        :style="{ transform: `translateY(${indicador.top}px)`, height: `${indicador.height}px`, opacity: indicador.visivel ? 1 : 0 }"
        aria-hidden="true"
      />
      <template v-for="(g, gi) in grupos" :key="g.id">
        <span v-if="gi > 0" class="mx-3 my-2.5 block h-px bg-borda" aria-hidden="true" />
        <div class="flex flex-col gap-0.5">
          <NuxtLink
            v-for="s in g.itens"
            :key="s.id"
            :to="s.caminho"
            class="item-menu"
            :class="recolhido && 'justify-center px-0'"
            :aria-current="ehAtual(s.caminho) ? 'page' : undefined"
            :data-dica="recolhido ? s.nome : undefined"
            :data-guia="`menu-${s.id}`"
          >
            <component :is="icones[s.icone]" :size="20" :stroke-width="ehAtual(s.caminho) ? 2.3 : 1.9" class="shrink-0" aria-hidden="true" />
            <span :class="recolhido ? 'so-leitor' : 'truncate'">{{ s.nome }}</span>
            <template v-if="s.bloqueada">
              <span
                class="grid place-items-center rounded-full text-texto-3"
                :class="recolhido ? 'absolute right-2 top-1.5 size-4 bg-folha-3' : 'ml-auto'"
                aria-hidden="true"
              >
                <Lock :size="recolhido ? 9 : 14" :stroke-width="2.4" />
              </span>
              <span class="so-leitor">, bloqueada</span>
            </template>
          </NuxtLink>
        </div>
      </template>
    </nav>

    <NuxtLink
      v-if="!recolhido"
      to="/ranking"
      class="mb-2 mt-3 block rounded-2xl border border-borda bg-folha p-3.5 no-underline transition-colors hover:border-borda-forte"
      :data-guia="'menu-nivel'"
    >
      <span class="flex items-baseline justify-between gap-2">
        <span class="font-titulo text-[15px] font-bold text-tinta">Nível {{ nivel }}</span>
        <span class="text-[12.5px] font-semibold tabular-nums text-energia-texto">{{ pontos.toLocaleString('pt-BR') }} pontos</span>
      </span>
      <span class="barra fina mt-2.5 block" aria-hidden="true"><i :style="{ width: `${progressoNivel.pct}%`, background: 'var(--energia)' }" /></span>
      <span class="mt-1.5 block text-[12px] text-texto-3">Faltam {{ progressoNivel.falta.toLocaleString('pt-BR') }} para o nível {{ nivel + 1 }}</span>
    </NuxtLink>

    <button
      type="button"
      class="item-menu cursor-pointer text-[14px]"
      :class="recolhido && 'justify-center px-0'"
      :aria-label="recolhido ? 'Abrir o menu' : 'Recolher o menu'"
      :aria-expanded="!recolhido"
      :data-dica="recolhido ? 'Abrir o menu' : undefined"
      @click="emit('alternar')"
    >
      <component :is="recolhido ? ChevronsRight : ChevronsLeft" :size="18" :stroke-width="2" aria-hidden="true" />
      <span v-if="!recolhido" aria-hidden="true">Recolher</span>
    </button>
  </aside>
</template>
