<script setup>
// Recuperar senha: pede o e-mail e sempre responde "Pedido recebido", tenha conta ou não.
// O link do e-mail passa por /auth/confirmar e termina em /redefinir-senha.
import { ChevronLeft, MailCheck, Send, Unlink } from '@lucide/vue'
import { emailValido } from '#shared/regras/senha.js'
import { mensagemDeErro } from '#shared/regras/errosAuth.js'

definePageMeta({ layout: 'entrada', pageTransition: { name: 'vira', mode: 'out-in' } })
useHead({ title: 'Recuperar senha | PGC' })

const supabase = useSupabaseClient()
const route = useRoute()

const email = ref('')
const erroEmail = ref('')
const erroGeral = ref('')
const carregando = ref(false)
const recebido = ref(false)
const campoEmail = ref(null)
const tentativa = ref(0)

const AVISOS_LINK = {
  expirado: 'O link de recuperação expirou ou já foi usado. Peça outro abaixo.',
  invalido: 'Esse link de recuperação não funcionou. Peça outro abaixo.',
}
const avisoLink = computed(() => AVISOS_LINK[route.query.link] ?? '')

async function enviar() {
  if (carregando.value) return
  tentativa.value += 1
  erroGeral.value = ''
  erroEmail.value = !email.value.trim() ? 'Informe o e-mail.' : emailValido(email.value) ? '' : 'Esse e-mail não parece válido. Confira se tem @ e o domínio.'
  if (erroEmail.value) {
    campoEmail.value?.focus()
    return
  }
  carregando.value = true
  const { error } = await supabase.auth.resetPasswordForEmail(email.value.trim(), {
    redirectTo: `${window.location.origin}/auth/retorno?next=/redefinir-senha`,
  })
  carregando.value = false
  // Só erros de limite ou de conexão aparecem. "E-mail sem conta" nunca é revelado.
  if (error && (error.status === 429 || error.name === 'AuthRetryableFetchError')) {
    erroGeral.value = mensagemDeErro(error)
    return
  }
  recebido.value = true
}
</script>

<template>
  <div class="flex flex-col">
    <Transition name="vira" mode="out-in">
      <div v-if="recebido" key="recebido" class="flex flex-col items-start gap-4">
        <span class="grid size-[52px] place-items-center rounded-full bg-ok-suave text-ok" aria-hidden="true">
          <MailCheck :size="24" :stroke-width="2" />
        </span>
        <TituloPagina>Pedido recebido</TituloPagina>
        <p class="m-0 text-[16px] leading-[1.55] text-texto-2">
          Se existir uma conta com esse e-mail, o link chega em alguns minutos. Confira também a pasta de spam.
        </p>
        <NuxtLink to="/entrar" class="botao w-full no-underline">Voltar para entrar</NuxtLink>
      </div>

      <form v-else key="pedido" class="flex flex-col gap-[18px]" novalidate @submit.prevent="enviar">
        <div>
          <TituloPagina>Recuperar senha</TituloPagina>
          <p class="mt-2.5 text-[15.5px] leading-normal text-texto-2">
            Informe o e-mail da conta. Se ele estiver cadastrado, chega um link para criar uma senha nova.
          </p>
        </div>
        <EntradaAviso :icone="Unlink" :mensagem="avisoLink" />
        <div>
          <label class="rotulo" for="email-recuperar">E-mail</label>
          <input
            id="email-recuperar"
            ref="campoEmail"
            v-model="email"
            class="campo"
            type="email"
            inputmode="email"
            autocomplete="email"
            spellcheck="false"
            autocapitalize="off"
            :aria-invalid="!!erroEmail"
            :aria-describedby="erroEmail ? 'erro-email-recuperar' : undefined"
          >
          <EntradaErroCampo id="erro-email-recuperar" :mensagem="erroEmail" :vez="tentativa" />
        </div>
        <div class="flex flex-col gap-2.5">
          <EntradaAvisoErro caixa :mensagem="erroGeral" :vez="tentativa" />
          <EntradaBotaoEnviar class="w-full" :carregando="carregando" :icone="Send" texto="Enviar link" texto-carregando="Enviando" />
        </div>
        <NuxtLink to="/entrar" class="volta self-start pl-0 no-underline">
          <ChevronLeft :size="17" :stroke-width="1.9" aria-hidden="true" />
          <span>Voltar para entrar</span>
        </NuxtLink>
      </form>
    </Transition>
  </div>
</template>
