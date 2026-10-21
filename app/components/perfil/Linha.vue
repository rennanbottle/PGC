<script setup>
// Linha do perfil: rótulo e ajuda à esquerda, o controle à direita (no celular, um embaixo do outro).
// "salvo" mostra o visto verde por um instante, depois de gravar. "para" liga o rótulo ao campo (<label for>).
import { Check } from '@lucide/vue'

defineProps({
  rotulo: { type: String, required: true },
  para: { type: String, default: undefined },
  ajuda: { type: String, default: '' },
  idAjuda: { type: String, default: undefined },
  salvo: { type: Boolean, default: false },
})
</script>

<template>
  <div class="grid gap-x-8 gap-y-2.5 py-4 sm:grid-cols-[minmax(0,15.5rem)_minmax(0,1fr)] sm:items-start">
    <div class="min-w-0">
      <div class="flex min-h-[22px] flex-wrap items-center gap-x-2.5">
        <label v-if="para" :for="para" class="text-[14.5px] font-semibold text-tinta">{{ rotulo }}</label>
        <span v-else class="text-[14.5px] font-semibold text-tinta">{{ rotulo }}</span>
        <Transition name="desliza">
          <span v-if="salvo" class="inline-flex items-center gap-1 text-[12.5px] font-semibold text-ok">
            <Check :size="14" :stroke-width="2.6" aria-hidden="true" />
            <span>Salvo</span>
          </span>
        </Transition>
      </div>
      <p v-if="ajuda || $slots.ajuda" :id="idAjuda" class="m-0 mt-1 text-[13px] leading-[1.45] text-texto-3">
        <slot name="ajuda">{{ ajuda }}</slot>
      </p>
    </div>
    <div class="min-w-0 sm:pt-px">
      <slot />
    </div>
  </div>
</template>
