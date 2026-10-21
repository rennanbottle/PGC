<script setup>
// Ícone de cada tipo de item da agenda. Sempre com o nome do tipo ou o título por perto, em texto.
import { Bell, BookOpen, GraduationCap, ListTodo, Presentation, User } from '@lucide/vue'

defineProps({
  tipo: { type: String, default: 'estudo' },
  tamanho: { type: Number, default: 16 },
})
const ICONES = { prova: GraduationCap, trabalho: Presentation, tarefa: ListTodo, estudo: BookOpen, lembrete: Bell, pessoal: User }
</script>

<template>
  <component :is="ICONES[tipo] ?? BookOpen" :size="tamanho" :stroke-width="2" aria-hidden="true" class="shrink-0" />
</template>
