<script setup>
import { paletaDoPerfil } from '#shared/regras/perfil.js'
// Casca das telas internas.
// - Computador: menu lateral recolhível (três grupos), e no alto a meta do dia, os dias seguidos, o tema e a sua foto
//   (que abre o menu da conta: perfil, histórico, ajuda e sair).
// - Celular: cabeçalho compacto e barra de baixo com Mais.
// - Em todas: o guia no canto (guia), os avisos e a saída automática por inatividade (se ligada no perfil).
import { Flame } from '@lucide/vue'
import { RITMOS } from '#shared/regras/ritmo.js'
import { secoesComEstado, todasAsSecoesComEstado } from '#shared/regras/navegacao.js'

const { data: perfil } = usePerfil()
const usuario = useSupabaseUser()
const { avatar, carregar } = useAvatarDoPerfil()
const guiaDoCadastro = useGuiaDoPerfil()
const estatisticas = useEstatisticas()
const secoes = computed(() => secoesComEstado(estatisticas.value))
const historicoBloqueado = computed(() => todasAsSecoesComEstado(estatisticas.value).find((s) => s.id === 'historico')?.bloqueada ?? false)
const nome = computed(() => perfil.value?.nome_exibicao ?? '')

// Meta do dia e dias seguidos contam as respostas dos estudos (horário de Brasília).
const meta = computed(() => RITMOS[perfil.value?.ritmo]?.metaDiariaQuestoes ?? 20)
const { data: estudo } = useResumoEstudo()
const feitasHoje = computed(() => estudo.value?.hoje ?? 0)
const diasSeguidos = computed(() => estudo.value?.dias_seguidos ?? 0)
const pontos = computed(() => estudo.value?.pontos ?? 0)

// Menu recolhido fica salvo num cookie: o servidor já desenha certo, sem pulo na tela.
const comoTexto = { encode: (v) => String(v), decode: (v) => String(v) }
const menu = useCookie('pgc_menu', { ...comoTexto, maxAge: 60 * 60 * 24 * 365, sameSite: 'lax', path: '/' })
const recolhido = computed(() => menu.value === 'recolhido')
function alternarMenu() {
  menu.value = recolhido.value ? 'aberto' : 'recolhido'
}

// "Menos movimento" escolhido no perfil vale além do que o sistema operacional diz.
watch(() => perfil.value?.movimento_reduzido, (ligado) => {
  if (import.meta.client) document.documentElement.classList.toggle('menos-movimento', !!ligado)
}, { immediate: true })

// Cor do PGC escolhida no perfil (azul é o padrão e não precisa de marca no <html>).
watch(() => perfil.value?.paleta, (paleta) => {
  if (!import.meta.client) return
  const id = paletaDoPerfil(paleta)
  if (id === 'azul') delete document.documentElement.dataset.paleta
  else document.documentElement.dataset.paleta = id
}, { immediate: true })

// Saída automática por inatividade (minutos escolhidos no perfil; vazio = nunca).
const minutosInativo = computed(() => perfil.value?.sair_inativo_min ?? 0)
const inatividade = useSaidaPorInatividade(minutosInativo)

onMounted(() => {
  watch(perfil, (p) => {
    carregar(p)
    guiaDoCadastro.aplicar(p)
  }, { immediate: true })
})
</script>

