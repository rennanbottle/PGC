<script setup>
// Nova questão. "?copiar=id" começa com uma cópia; "?materia=" e "?assunto=" já escolhem onde ela fica.
const route = useRoute()
const copiar = typeof route.query.copiar === 'string' ? route.query.copiar : ''
</script>

<template>
  <QuestoesEditor :copiar-de="copiar" />
</template>
