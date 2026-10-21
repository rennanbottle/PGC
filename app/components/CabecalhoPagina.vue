<script setup>
// Cabeçalho padrão das telas: caminho de volta (opcional), título, descrição e os botões da tela à direita.
// No celular os botões descem para baixo do título.
// Uso:
//   <CabecalhoPagina titulo="Matérias" descricao="..." :voltar="{ para: '/inicio', texto: 'Início' }">
//     <template #acoes><button class="botao">Nova matéria</button></template>
//   </CabecalhoPagina>
import { ArrowLeft } from '@lucide/vue'

defineProps({
  titulo: { type: String, required: true },
  descricao: { type: String, default: '' },
  voltar: { type: Object, default: null },
})
</script>

<template>
  <header class="mb-7 flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
    <div class="min-w-0">
      <NuxtLink v-if="voltar" :to="voltar.para" class="volta mb-3">
        <ArrowLeft :size="17" :stroke-width="2" aria-hidden="true" />
        <span>{{ voltar.texto }}</span>
      </NuxtLink>
      <slot name="antes" />
      <TituloPagina>{{ titulo }}</TituloPagina>
      <p v-if="descricao || $slots.descricao" class="descricao-pagina">
        <slot name="descricao">{{ descricao }}</slot>
      </p>
    </div>
    <div v-if="$slots.acoes" class="flex shrink-0 flex-wrap items-center gap-2.5 aparece">
      <slot name="acoes" />
    </div>
  </header>
</template>
