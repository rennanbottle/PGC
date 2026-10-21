<script setup>
// Botão das ações que usam IA (gerar questões, sugerir assuntos). Tinta escura, com estrelinhas que piscam
// ao passar o mouse. Diz o que gasta no texto ao lado, nunca só pela cor.
// Uso: <BotaoIa :carregando="gerando" @click="gerar">Gerar 10 questões</BotaoIa>
defineProps({
  carregando: { type: Boolean, default: false },
  desativado: { type: Boolean, default: false },
  tipo: { type: String, default: 'button' },
  tamanho: { type: String, default: '' }, // '' | 'p' | 'g'
})
</script>

<template>
  <button
    :type="tipo"
    class="botao botao-ia"
    :class="tamanho && `botao-${tamanho}`"
    :disabled="desativado || carregando"
    :aria-busy="carregando || undefined"
  >
    <span v-if="carregando" class="rodando" aria-hidden="true" />
    <svg v-else width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path class="estrela" d="M9.5 6.5c.5 2.9 1.6 4 4.5 4.5-2.9.5-4 1.6-4.5 4.5-.5-2.9-1.6-4-4.5-4.5 2.9-.5 4-1.6 4.5-4.5Z" />
      <path class="estrela" d="M17.5 3c.25 1.4.85 2 2.25 2.25-1.4.25-2 .85-2.25 2.25-.25-1.4-.85-2-2.25-2.25 1.4-.25 2-.85 2.25-2.25Z" />
      <path class="estrela" d="M17.5 15.5c.2 1.1.65 1.55 1.75 1.75-1.1.2-1.55.65-1.75 1.75-.2-1.1-.65-1.55-1.75-1.75 1.1-.2 1.55-.65 1.75-1.75Z" />
    </svg>
    <span><slot /></span>
  </button>
</template>
