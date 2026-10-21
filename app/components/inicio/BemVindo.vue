<script setup>
// Boas-vindas depois do cadastro (/inicio?bem_vindo=1): o guia acena e mostra o primeiro passo.
import { Plus } from '@lucide/vue'

defineProps({
  nome: { type: String, default: '' },
  semMateria: { type: Boolean, default: true },
})
const emit = defineEmits(['fechar'])
</script>

<template>
  <section class="cartao relative flex flex-col gap-5 sm:flex-row sm:items-center" aria-labelledby="titulo-boas-vindas">
    <GuiaPersonagem humor="acenando" :tamanho="112" class="shrink-0" />
    <div class="min-w-0">
      <h2 id="titulo-boas-vindas" class="m-0 font-titulo text-[27px] font-semibold leading-[1.15] tracking-[-0.015em]">
        Que bom ter você aqui{{ nome ? `, ${nome}` : '' }}.
      </h2>
      <p class="m-0 mt-2 max-w-[560px] text-[15.5px] leading-normal text-texto-2">
        Eu sou o seu guia. Comece criando uma matéria, por exemplo Matemática. Depois eu ajudo a montar as questões e o primeiro estudo.
      </p>
      <div class="mt-4 flex flex-wrap items-center gap-3">
        <NuxtLink v-if="semMateria" to="/materias?nova=1" class="botao botao-g">
          <Plus :size="19" :stroke-width="2.2" aria-hidden="true" />
          <span>Criar a primeira matéria</span>
        </NuxtLink>
        <button type="button" class="botao-fantasma" @click="emit('fechar')">{{ semMateria ? 'Agora não' : 'Fechar' }}</button>
      </div>
    </div>
  </section>
</template>
