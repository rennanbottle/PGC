<script setup>
// Janela do PGC. No computador abre no centro; no celular sobe de baixo como uma folha, com uma alça no topo.
// Usa o <dialog> do navegador: prende o foco, fecha com Esc e devolve o foco a quem abriu. Entra e sai com animação.
// Uso: <JanelaBase ref="janela" titulo="Nova matéria" descricao="..."> ... <template #rodape>botões</template></JanelaBase>
//      e depois janela.value.abrir().
import { X } from '@lucide/vue'

const props = defineProps({
  titulo: { type: String, required: true },
  descricao: { type: String, default: '' },
  folhaNoCelular: { type: Boolean, default: true },
  larga: { type: Boolean, default: false },
})
const emit = defineEmits(['fechou', 'abriu'])
const dialogo = ref(null)
const idTitulo = useId()
const aberta = ref(false)

function abrir() {
  if (dialogo.value?.open) return
  dialogo.value?.removeAttribute('data-fechando')
  dialogo.value?.showModal()
  aberta.value = true
  emit('abriu')
}

let fechando = null
function fechar() {
  const el = dialogo.value
  if (!el?.open || fechando) return
  const reduzir = window.matchMedia('(prefers-reduced-motion: reduce)').matches || document.documentElement.classList.contains('menos-movimento')
  if (reduzir) {
    el.close()
    return
  }
  el.setAttribute('data-fechando', '')
  fechando = setTimeout(() => {
    fechando = null
    el.removeAttribute('data-fechando')
    el.close()
  }, 170)
}

// Esc: em vez de sumir de uma vez, sai com a animação.
function cancelar(evento) {
  evento.preventDefault()
  fechar()
}
// Clique fora da janela (no fundo escuro) fecha.
function clique(evento) {
  if (evento.target === dialogo.value) fechar()
}
function fechou() {
  aberta.value = false
  emit('fechou')
}
onBeforeUnmount(() => clearTimeout(fechando))

defineExpose({ abrir, fechar, aberta })
</script>

<template>
  <dialog
    ref="dialogo"
    class="dialogo"
    :class="{ 'folha-de-baixo': props.folhaNoCelular, larga: props.larga }"
    :aria-labelledby="idTitulo"
    @click="clique"
    @cancel="cancelar"
    @close="fechou"
  >
    <div class="flex min-h-full flex-col">
      <span v-if="folhaNoCelular" class="mx-auto mt-2.5 block h-1.5 w-11 rounded-full bg-borda-forte sm:hidden" aria-hidden="true" />
      <div class="flex items-start justify-between gap-4 px-6 pb-1 pt-5 sm:pt-6">
        <div class="min-w-0">
          <h2 :id="idTitulo" class="titulo-secao text-[23px]">{{ titulo }}</h2>
          <p v-if="descricao" class="m-0 mt-1.5 text-[14.5px] leading-normal text-texto-2">{{ descricao }}</p>
        </div>
        <button type="button" class="botao-icone group -mr-2 -mt-1" aria-label="Fechar" @click="fechar">
          <X :size="20" :stroke-width="2" aria-hidden="true" class="transition-transform duration-300 group-hover:rotate-90" />
        </button>
      </div>
      <div class="flex flex-1 flex-col gap-4 px-6 pb-6 pt-4">
        <slot :fechar="fechar" />
      </div>
      <div v-if="$slots.rodape" class="sticky bottom-0 flex flex-wrap items-center justify-end gap-2.5 border-t border-borda bg-folha px-6 py-4">
        <slot name="rodape" :fechar="fechar" />
      </div>
    </div>
  </dialog>
</template>
