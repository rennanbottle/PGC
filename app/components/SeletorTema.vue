<script setup>
// Tema do sistema, claro ou escuro. A escolha fica salva no navegador (@nuxtjs/color-mode).
// A troca abre um círculo a partir do botão; sem esse recurso no navegador, ou com "menos movimento", troca na hora.
import { Monitor, Moon, Sun } from '@lucide/vue'

const colorMode = useColorMode()
const botoes = ref([])
const opcoes = [
  { id: 'system', nome: 'Tema do sistema', icone: Monitor },
  { id: 'light', nome: 'Tema claro', icone: Sun },
  { id: 'dark', nome: 'Tema escuro', icone: Moon },
]
const indice = computed(() => Math.max(0, opcoes.findIndex((o) => o.id === colorMode.preference)))

function escolher(id, origem) {
  if (colorMode.preference === id) return
  const aplicar = async () => {
    colorMode.preference = id
    await nextTick()
  }
  const reduzir = window.matchMedia('(prefers-reduced-motion: reduce)').matches || document.documentElement.classList.contains('menos-movimento')
  if (!document.startViewTransition || reduzir) {
    aplicar()
    return
  }
  const caixa = origem?.getBoundingClientRect()
  const x = caixa ? caixa.left + caixa.width / 2 : window.innerWidth - 40
  const y = caixa ? caixa.top + caixa.height / 2 : 40
  const raio = Math.hypot(Math.max(x, window.innerWidth - x), Math.max(y, window.innerHeight - y))
  const transicao = document.startViewTransition(aplicar)
  transicao.ready
    .then(() => {
      document.documentElement.animate(
        { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${raio}px at ${x}px ${y}px)`] },
        { duration: 520, easing: 'cubic-bezier(.22,1,.36,1)', pseudoElement: '::view-transition-new(root)' },
      )
    })
    .catch(() => {})
}

// Setas do teclado andam entre as opções, como num grupo de rádio.
function teclado(evento) {
  const passo = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[evento.key]
  if (!passo) return
  evento.preventDefault()
  const proximo = (indice.value + passo + opcoes.length) % opcoes.length
  const botao = botoes.value[proximo]
  escolher(opcoes[proximo].id, botao)
  botao?.focus()
}
</script>

<template>
  <ClientOnly>
    <div role="radiogroup" aria-label="Tema" class="relative flex rounded-[12px] border border-borda bg-folha p-[3px]" @keydown="teclado">
      <span
        aria-hidden="true"
        class="absolute top-[3px] h-[32px] w-[34px] rounded-[9px] bg-acento-suave transition-[left] duration-300 ease-[cubic-bezier(.34,1.56,.64,1)]"
        :style="{ left: `${3 + indice * 34}px` }"
      />
      <button
        v-for="(opcao, i) in opcoes"
        :key="opcao.id"
        ref="botoes"
        type="button"
        role="radio"
        :aria-checked="colorMode.preference === opcao.id"
        :aria-label="opcao.nome"
        :data-dica="opcao.nome"
        data-dica-lado="baixo"
        :tabindex="indice === i ? 0 : -1"
        class="relative grid h-[32px] w-[34px] cursor-pointer place-items-center rounded-[9px] transition-colors"
        :class="colorMode.preference === opcao.id ? 'text-acento' : 'text-texto-3 hover:text-tinta'"
        @click="escolher(opcao.id, $event.currentTarget)"
      >
        <component :is="opcao.icone" :size="16" :stroke-width="2.1" class="transition-transform duration-500" :class="colorMode.preference === opcao.id && 'rotate-[360deg]'" aria-hidden="true" />
      </button>
    </div>
    <template #fallback>
      <div class="h-[40px] w-[110px] rounded-[12px] border border-borda" aria-hidden="true" />
    </template>
  </ClientOnly>
</template>
