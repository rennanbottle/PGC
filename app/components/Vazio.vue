<script setup>
// Tela ou lista vazia: o guia, o que é, por que está vazio e o primeiro passo (nos botões do slot "acoes").
// Uso: <Vazio titulo="Nenhuma matéria ainda" texto="..." humor="acenando"><template #acoes>...</template></Vazio>
defineProps({
  titulo: { type: String, required: true },
  texto: { type: String, default: '' },
  humor: { type: String, default: 'curioso' },
  compacto: { type: Boolean, default: false },
})
</script>

<template>
  <section
    class="flex items-center gap-5 rounded-[20px] bg-folha-2"
    :class="compacto ? 'flex-row p-4 sm:p-5' : 'flex-col px-6 py-9 text-center sm:flex-row sm:px-8 sm:py-8 sm:text-left'"
  >
    <GuiaPersonagem :humor="humor" :tamanho="compacto ? 64 : 104" />
    <div class="min-w-0 flex-1">
      <h2 class="titulo-cartao" :class="!compacto && 'text-[20px]'">{{ titulo }}</h2>
      <p v-if="texto || $slots.default" class="m-0 mt-1.5 max-w-[560px] text-[14.5px] leading-normal text-texto-2"><slot>{{ texto }}</slot></p>
      <div v-if="$slots.acoes" class="mt-4 flex flex-wrap items-center gap-2.5" :class="!compacto && 'justify-center sm:justify-start'">
        <slot name="acoes" />
      </div>
    </div>
  </section>
</template>
