<script setup>
// O guia (personagem escolhido no cadastro ou no perfil) com a expressão do momento, uma das 12 de EXPRESSOES.
// Decorativo: quem fala é o texto ao lado. Os nomes antigos do mascote (pensando, comemorando...) também valem.
// Uso: <GuiaPersonagem humor="feliz" :tamanho="88" />. "imagem" mostra outro guia (prévia no cadastro).
import { posicaoNoSprite } from '#shared/regras/guias.js'

const props = defineProps({
  humor: { type: String, default: 'neutro' },
  tamanho: { type: Number, default: 96 },
  imagem: { type: String, default: '' },
  semFundo: { type: Boolean, default: false },
})
const { url } = useGuiaAtual()
const fonte = computed(() => props.imagem || url.value)
const estilo = computed(() => ({
  width: `${props.tamanho}px`,
  height: `${props.tamanho}px`,
  ...(fonte.value ? { backgroundImage: `url("${fonte.value}")`, backgroundPosition: posicaoNoSprite(props.humor) } : {}),
}))
</script>

<template>
  <span :key="humor" class="guia-personagem" :class="!semFundo && 'com-fundo'" :style="estilo" aria-hidden="true" />
</template>

<style scoped>
/* Na camada "components": as classes de quem usa (hidden, sm:block...) continuam valendo por cima. */
@layer components {
  .guia-personagem {
    display: inline-block;
    flex-shrink: 0;
    background-repeat: no-repeat;
    background-size: 400% 300%;
    animation: guia-troca 0.28s var(--ease-saida) both;
  }
  /* Fundo na cor da paleta, para o recorte do personagem não ficar solto na página. */
  .com-fundo {
    border-radius: 28%;
    background-color: var(--acento-suave);
  }
}
@keyframes guia-troca {
  from {
    opacity: 0.55;
    transform: scale(0.94);
  }
}
@media (prefers-reduced-motion: reduce) {
  .guia-personagem {
    animation: none;
  }
}
:global(:root.menos-movimento) .guia-personagem {
  animation: none;
}
</style>
