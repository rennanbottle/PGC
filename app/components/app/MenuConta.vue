<script setup>
// Menu da conta, aberto pela foto no canto de cima. Único caminho para o perfil (o menu lateral não repete).
// Mostra nome, e-mail e nível; leva ao Perfil, ao Histórico e à apresentação do PGC; liga o guia; sai da conta.
import { Lock, LogOut, Presentation, RotateCcwClock, Sparkles, UserRound } from '@lucide/vue'
import { nivelPorPontos } from '#shared/regras/pontos.js'

const props = defineProps({
  nome: { type: String, default: '' },
  email: { type: String, default: '' },
  avatar: { type: String, default: null },
  pontos: { type: Number, default: 0 },
  historicoBloqueado: { type: Boolean, default: false },
  tamanho: { type: Number, default: 42 },
})
const aberto = ref(false)
const raiz = ref(null)
const botao = ref(null)
const lista = ref(null)
const sair = useSair()
const guia = useGuia()
const saindo = ref(false)
const nivel = computed(() => nivelPorPontos(props.pontos))

const itens = () => [...(lista.value?.querySelectorAll('[role="menuitem"]') ?? [])]
function abrir() {
  aberto.value = true
  nextTick(() => itens()[0]?.focus())
}
function fechar(devolverFoco = true) {
  aberto.value = false
  if (devolverFoco) botao.value?.focus()
}
function teclado(evento) {
  const lista = itens()
  const i = lista.indexOf(document.activeElement)
  const ir = (n) => {
    evento.preventDefault()
    lista[(n + lista.length) % lista.length]?.focus()
  }
  if (evento.key === 'ArrowDown') ir(i + 1)
  else if (evento.key === 'ArrowUp') ir(i - 1)
  else if (evento.key === 'Home') ir(0)
  else if (evento.key === 'End') ir(lista.length - 1)
  else if (evento.key === 'Escape') {
    evento.preventDefault()
    fechar()
  }
  else if (evento.key === 'Tab') fechar(false)
}
function cliqueFora(evento) {
  if (aberto.value && !raiz.value?.contains(evento.target)) fechar(false)
}
async function sairDaConta() {
  saindo.value = true
  await sair()
}
function mostrarGuia() {
  fechar(false)
  guia.abrirBalao()
}
onMounted(() => document.addEventListener('pointerdown', cliqueFora))
onBeforeUnmount(() => document.removeEventListener('pointerdown', cliqueFora))
</script>

<template>
  <div ref="raiz" class="relative">
    <button
      ref="botao"
      type="button"
      class="grid cursor-pointer place-items-center rounded-full border-0 bg-transparent p-0 transition-[box-shadow,transform] duration-200 hover:shadow-[0_0_0_3px_var(--folha),0_0_0_5px_var(--acento-anel)] active:scale-95"
      :class="aberto && 'shadow-[0_0_0_3px_var(--folha),0_0_0_5px_var(--acento)]'"
      aria-label="Sua conta"
      aria-haspopup="menu"
      :aria-expanded="aberto"
      data-guia="conta"
      @click="aberto ? fechar() : abrir()"
    >
      <AvatarPerfil :src="avatar" :nome="nome" :tamanho="tamanho" />
    </button>

    <div v-if="aberto" class="menu-acoes w-[280px] p-2" role="presentation" @keydown="teclado">
      <div class="flex items-center gap-3 px-2 pb-3 pt-2">
        <AvatarPerfil :src="avatar" :nome="nome" :tamanho="44" />
        <div class="min-w-0">
          <p class="m-0 truncate text-[15px] font-semibold">{{ nome || 'Sua conta' }}</p>
          <p v-if="email" class="m-0 truncate text-[12.5px] text-texto-3">{{ email }}</p>
          <p class="m-0 mt-1 text-[12.5px] font-semibold text-energia-texto">Nível {{ nivel }}, {{ pontos.toLocaleString('pt-BR') }} pontos</p>
        </div>
      </div>
      <hr class="divisoria mb-1">
      <ul ref="lista" role="menu" aria-label="Sua conta" class="m-0 list-none p-0">
        <li role="none">
          <NuxtLink to="/perfil" role="menuitem" class="item-acao" @click="fechar(false)">
            <UserRound :size="17" :stroke-width="2" aria-hidden="true" />
            <span>Perfil e preferências</span>
          </NuxtLink>
        </li>
        <li role="none">
          <NuxtLink to="/historico" role="menuitem" class="item-acao" @click="fechar(false)">
            <RotateCcwClock :size="17" :stroke-width="2" aria-hidden="true" />
            <span class="flex-1">Histórico</span>
            <template v-if="historicoBloqueado">
              <Lock :size="14" :stroke-width="2.3" class="text-texto-3" aria-hidden="true" />
              <span class="so-leitor">, bloqueado</span>
            </template>
          </NuxtLink>
        </li>
        <li role="none">
          <button type="button" role="menuitem" class="item-acao" @click="mostrarGuia">
            <Sparkles :size="17" :stroke-width="2" aria-hidden="true" />
            <span>Ajuda do guia nesta tela</span>
          </button>
        </li>
        <li role="none">
          <NuxtLink to="/?ver=apresentacao" role="menuitem" class="item-acao" @click="fechar(false)">
            <Presentation :size="17" :stroke-width="2" aria-hidden="true" />
            <span>Apresentação do PGC</span>
          </NuxtLink>
        </li>
        <li role="none" class="mt-1 border-t border-borda pt-1">
          <button type="button" role="menuitem" class="item-acao perigo" :disabled="saindo" @click="sairDaConta">
            <span v-if="saindo" class="rodando" aria-hidden="true" />
            <LogOut v-else :size="17" :stroke-width="2.1" aria-hidden="true" />
            <span>Sair da conta</span>
          </button>
        </li>
      </ul>
    </div>
  </div>
</template>
