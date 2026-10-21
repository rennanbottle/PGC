<script setup>
// Um grupo da página "Gerar questões": ícone e título (sem número), uma frase de ajuda e o conteúdo.
// Os grupos ficam na mesma folha, separados por uma divisória fina.
const props = defineProps({
  icone: { type: [Object, Function], default: null },
  titulo: { type: String, required: true },
  descricao: { type: String, default: '' },
  opcional: { type: Boolean, default: false },
  guia: { type: String, default: '' },
})
const id = useId()
</script>

<template>
  <section class="px-5 py-6 sm:px-7" :data-guia="props.guia || undefined" :aria-labelledby="`${id}-t`">
    <header class="flex items-start gap-3">
      <component :is="icone" v-if="icone" :size="20" :stroke-width="2" class="mt-[2px] shrink-0 text-texto-2" aria-hidden="true" />
      <div class="min-w-0 flex-1">
        <h2 :id="`${id}-t`" class="titulo-secao">
          {{ titulo }}<span v-if="opcional" class="ml-2 align-middle font-sans text-[13.5px] font-medium tracking-normal text-texto-3">opcional</span>
        </h2>
        <p v-if="descricao" class="m-0 mt-1 text-[14px] text-texto-2">{{ descricao }}</p>
      </div>
      <slot name="acoes" />
    </header>
    <div class="mt-5">
      <slot />
    </div>
  </section>
</template>
