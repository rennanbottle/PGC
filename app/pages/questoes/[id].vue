<script setup>
// Editar uma questão do banco.
const route = useRoute()
</script>

<template>
  <QuestoesEditor :key="route.params.id" :questao-id="String(route.params.id)" />
</template>
