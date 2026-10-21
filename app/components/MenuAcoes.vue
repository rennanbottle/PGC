<script setup>
// Menu de três pontinhos. Os pontinhos giram ao abrir; os itens entram em cascata.
// A lista abre por cima da página (presa à tela), então nunca fica cortada dentro de um cartão.
// Teclado: setas andam, Home e End vão às pontas, Esc fecha e devolve o foco ao botão.
// Itens: { id, texto, icone? (componente do Lucide), descricao?, perigo?, separar?, desativado? }.
// Ações perigosas ficam por último, em vermelho, com a lixeira que abre a tampa.
import { Ellipsis } from '@lucide/vue'

const props = defineProps({
  rotulo: { type: String, required: true },
  itens: { type: Array, required: true },
})
const emit = defineEmits(['escolher'])
const aberto = ref(false)
const botao = ref(null)
const lista = ref(null)
const destino = ref('body')
const pos = ref({ top: 0, left: 0, acima: false })
const LARGURA = 240

const opcoes = () => [...(lista.value?.querySelectorAll('[role="menuitem"]:not([disabled])') ?? [])]

function posicionar() {
  const r = botao.value?.getBoundingClientRect()
  if (!r) return
  const altura = lista.value?.offsetHeight ?? props.itens.length * 44 + 14
  const acima = window.innerHeight - r.bottom < altura + 16 && r.top > altura + 16
  pos.value = {
    acima,
    top: acima ? r.top - altura - 6 : r.bottom + 6,
    left: Math.min(Math.max(8, r.right - LARGURA), window.innerWidth - LARGURA - 8),
  }
}
function abrir() {
  destino.value = botao.value?.closest('dialog') ?? 'body'
  aberto.value = true
  nextTick(() => {
    posicionar()
    opcoes()[0]?.focus()
  })
}
function fechar(devolverFoco = true) {
  aberto.value = false
  if (devolverFoco) botao.value?.focus()
}
function escolher(item) {
  if (item.desativado) return
  fechar()
  emit('escolher', item.id)
}
function teclado(evento) {
  const itens = opcoes()
  const i = itens.indexOf(document.activeElement)
  const ir = (n) => {
    evento.preventDefault()
    itens[(n + itens.length) % itens.length]?.focus()
  }
  if (evento.key === 'ArrowDown') ir(i + 1)
  else if (evento.key === 'ArrowUp') ir(i - 1)
  else if (evento.key === 'Home') ir(0)
  else if (evento.key === 'End') ir(itens.length - 1)
  else if (evento.key === 'Escape') {
    evento.preventDefault()
    evento.stopPropagation()
    fechar()
  }
  else if (evento.key === 'Tab') fechar(false)
}
function cliqueFora(evento) {
  if (!aberto.value) return
  if (botao.value?.contains(evento.target) || lista.value?.contains(evento.target)) return
  fechar(false)
}
function aoRolar(evento) {
  if (aberto.value && !lista.value?.contains(evento.target)) fechar(false)
}
onMounted(() => {
  document.addEventListener('pointerdown', cliqueFora)
  window.addEventListener('scroll', aoRolar, true)
  window.addEventListener('resize', posicionar)
})
onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', cliqueFora)
  window.removeEventListener('scroll', aoRolar, true)
  window.removeEventListener('resize', posicionar)
})
</script>

<template>
  <div class="relative">
    <button
      ref="botao"
      type="button"
      class="botao-icone pequeno"
      :class="aberto && 'bg-folha-2 text-tinta'"
      :aria-label="rotulo"
      aria-haspopup="menu"
      :aria-expanded="aberto"
      @click="aberto ? fechar() : abrir()"
    >
      <Ellipsis :size="19" :stroke-width="2.2" class="transition-transform duration-300" :class="aberto && 'rotate-90'" aria-hidden="true" />
    </button>
    <Teleport v-if="aberto" :to="destino">
      <ul
        ref="lista"
        role="menu"
        :aria-label="rotulo"
        class="menu-acoes fixed right-auto"
        :class="pos.acima ? 'origin-bottom-right' : 'origin-top-right'"
        :style="{ top: `${pos.top}px`, left: `${pos.left}px`, width: `${LARGURA}px`, minWidth: 0 }"
        @keydown="teclado"
      >
        <li v-for="item in itens" :key="item.id" role="none" :class="item.separar && 'mt-1 border-t border-borda pt-1'">
          <button
            type="button"
            role="menuitem"
            class="item-acao"
            :class="item.perigo && 'perigo'"
            :disabled="item.desativado"
            @click="escolher(item)"
          >
            <BotaoLixeiraIcone v-if="item.perigo && !item.icone" :size="17" />
            <component :is="item.icone" v-else-if="item.icone" :size="17" :stroke-width="2" aria-hidden="true" />
            <span class="min-w-0 flex-1">
              {{ item.texto }}
              <span v-if="item.descricao" class="block text-[12.5px] font-normal text-texto-3">{{ item.descricao }}</span>
            </span>
          </button>
        </li>
      </ul>
    </Teleport>
  </div>
</template>