<template>
  <div class="min-h-dvh">
    <a href="#conteudo" class="pular">Pular para o conteúdo</a>

    <AppMenuLateral :secoes="secoes" :recolhido="recolhido" :pontos="pontos" @alternar="alternarMenu" />

    <div class="transition-[padding] duration-300 ease-[cubic-bezier(.16,1,.3,1)]" :class="recolhido ? 'lg:pl-[80px]' : 'lg:pl-[248px]'">
      <!-- Celular e tablet -->
      <header class="sticky top-0 z-[15] flex h-[64px] items-center justify-between border-b border-borda bg-mesa/85 pl-4 pr-3 backdrop-blur-md lg:hidden">
        <NuxtLink to="/inicio" class="rounded-lg text-[23px] no-underline">
          <MarcaPgc />
          <span class="so-leitor">, ir para o início</span>
        </NuxtLink>
        <div class="flex items-center gap-2">
          <p class="chip m-0 h-9 gap-1.5 rounded-[11px] pl-1.5 pr-2.5 text-[13px]" data-guia="meta-celular">
            <AppAnelMeta :feitas="feitasHoje" :meta="meta" :tamanho="22" />
            <Fracao :valor="feitasHoje" :total="meta" />
          </p>
          <p class="chip m-0 h-9 gap-1 rounded-[11px] px-2.5 text-[13px]">
            <Flame :size="16" :stroke-width="2.2" class="text-energia" aria-hidden="true" />
            <span class="tabular-nums">{{ diasSeguidos }}</span>
            <span class="so-leitor">{{ diasSeguidos === 1 ? 'dia seguido' : 'dias seguidos' }} estudando</span>
          </p>
          <AppMenuConta :nome="nome" :email="usuario?.email" :avatar="avatar" :pontos="pontos" :historico-bloqueado="historicoBloqueado" :tamanho="36" />
        </div>
      </header>

      <!-- Computador -->
      <header class="relative z-[15] mx-auto hidden h-[84px] max-w-[1320px] items-center justify-end gap-2.5 px-8 lg:flex">
        <p class="chip m-0" data-guia="meta">
          <AppAnelMeta :feitas="feitasHoje" :meta="meta" :tamanho="24" />
          <Fracao :valor="feitasHoje" :total="meta" />
          <span class="font-medium text-texto-3">hoje</span>
        </p>
        <p class="chip m-0" :title="`${diasSeguidos} ${diasSeguidos === 1 ? 'dia seguido' : 'dias seguidos'} estudando`">
          <Flame :size="17" :stroke-width="2.2" class="text-energia" aria-hidden="true" />
          <span class="tabular-nums">{{ diasSeguidos }}</span>
          <span class="font-medium text-texto-3">{{ diasSeguidos === 1 ? 'dia' : 'dias' }}</span>
          <span class="so-leitor">seguidos estudando</span>
        </p>
        <SeletorTema />
        <AppMenuConta :nome="nome" :email="usuario?.email" :avatar="avatar" :pontos="pontos" :historico-bloqueado="historicoBloqueado" />
      </header>

      <main id="conteudo" tabindex="-1" class="relative mx-auto max-w-[1320px] px-4 pb-[120px] pt-6 outline-none sm:px-6 lg:px-8 lg:pb-16 lg:pt-1">
        <slot />
      </main>
    </div>

    <AppBarraInferior :secoes="secoes" />
    <Guia />
    <AppAvisos />

    <!-- Aviso de saída por inatividade: um minuto antes. -->
    <Teleport to="body">
      <Transition name="lista">
        <div v-if="inatividade.aviso.value" class="fixed inset-0 z-[96] grid place-items-center bg-[var(--fundo-janela)] p-4 backdrop-blur-[3px]" role="alertdialog" aria-labelledby="titulo-inativo" aria-describedby="texto-inativo">
          <section class="w-full max-w-[400px] rounded-[24px] border border-borda bg-folha p-6 text-center shadow-[var(--sombra-janela)]">
            <GuiaPersonagem humor="curioso" :tamanho="88" class="mx-auto" />
            <h2 id="titulo-inativo" class="titulo-secao mt-2">Ainda está aí?</h2>
            <p id="texto-inativo" class="m-0 mt-2 text-[15px] leading-normal text-texto-2">
              Sem atividade há um tempo. A conta sai sozinha em <b class="tabular-nums text-tinta">{{ inatividade.restante.value }} s</b>, como você escolheu no perfil.
            </p>
            <div class="mt-5 flex flex-wrap justify-center gap-2.5">
              <button type="button" class="botao" @click="inatividade.continuar()">Continuar conectado</button>
              <button type="button" class="botao-secundario" @click="inatividade.sairAgora()">Sair agora</button>
            </div>
          </section>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>
