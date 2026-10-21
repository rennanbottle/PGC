<script setup>
// Moldura das telas de entrada: o topo com a marca e o tema, as abas Entrar e Criar conta e a folha.
// O topo faz parte da página (não fica preso por cima dela). Antes ele ficava fixo e transparente: depois de rolar,
// cobria as abas e o clique em "Entrar" ou "Criar conta" não chegava nelas.
// No celular a folha ocupa a largura toda e vai até o fim da tela; no computador fica no centro.
import { Lock } from '@lucide/vue'

const route = useRoute()
const comAbas = computed(() => !route.meta.semAbas)
const naTelaEntrar = computed(() => route.path === '/entrar')
// A aba "Entrar" continua marcada em "Recuperar senha", que faz parte dela.
// aria-current="page" na tela exata; "true" quando é só a seção.
function marcaAba(caminho) {
  if (route.path === caminho) return 'page'
  if (caminho === '/entrar' && route.path === '/recuperar-senha') return 'true'
  return undefined
}
</script>

<template>
  <div class="flex min-h-dvh flex-col">
    <header class="flex h-[62px] shrink-0 items-center justify-between pl-5 pr-3.5 sm:h-[76px] sm:px-9">
      <NuxtLink to="/" class="rounded-md text-[24px] no-underline sm:text-[30px]">
        <MarcaPgc entrada />
        <span class="so-leitor">, ir para a apresentação do PGC</span>
      </NuxtLink>
      <div class="flex items-center gap-1 sm:gap-2">
        <NuxtLink to="/" class="link-discreto whitespace-nowrap px-1 text-[13.5px] font-semibold sm:px-2 sm:text-[14.5px]">Conhecer o PGC</NuxtLink>
        <SeletorTema />
      </div>
    </header>

    <main class="flex flex-1 flex-col sm:px-8 sm:pb-10 sm:pt-2">
      <div class="flex flex-1 flex-col sm:m-auto sm:w-[548px] sm:flex-none">
        <nav
          v-if="comAbas"
          aria-label="Entrar ou criar conta"
          class="relative z-[2] grid shrink-0 grid-cols-2 gap-1.5 px-3 sm:flex sm:px-10"
        >
          <NuxtLink to="/entrar" class="aba" :aria-current="marcaAba('/entrar')">Entrar</NuxtLink>
          <NuxtLink to="/criar-conta" class="aba" :aria-current="marcaAba('/criar-conta')">Criar conta</NuxtLink>
        </nav>

        <div
          class="folha flex flex-1 flex-col rounded-t-[20px] border-t border-borda px-5 pb-6 pt-[26px] shadow-[0_-10px_30px_-24px_var(--sombra)] sm:rounded-[20px] sm:border sm:px-14 sm:pb-11 sm:pt-10 sm:shadow-[0_1px_0_var(--borda),0_30px_60px_-38px_var(--sombra)]"
        >
          <div class="relative flex flex-1 flex-col">
            <slot />
          </div>
          <p v-if="naTelaEntrar" class="mt-7 flex items-center justify-center gap-[7px] text-[13.5px] text-texto-2 sm:hidden">
            <Lock :size="14" :stroke-width="1.9" aria-hidden="true" />
            <span>Seus textos, respostas e progresso são privados.</span>
          </p>
        </div>

        <p class="mt-[22px] hidden items-center justify-center gap-[7px] text-[13.5px] text-texto-2 sm:flex">
          <Lock :size="14" :stroke-width="1.9" aria-hidden="true" />
          <span>Seus textos, respostas e progresso são privados.</span>
        </p>
      </div>
    </main>
  </div>
</template>
