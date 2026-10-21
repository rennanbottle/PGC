<script setup>
// Uma parte do perfil: título com ícone e linhas (rótulo à esquerda, controle à direita) separadas por divisórias.
// O id vira a âncora (/perfil#estudo). Uso: <PerfilSecao id="estudo" titulo="Estudo" :icone="Gauge"> <PerfilLinha .../> </PerfilSecao>
defineProps({
  id: { type: String, required: true },
  titulo: { type: String, required: true },
  icone: { type: [Object, Function], default: null },
  descricao: { type: String, default: '' },
})
</script>

<template>
  <section :id="id" class="cartao scroll-mt-6 !px-0 !pb-1.5 !pt-5" :aria-labelledby="`titulo-${id}`">
    <div class="flex items-center gap-2.5 px-5 sm:px-6">
      <component :is="icone" v-if="icone" :size="20" :stroke-width="2" class="shrink-0 text-texto-2" aria-hidden="true" />
      <h2 :id="`titulo-${id}`" class="titulo-secao">{{ titulo }}</h2>
    </div>
    <p v-if="descricao" class="m-0 mt-1 px-5 text-[14px] leading-[1.45] text-texto-2 sm:px-6">{{ descricao }}</p>
    <div class="mt-2 divide-y divide-borda px-5 sm:px-6">
      <slot />
    </div>
  </section>
</template>
