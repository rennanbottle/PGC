<!-- Lixeira desenhada em duas partes: a tampa abre quando o botão em volta recebe o mouse ou o foco. -->
<script setup>
defineProps({ size: { type: Number, default: 18 } })
</script>

<template>
  <svg class="lixeira" :width="size" :height="size" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <g class="lixeira-tampa">
      <path d="M3 6h18" />
      <path d="M8 6V4.5A1.5 1.5 0 0 1 9.5 3h5A1.5 1.5 0 0 1 16 4.5V6" />
    </g>
    <path d="M18.5 6.5 17.6 20a2 2 0 0 1-2 1.9H8.4a2 2 0 0 1-2-1.9L5.5 6.5" />
    <path d="M10 11v6" />
    <path d="M14 11v6" />
  </svg>
</template>
