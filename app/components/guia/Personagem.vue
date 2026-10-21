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
