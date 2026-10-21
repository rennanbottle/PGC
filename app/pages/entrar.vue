<script setup>
// Tela Entrar: e-mail e senha. Cada erro fica perto do que ele fala (embaixo do campo; a falha ao entrar fica logo
// acima do botão), com ícone e um tremor curto. Pausa na tela depois de muitas tentativas erradas e opção de
// reenviar a confirmação. Avisos calmos no topo: link vencido, e-mail confirmado.
import { LogIn, MailCheck, Unlink } from '@lucide/vue'
import { emailValido } from '#shared/regras/senha.js'
import { mensagemDeErro, esperaAposFalhas } from '#shared/regras/errosAuth.js'
import { destinoSeguro } from '#shared/regras/redirecionamento.js'

definePageMeta({ layout: 'entrada', pageTransition: { name: 'vira', mode: 'out-in' } })
useHead({ title: 'Entrar | PGC' })

const supabase = useSupabaseClient()
const route = useRoute()
const lembrarSessao = useLembrarSessao()

const email = ref('')
const senha = ref('')
const erros = reactive({ email: '', senha: '' })
const erroGeral = ref('')
const tentativa = ref(0)
const carregando = ref(false)
const faltaConfirmar = ref(false)
const reenvio = ref('')
const campoEmail = ref(null)

const AVISOS_LINK = {
  expirado: 'O link expirou ou já foi usado. Entre com e-mail e senha ou peça outro.',
  invalido: 'Esse link não funcionou. Entre com e-mail e senha ou peça outro.',
}
const avisoLink = computed(() => (erroGeral.value ? '' : (AVISOS_LINK[route.query.link] ?? '')))
// Vem do link do e-mail: o Supabase já confirmou o cadastro, falta só entrar.
const avisoConfirmado = computed(() => (route.query.link === 'confirmado' ? 'Cadastro completo. Seu e-mail foi confirmado: agora é só entrar com o e-mail e a senha.' : ''))

// Pausa depois de 5 erros seguidos. Conta regressiva no botão.
const falhas = ref(0)
const espera = ref(0)
let relogio = null
function iniciarEspera(segundos) {
  espera.value = segundos
  clearInterval(relogio)
  relogio = setInterval(() => {
    espera.value -= 1
    if (espera.value <= 0) clearInterval(relogio)
  }, 1000)
}
onBeforeUnmount(() => clearInterval(relogio))
const textoEspera = computed(() => {
  const m = Math.floor(espera.value / 60)
  const s = String(espera.value % 60).padStart(2, '0')
  return `${m}:${s}`
})

function validar() {
  erros.email = !email.value.trim() ? 'Informe o e-mail.' : !emailValido(email.value) ? 'Esse e-mail não parece válido. Confira se tem @ e o domínio.' : ''
  erros.senha = senha.value ? '' : 'Informe a senha.'
  if (erros.email) campoEmail.value?.focus()
  else if (erros.senha) document.getElementById('senha-entrar')?.focus()
  return !erros.email && !erros.senha
}

async function entrar() {
  if (carregando.value || espera.value > 0) return
  tentativa.value += 1
  erroGeral.value = ''
  faltaConfirmar.value = false
  reenvio.value = ''
  if (!validar()) return

  carregando.value = true
  const { error } = await supabase.auth.signInWithPassword({ email: email.value.trim(), password: senha.value })
  carregando.value = false

  if (error) {
    erroGeral.value = mensagemDeErro(error)
    if (error.code === 'email_not_confirmed') {
      faltaConfirmar.value = true
      return
    }
    if (error.code === 'invalid_credentials') {
      falhas.value += 1
      const segundos = esperaAposFalhas(falhas.value)
      if (segundos > 0) iniciarEspera(segundos)
      senha.value = ''
      nextTick(() => document.getElementById('senha-entrar')?.focus())
    }
    return
  }

  // Sem a chave "Continuar conectado" (pedido do R, 12/10): a sessão fica, e quem protege o computador da escola
  // é a saída por inatividade do perfil (30 minutos por padrão).
  lembrarSessao.definir(true)
  await navigateTo(destinoSeguro(route.query.volta), { replace: true })
}

async function reenviarConfirmacao() {
  reenvio.value = 'Enviando...'
  const { error } = await supabase.auth.resend({
    type: 'signup',
    email: email.value.trim(),
    options: { emailRedirectTo: `${window.location.origin}/auth/retorno` },
  })
  reenvio.value = error ? mensagemDeErro(error) : 'Pronto. Confira a caixa de entrada e a pasta de spam.'
}
</script>

<template>
  <div class="flex flex-col gap-5">
    <div>
      <TituloPagina>Entrar</TituloPagina>
      <p class="mt-2.5 text-[15.5px] text-texto-2">Use o e-mail e a senha da sua conta.</p>
    </div>

    <EntradaAviso tipo="ok" :icone="MailCheck" :mensagem="avisoConfirmado" />
    <EntradaAviso :icone="Unlink" :mensagem="avisoLink" />

    <form class="flex flex-col gap-5" novalidate @submit.prevent="entrar">
      <div>
        <label class="rotulo" for="email-entrar">E-mail</label>
        <input
          id="email-entrar"
          ref="campoEmail"
          v-model="email"
          class="campo"
          type="email"
          inputmode="email"
          autocomplete="email"
          spellcheck="false"
          autocapitalize="off"
          :aria-invalid="!!erros.email || !!erroGeral"
          :aria-describedby="erros.email ? 'erro-email-entrar' : erroGeral ? 'erro-entrar' : undefined"
        >
        <EntradaErroCampo id="erro-email-entrar" :mensagem="erros.email" :vez="tentativa" />
      </div>

      <EntradaCampoSenha
        id="senha-entrar"
        v-model="senha"
        autocomplete="current-password"
        :invalido="!!erros.senha || !!erroGeral"
        :descricao="erros.senha ? 'erro-senha-entrar' : erroGeral ? 'erro-entrar' : undefined"
      >
        <template #acao>
          <NuxtLink to="/recuperar-senha" class="link text-[13.5px]">Esqueci a senha</NuxtLink>
        </template>
        <EntradaErroCampo id="erro-senha-entrar" :mensagem="erros.senha" :vez="tentativa" />
      </EntradaCampoSenha>


      <div class="flex flex-col gap-2.5">
        <div id="erro-entrar">
          <EntradaAvisoErro caixa :mensagem="erroGeral" :vez="tentativa">
            <span v-if="faltaConfirmar" class="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 font-normal text-tinta">
              <button type="button" class="link" @click="reenviarConfirmacao">Enviar o link de novo</button>
              <span v-if="reenvio" class="text-texto-2" role="status">{{ reenvio }}</span>
            </span>
          </EntradaAvisoErro>
        </div>
        <EntradaBotaoEnviar
          class="w-full"
          :carregando="carregando"
          :bloqueado="espera > 0"
          :icone="espera > 0 ? null : LogIn"
          :texto="espera > 0 ? `Tente de novo em ${textoEspera}` : 'Entrar'"
          texto-carregando="Entrando"
        />
      </div>
      <p v-if="espera > 0" class="so-leitor" role="status">Muitas tentativas erradas. Aguarde a contagem terminar para tentar de novo.</p>
    </form>

    <p class="m-0 text-center text-[14.5px] text-texto-2">
      Ainda não tem conta? <NuxtLink to="/criar-conta" class="link">Criar conta</NuxtLink>
    </p>
  </div>
</template>
