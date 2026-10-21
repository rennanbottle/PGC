<script setup>
// Criar senha nova. Só abre com a sessão criada pelo link de recuperação (o middleware confere).
// Depois de trocar, encerra a conta em todos os outros aparelhos.
import { KeyRound, ShieldCheck } from '@lucide/vue'
import { avaliarSenha } from '#shared/regras/senha.js'
import { mensagemDeErro } from '#shared/regras/errosAuth.js'

definePageMeta({ layout: 'entrada', semAbas: true, pageTransition: { name: 'vira', mode: 'out-in' } })
useHead({ title: 'Senha nova | PGC' })

const supabase = useSupabaseClient()

const senha = ref('')
const erroSenha = ref('')
const erroGeral = ref('')
const carregando = ref(false)
const pronto = ref(false)
const tentativa = ref(0)

const descricao = computed(() => ['requisitos-senha-nova', erroSenha.value && 'erro-senha-nova'].filter(Boolean).join(' '))

async function salvar() {
  if (carregando.value) return
  tentativa.value += 1
  erroGeral.value = ''
  const avaliacao = avaliarSenha(senha.value)
  erroSenha.value = avaliacao.valida ? '' : avaliacao.comum ? 'Essa senha é muito comum. Escolha outra.' : 'A senha precisa ter 10 caracteres ou mais, com letras e números.'
  if (erroSenha.value) {
    document.getElementById('senha-nova')?.focus()
    return
  }
  carregando.value = true
  const { error } = await supabase.auth.updateUser({ password: senha.value })
  if (error) {
    carregando.value = false
    if (error.code === 'same_password' || error.code === 'weak_password') {
      erroSenha.value = mensagemDeErro(error)
      document.getElementById('senha-nova')?.focus()
    }
    else {
      erroGeral.value = mensagemDeErro(error)
    }
    return
  }
  // Quem estava logado com a senha antiga em outro aparelho sai.
  await supabase.auth.signOut({ scope: 'others' }).catch(() => {})
  carregando.value = false
  pronto.value = true
}
</script>

<template>
  <div class="flex flex-col">
    <Transition name="vira" mode="out-in">
      <div v-if="pronto" key="pronto" class="flex flex-col items-start gap-4">
        <span class="grid size-[52px] place-items-center rounded-full bg-ok-suave text-ok" aria-hidden="true">
          <ShieldCheck :size="24" :stroke-width="2" />
        </span>
        <TituloPagina>Senha trocada</TituloPagina>
        <p class="m-0 text-[16px] leading-[1.55] text-texto-2">
          A senha nova já vale. Os outros aparelhos onde a conta estava aberta precisam entrar de novo.
        </p>
        <NuxtLink to="/inicio" class="botao w-full no-underline">Ir para o início</NuxtLink>
      </div>

      <form v-else key="form" class="flex flex-col gap-[18px]" novalidate @submit.prevent="salvar">
        <div>
          <TituloPagina>Senha nova</TituloPagina>
          <p class="mt-2.5 text-[15.5px] leading-normal text-texto-2">Escolha a senha que vai usar daqui em diante.</p>
        </div>
        <EntradaCampoSenha
          id="senha-nova"
          v-model="senha"
          rotulo="Senha nova"
          autocomplete="new-password"
          :invalido="!!erroSenha"
          :descricao="descricao"
        >
          <EntradaMedidorSenha id="requisitos-senha-nova" :senha="senha" />
          <EntradaErroCampo id="erro-senha-nova" :mensagem="erroSenha" :vez="tentativa" />
        </EntradaCampoSenha>
        <div class="flex flex-col gap-2.5">
          <EntradaAvisoErro caixa :mensagem="erroGeral" :vez="tentativa" />
          <EntradaBotaoEnviar class="w-full" :carregando="carregando" :icone="KeyRound" texto="Salvar senha" texto-carregando="Salvando" />
        </div>
      </form>
    </Transition>
  </div>
</template>
