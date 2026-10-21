<script setup>
// Campo de senha com o botão da digital (como no VI-N): toca para mostrar ou esconder a senha.
// Ao mostrar, a digital fica azul e uma linha passa por ela, como um leitor. Leitores de tela ouvem o estado.
// Slot "acao": um link à direita do rótulo (ex.: "Esqueci a senha").
import { FingerprintPattern } from '@lucide/vue'

const senha = defineModel({ type: String, default: '' })
const props = defineProps({
  id: { type: String, required: true },
  rotulo: { type: String, default: 'Senha' },
  autocomplete: { type: String, default: 'current-password' },
  invalido: { type: Boolean, default: false },
  descricao: { type: String, default: undefined },
})
const visivel = ref(false)
const lendo = ref(false)
const nomeBotao = computed(() => `${visivel.value ? 'Ocultar' : 'Mostrar'} ${props.rotulo.toLowerCase()}`)
let relogio = null
function alternar() {
  visivel.value = !visivel.value
  lendo.value = false
  nextTick(() => {
    lendo.value = true
    clearTimeout(relogio)
    relogio = setTimeout(() => (lendo.value = false), 700)
  })
}
onBeforeUnmount(() => clearTimeout(relogio))
</script>

<template>
  <div>
    <div class="flex items-baseline justify-between gap-3">
      <label class="rotulo" :for="id">{{ rotulo }}</label>
      <slot name="acao" />
    </div>
    <div class="relative">
      <input
        :id="id"
        v-model="senha"
        class="campo pr-[56px]"
        :type="visivel ? 'text' : 'password'"
        :autocomplete="autocomplete"
        spellcheck="false"
        autocapitalize="off"
        :aria-invalid="invalido"
        :aria-describedby="descricao"
      >
      <button
        type="button"
        class="digital absolute right-[5px] top-1/2 grid size-9 -translate-y-1/2 cursor-pointer place-items-center rounded-[10px] border-0 transition-colors"
        :class="visivel ? 'bg-acento-suave text-acento' : 'bg-transparent text-texto-3 hover:bg-folha-2 hover:text-tinta'"
        :data-lendo="lendo || undefined"
        :aria-controls="id"
        :aria-label="nomeBotao"
        :aria-pressed="visivel"
        :data-dica="nomeBotao"
        data-dica-lado="baixo"
        @click="alternar"
      >
        <FingerprintPattern :size="20" :stroke-width="1.9" aria-hidden="true" />
      </button>
    </div>
    <p class="so-leitor" aria-live="polite">{{ visivel ? 'Sua senha está visível.' : 'Sua senha está oculta.' }}</p>
    <slot />
  </div>
</template>
