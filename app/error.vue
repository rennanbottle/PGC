<script setup>
// Página de erro do PGC: endereço que não existe (404), acesso negado (403) ou falha do servidor (500).
// Mostra a marca, o guia com cara de confuso, o que aconteceu em palavras simples e o caminho de volta: o Início para
// quem está na conta, a página de apresentação para quem não está. Nunca mostra detalhe técnico nem pilha de erro.
import { ArrowLeft, House, RotateCcw } from '@lucide/vue'

const props = defineProps({
  error: { type: Object, default: () => ({}) },
})
const codigo = computed(() => Number(props.error?.statusCode) || 500)
const usuario = useSupabaseUser()
const route = useRoute()
const casa = computed(() => (usuario.value ? { para: '/inicio', texto: 'Voltar ao Início' } : { para: '/', texto: 'Ir para a página inicial' }))

const TEXTOS = {
  404: { titulo: 'Esta página não existe', texto: 'O endereço pode ter mudado ou ter sido digitado com uma letra a mais. O resto do PGC continua no lugar.' },
  403: { titulo: 'Esta página não é sua', texto: 'Ela pertence a outra conta ou ainda está fechada para você. Entre com a sua conta ou volte ao começo.' },
  401: { titulo: 'Entre na sua conta', texto: 'Para ver esta página, entre com o seu e-mail e senha.' },
}
const conteudo = computed(() => TEXTOS[codigo.value] ?? {
  titulo: 'Algo deu errado aqui',
  texto: props.error?.statusMessage && codigo.value < 500 ? props.error.statusMessage : 'O PGC não conseguiu abrir esta página agora. Tente de novo em alguns segundos. Se continuar, confira a internet.',
})

useHead({ title: () => `${conteudo.value.titulo} | PGC`, meta: [{ name: 'robots', content: 'noindex' }] })

const voltar = () => (window.history.length > 1 ? window.history.back() : clearError({ redirect: casa.value.para }))
const tentar = () => clearError({ redirect: route.fullPath })
</script>

<template>
  <main class="pagina-erro grid min-h-dvh place-items-center bg-mesa px-4 py-10 text-tinta">
    <div class="flex w-full max-w-[560px] flex-col items-center text-center">
      <NuxtLink :to="casa.para" class="text-[26px] no-underline" aria-label="PGC, página inicial"><MarcaPgc /></NuxtLink>

      <div class="mt-10 flex items-end justify-center gap-1">
        <span class="codigo-erro font-titulo tabular-nums" aria-hidden="true">{{ codigo }}</span>
        <GuiaPersonagem humor="confuso" :tamanho="96" class="guia-erro mb-2 shrink-0" />
      </div>

      <h1 class="m-0 mt-6 font-titulo text-[30px] font-extrabold leading-tight tracking-[-0.02em] sm:text-[34px]">{{ conteudo.titulo }}</h1>
      <p class="m-0 mt-3 max-w-[46ch] text-[16px] leading-[1.6] text-texto-2">{{ conteudo.texto }}</p>
      <p class="m-0 mt-2 text-[13px] text-texto-3">Código {{ codigo }}</p>

      <div class="mt-7 flex flex-wrap justify-center gap-2">
        <NuxtLink :to="casa.para" class="botao gap-2 no-underline" @click.prevent="clearError({ redirect: casa.para })"><House :size="17" :stroke-width="2.2" aria-hidden="true" />{{ casa.texto }}</NuxtLink>
        <button v-if="codigo >= 500" type="button" class="botao-secundario gap-2" @click="tentar"><RotateCcw :size="17" :stroke-width="2.2" aria-hidden="true" />Tentar de novo</button>
        <button v-else type="button" class="botao-secundario gap-2" @click="voltar"><ArrowLeft :size="17" :stroke-width="2.2" aria-hidden="true" />Voltar para onde estava</button>
      </div>
    </div>
  </main>
</template>

<style scoped>
.codigo-erro {
  display: block;
  font-size: clamp(92px, 24vw, 160px);
  font-weight: 800;
  line-height: 0.9;
  letter-spacing: -0.06em;
  color: var(--acento);
  animation: entra 0.6s var(--ease-saida) backwards;
}
.guia-erro {
  animation: balanca 3.2s ease-in-out 0.6s infinite;
  transform-origin: 50% 90%;
}
@keyframes balanca {
  0%,
  100% {
    transform: rotate(-4deg) translateY(0);
  }
  50% {
    transform: rotate(4deg) translateY(-4px);
  }
}
@media (prefers-reduced-motion: reduce) {
  .codigo-erro,
  .guia-erro {
    animation: none;
  }
}
:global(:root.menos-movimento) .codigo-erro,
:global(:root.menos-movimento) .guia-erro {
  animation: none;
}
</style>
