<script setup>
// Contagem do tipo 12/20: o número forte e o total apagado. Leitores de tela ouvem "12 de 20".
// Uso: <Fracao :valor="12" :total="20" />   <Fracao :valor="3" :total="8" sem-animacao />
defineProps({
  valor: { type: Number, default: 0 },
  total: { type: Number, default: 0 },
  semAnimacao: { type: Boolean, default: false },
})
</script>

<template>
  <span class="fracao">
    <span aria-hidden="true"><NumeroAnimado v-if="!semAnimacao" :valor="valor" /><template v-else>{{ valor }}</template><span class="fracao-total">/{{ total }}</span></span>
    <span class="so-leitor">{{ valor }} de {{ total }}</span>
  </span>
</template>
