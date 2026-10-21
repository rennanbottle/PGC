<script setup>
// Botão de criar ou adicionar: o "+" gira um quarto de volta ao passar o mouse.
// Uso: <BotaoAdicionar @click="...">Nova matéria</BotaoAdicionar>
//      <BotaoAdicionar redondo rotulo="Adicionar evento" />  (só o ícone)
import { Plus } from '@lucide/vue'

defineProps({
  redondo: { type: Boolean, default: false },
  rotulo: { type: String, default: undefined },
  secundario: { type: Boolean, default: false },
  tamanho: { type: String, default: '' },
  tipo: { type: String, default: 'button' },
  desativado: { type: Boolean, default: false },
})
</script>

<template>
  <button
    :type="tipo"
    class="botao-adicionar"
    :class="[redondo ? 'botao-adicionar-redondo' : secundario ? 'botao-secundario' : 'botao', tamanho && `botao-${tamanho}`]"
    :aria-label="rotulo"
    :title="redondo ? rotulo : undefined"
    :disabled="desativado"
  >
    <Plus :size="redondo ? 20 : 18" :stroke-width="2.4" class="mais" aria-hidden="true" />
    <span v-if="!redondo"><slot /></span>
  </button>
</template>
