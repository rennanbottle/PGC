<script setup>
// Criar conta em 4 passos: dados, ritmo, perfil e guia. Só o primeiro tem campos obrigatórios.
// Tudo vai junto no cadastro (metadados); o banco cria o perfil sozinho (gatilho criar_perfil, migrações 0001 a 0003).
// Os dados ficam guardados na memória do app: trocar de aba da folha ou abrir a política não apaga nada.
// Se o e-mail já tiver conta, a tela age igual a um cadastro novo: ninguém descobre quem usa o PGC.
// O guia escolhido acompanha cada passo e comemora no fim. O guia próprio (criado com uma imagem) espera neste
// navegador até o primeiro acesso, como a foto (utils/guia.js).
import { Camera, ChevronLeft, Gauge, IdCard, MailCheck, Smile, Trash2, UserPlus, UserRound } from '@lucide/vue'
import { GUIAS_PRONTOS, GUIA_PADRAO, nomeParaGuardar } from '#shared/regras/guias.js'
import { avaliarSenha, emailValido, nomeValido } from '#shared/regras/senha.js'
import { APELIDO_MAX, avaliarApelido } from '#shared/regras/perfil.js'
import { contaJaExiste, erroSilencioso, mensagemDeErro } from '#shared/regras/errosAuth.js'

definePageMeta({ layout: 'entrada', pageTransition: { name: 'vira', mode: 'out-in' } })
useHead({ title: 'Criar conta | PGC' })

const supabase = useSupabaseClient()
const lembrarSessao = useLembrarSessao()
const opcoes = useOpcoesPerfil()

const PASSOS = [
  { nome: 'Seus dados', icone: IdCard },
  { nome: 'Seu ritmo', icone: Gauge },
  { nome: 'Seu perfil', icone: UserRound },
  { nome: 'Seu guia', icone: Smile },
]
const FALAS = [
  { humor: 'feliz', texto: 'Oi! Primeiro, os dados para você entrar depois.' },
  { humor: 'pensativo', texto: 'Quantas questões por dia combinam com você? Dá para mudar depois.' },
  { humor: 'feliz', texto: 'Esta parte é opcional: pode pular se quiser.' },
  { humor: 'curioso', texto: 'Por último, quem vai te acompanhar no PGC: um guia pronto ou um seu, criado com uma imagem.' },
]
const FOTO_MAXIMA = 15 * 1024 * 1024

const estadoInicial = () => ({ nome: '', email: '', senha: '', aceite: false, ritmo: 'normal', objetivo: '', areas: [], apelido: '', foto: null, guia: { id: GUIA_PADRAO, imagem: null, nome: '' } })
const form = useState('pgc-cadastro', estadoInicial).value
const passo = useState('pgc-cadastro-passo', () => 1)

const enviado = ref(false)
const emailEnviado = ref('')
const carregando = ref(false)
const erroGeral = ref('')
const erroFoto = ref('')
const tentativa = ref(0)
const regiao = ref(null)
const arquivo = ref(null)
const recorte = ref(null)
const janelaPolitica = ref(null)
const erros = reactive({ nome: '', email: '', senha: '', aceite: '', apelido: '', guia: '' })
// E-mail que já tem conta: o cadastro para no passo 1 e mostra o caminho para entrar ou recuperar a senha.
const emailComConta = ref('')
watch(() => form.email, (e) => {
  if (emailComConta.value && e.trim().toLowerCase() !== emailComConta.value) {
    emailComConta.value = ''
    if (erros.email === 'Este e-mail já tem conta no PGC.') erros.email = ''
  }
})

const rotuloPasso = computed(() => `Passo ${passo.value} de ${PASSOS.length}: ${PASSOS[passo.value - 1].nome}`)
// O guia que aparece na fala: o escolhido agora (antes de existir a conta). Depois do envio, o formulário é limpo
// e a tela "confirme o e-mail" continua com o guia escolhido.
const imagemFinal = ref('')
const imagemGuia = computed(() => (form.guia?.id === 'proprio' ? form.guia.imagem || '' : (GUIAS_PRONTOS.find((g) => g.id === form.guia?.id) ?? GUIAS_PRONTOS[0]).arquivo))
const descricaoSenha = computed(() => ['requisitos-senha', erros.senha && 'erro-senha-criar'].filter(Boolean).join(' '))

// O guia reage: fica confuso por um instante quando falta algo.
const susto = ref(false)
let relogioSusto = null
function assustar() {
  susto.value = true
  clearTimeout(relogioSusto)
  relogioSusto = setTimeout(() => (susto.value = false), 2600)
}
const fala = computed(() => (susto.value ? { humor: 'confuso', texto: 'Opa, faltou alguma coisa. Veja o aviso em vermelho.' } : FALAS[passo.value - 1]))

function focarPrimeiro(lista) {
  const primeiro = lista.find(([campo]) => erros[campo])
  if (primeiro) {
    document.getElementById(primeiro[1])?.focus()
    assustar()
  }
  return !primeiro
}

function validarPasso1() {
  const senha = avaliarSenha(form.senha)
  erros.nome = nomeValido(form.nome) ? '' : 'Informe como quer ser chamado.'
  erros.email = !form.email.trim() ? 'Informe o e-mail.' : emailValido(form.email) ? '' : 'Esse e-mail não parece válido. Confira se tem @ e o domínio.'
  erros.senha = senha.valida ? '' : senha.comum ? 'Essa senha é muito comum. Escolha outra.' : 'A senha precisa ter 10 caracteres ou mais, com letras e números.'
  erros.aceite = form.aceite ? '' : 'Para criar a conta, aceite a política de privacidade.'
  return focarPrimeiro([['nome', 'nome'], ['email', 'email-criar'], ['senha', 'senha-criar'], ['aceite', 'aceite']])
}

function validarPasso3() {
  erros.apelido = avaliarApelido(form.apelido).mensagem
  return focarPrimeiro([['apelido', 'apelido']])
}

function validarPasso4() {
  erros.guia = form.guia.id === 'proprio' && !form.guia.imagem ? 'Envie as duas imagens para criar o seu guia, ou escolha um pronto.' : ''
  if (erros.guia) assustar()
  return !erros.guia
}

// Passo 1: pergunta ao servidor se o e-mail já tem conta. Se não der para saber (internet, limite de perguntas), segue;
// o aviso volta a aparecer no fim, quando o Supabase recusa o cadastro.
const emailConferido = ref('')
async function emailJaTemConta() {
  const email = form.email.trim().toLowerCase()
  if (emailConferido.value === email) return false
  carregando.value = true
  const r = await $fetch('/api/conta/email', { method: 'POST', body: { email } }).catch(() => null)
  carregando.value = false
  if (r?.temConta !== true) {
    if (r?.temConta === false) emailConferido.value = email
    return false
  }
  emailComConta.value = email
  erros.email = 'Este e-mail já tem conta no PGC.'
  document.getElementById('email-criar')?.focus()
  assustar()
  return true
}

async function irParaPasso(n) {
  passo.value = n
  erroGeral.value = ''
  susto.value = false
  await nextTick()
  regiao.value?.focus()
}

async function continuar() {
  if (carregando.value) return
  tentativa.value += 1
  if (passo.value === 1 && !validarPasso1()) return
  if (passo.value === 1 && await emailJaTemConta()) return
  if (passo.value === 3 && !validarPasso3()) return
  if (passo.value === 4 && !validarPasso4()) return
  if (passo.value < PASSOS.length) return irParaPasso(passo.value + 1)
  await criarConta()
}

// Política de privacidade numa janela: a pessoa lê e volta ao ponto exato, sem perder o que digitou.
function abrirPolitica() {
  janelaPolitica.value?.abrir()
}

// Foto: a pessoa ajusta o recorte antes de usar. Entra na conta quando o e-mail for confirmado.
function abrirSeletorDeFoto() {
  arquivo.value?.click()
}
async function escolherFoto(evento) {
  const escolhido = evento.target.files?.[0]
  evento.target.value = ''
  if (!escolhido) return
  erroFoto.value = ''
  if (escolhido.size > FOTO_MAXIMA) {
    erroFoto.value = 'Essa imagem é grande demais (até 15 MB). Escolha outra.'
    return
  }
  const abriu = await recorte.value?.abrir(escolhido)
  if (abriu === false) erroFoto.value = recorte.value?.erro || 'Escolha uma imagem JPG, PNG ou WebP.'
}
function fotoPronta({ dataUrl }) {
  form.foto = dataUrl
}

function limparFormulario() {
  Object.assign(form, estadoInicial())
  Object.assign(erros, { nome: '', email: '', senha: '', aceite: '', apelido: '', guia: '' })
  passo.value = 1
}

async function criarConta() {
  erroGeral.value = ''
  carregando.value = true
  const email = form.email.trim()
  const { data, error } = await supabase.auth.signUp({
    email,
    password: form.senha,
    options: {
      emailRedirectTo: `${window.location.origin}/auth/retorno`,
      data: {
        nome_exibicao: form.nome.trim(),
        ritmo: form.ritmo,
        objetivo: form.objetivo || null,
        areas_interesse: form.areas,
        apelido: form.apelido.trim() || null,
        guia: form.guia.id,
        guia_nome: nomeParaGuardar(form.guia.id, form.guia.nome),
        privacidade_aceita: 'true',
      },
    },
  })

  // E-mail que já tem conta: nada é criado nem enviado. Volta ao passo 1 com o aviso e o caminho de entrar.
  if (contaJaExiste({ data, error })) {
    carregando.value = false
    await irParaPasso(1)
    emailComConta.value = email.toLowerCase()
    erros.email = 'Este e-mail já tem conta no PGC.'
    document.getElementById('email-criar')?.focus()
    assustar()
    return
  }

  if (error && !erroSilencioso(error)) {
    carregando.value = false
    if (error.code === 'weak_password' || error.code === 'email_address_invalid') {
      await irParaPasso(1)
      const campo = error.code === 'weak_password' ? 'senha' : 'email'
      erros[campo] = mensagemDeErro(error)
      document.getElementById(campo === 'senha' ? 'senha-criar' : 'email-criar')?.focus()
      assustar()
      return
    }
    erroGeral.value = mensagemDeErro(error)
    assustar()
    return
  }

  // Sem confirmação de e-mail (banco local, por exemplo), a conta já volta com sessão: entra direto no início.
  if (data?.session) {
    if (form.foto && data.user?.id) {
      try {
        await enviarAvatar(supabase, data.user.id, dataUrlParaBlob(form.foto))
      }
      catch {
        // A foto entra depois, pelo perfil.
      }
    }
    if (data.user?.id) {
      try {
        if (form.guia.id === 'proprio' && form.guia.imagem) await enviarGuia(supabase, data.user.id, dataUrlParaBlob(form.guia.imagem), { nome: nomeParaGuardar('proprio', form.guia.nome) })
        else await supabase.from('perfis').update({ guia: form.guia.id, guia_nome: nomeParaGuardar(form.guia.id, form.guia.nome) }).eq('id', data.user.id)
      }
      catch {
        // O guia entra depois, pelo perfil.
      }
    }
    lembrarSessao.definir(true)
    limparFormulario()
    carregando.value = false
    return navigateTo('/inicio?bem_vindo=1', { replace: true })
  }

  carregando.value = false
  if (form.foto) guardarAvatarPendente(email, form.foto)
  if (form.guia.id === 'proprio' && form.guia.imagem) guardarGuiaPendente(email, form.guia.imagem, nomeParaGuardar('proprio', form.guia.nome))
  imagemFinal.value = imagemGuia.value
  emailEnviado.value = email
  limparFormulario()
  enviado.value = true
  iniciarContagem()
}

// Reenvio do link de confirmação, liberado a cada 60 segundos.
const reenviarEm = ref(0)
const statusReenvio = ref('')
let relogio = null
function iniciarContagem() {
  reenviarEm.value = 60
  clearInterval(relogio)
  relogio = setInterval(() => {
    reenviarEm.value -= 1
    if (reenviarEm.value <= 0) clearInterval(relogio)
  }, 1000)
}
onBeforeUnmount(() => {
  clearInterval(relogio)
  clearTimeout(relogioSusto)
})
const textoContagem = computed(() => `${Math.floor(reenviarEm.value / 60)}:${String(reenviarEm.value % 60).padStart(2, '0')}`)

async function reenviar() {
  statusReenvio.value = 'Enviando...'
  const { error } = await supabase.auth.resend({
    type: 'signup',
    email: emailEnviado.value,
    options: { emailRedirectTo: `${window.location.origin}/auth/retorno` },
  })
  statusReenvio.value = error ? mensagemDeErro(error) : 'Enviamos outro link.'
  if (!error) iniciarContagem()
}
</script>

<template>
  <div class="flex flex-1 flex-col">
    <Transition name="vira" mode="out-in">
      <!-- Depois do cadastro: o guia comemora e explica o último passo (confirmar o e-mail). -->
      <div v-if="enviado" key="enviado" class="flex flex-col items-start gap-4">
        <GuiaPersonagem humor="comemorativo" :tamanho="96" :imagem="imagemFinal || imagemGuia" class="-ml-1" />
        <TituloPagina>Confira seu e-mail</TituloPagina>
        <div class="flex flex-col gap-1.5 text-[16px] leading-[1.55] text-texto-2">
          <p class="m-0">A conta está quase pronta. Mandamos um link para</p>
          <p class="m-0 font-semibold text-tinta [overflow-wrap:anywhere]">{{ emailEnviado }}</p>
          <p class="m-0">Abra o link para ativar a conta e entrar. Se não chegar em alguns minutos, olhe a pasta de spam.</p>
        </div>
        <div class="flex w-full flex-col gap-1.5 rounded-[14px] border border-borda bg-folha-2 px-4 py-3">
          <p class="m-0 flex items-center gap-2 text-[14.5px] font-semibold">
            <MailCheck :size="18" :stroke-width="2" class="text-texto-2" aria-hidden="true" />
            <span>Não chegou?</span>
          </p>
          <p v-if="reenviarEm > 0" class="m-0 text-[14px] text-texto-2">
            Dá para pedir outro em <strong class="font-semibold tabular-nums text-tinta">{{ textoContagem }}</strong>.
          </p>
          <button v-else type="button" class="link self-start text-[14.5px]" @click="reenviar">Enviar o link de novo</button>
          <p v-if="statusReenvio" class="m-0 text-[14px] text-texto-2" role="status">{{ statusReenvio }}</p>
        </div>
        <NuxtLink to="/entrar" class="volta pl-0 no-underline">
          <ChevronLeft :size="17" :stroke-width="1.9" aria-hidden="true" />
          <span>Voltar para entrar</span>
        </NuxtLink>
      </div>

      <!-- Os 3 passos -->
      <form v-else key="passos" class="flex flex-1 flex-col gap-5" novalidate @submit.prevent="continuar">
        <TituloPagina>Criar conta</TituloPagina>
        <EntradaFalaGuia :humor="fala.humor" :texto="fala.texto" :imagem="imagemGuia" class="-mt-1" />
        <EntradaPassos :passos="PASSOS" :atual="passo" rotulo="Etapas do cadastro" @ir="irParaPasso" />

        <div :key="passo" ref="regiao" role="group" :aria-label="rotuloPasso" tabindex="-1" class="sobe flex flex-col gap-5 outline-none">
          <!-- Passo 1: dados -->
          <template v-if="passo === 1">
            <div>
              <label class="rotulo" for="nome">Nome de exibição</label>
              <input
                id="nome"
                v-model="form.nome"
                class="campo"
                type="text"
                autocomplete="nickname"
                maxlength="60"
                :aria-invalid="!!erros.nome"
                :aria-describedby="erros.nome ? 'ajuda-nome erro-nome' : 'ajuda-nome'"
              >
              <p id="ajuda-nome" class="ajuda">Aparece no seu painel. Não precisa ser o nome completo.</p>
              <EntradaErroCampo id="erro-nome" :mensagem="erros.nome" :vez="tentativa" />
            </div>
            <div>
              <label class="rotulo" for="email-criar">E-mail</label>
              <input
                id="email-criar"
                v-model="form.email"
                class="campo"
                type="email"
                inputmode="email"
                autocomplete="email"
                spellcheck="false"
                autocapitalize="off"
                :aria-invalid="!!erros.email"
                :aria-describedby="erros.email ? 'erro-email-criar' : undefined"
              >
              <EntradaErroCampo id="erro-email-criar" :mensagem="erros.email" :vez="tentativa" />
              <p v-if="emailComConta" class="m-0 mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[14px]">
                <NuxtLink to="/entrar" class="link">Entrar com este e-mail</NuxtLink>
                <NuxtLink to="/recuperar-senha" class="link">Esqueci a senha</NuxtLink>
              </p>
            </div>
            <EntradaCampoSenha
              id="senha-criar"
              v-model="form.senha"
              autocomplete="new-password"
              :invalido="!!erros.senha"
              :descricao="descricaoSenha"
            >
              <EntradaMedidorSenha id="requisitos-senha" :senha="form.senha" />
              <EntradaErroCampo id="erro-senha-criar" :mensagem="erros.senha" :vez="tentativa" />
            </EntradaCampoSenha>
            <div>
              <label class="flex cursor-pointer items-start gap-2.5 text-[14.5px] leading-[1.45]">
                <input
                  id="aceite"
                  v-model="form.aceite"
                  type="checkbox"
                  class="marcar mt-px"
                  :aria-invalid="!!erros.aceite"
                  :aria-describedby="erros.aceite ? 'erro-aceite' : undefined"
                >
                <span>
                  Li e aceito a
                  <button type="button" class="link" aria-haspopup="dialog" @click="abrirPolitica">política de privacidade</button>.
                </span>
              </label>
              <EntradaErroCampo id="erro-aceite" :mensagem="erros.aceite" :vez="tentativa" />
            </div>
          </template>

          <!-- Passo 2: ritmo e objetivo -->
          <template v-else-if="passo === 2">
            <fieldset class="m-0 min-w-0 border-0 p-0">
              <legend class="rotulo">Ritmo de estudo</legend>
              <div class="flex flex-col gap-0.5 rounded-[16px] border border-borda p-1">
                <label v-for="r in opcoes.ritmos" :key="r.valor" class="linha-opcao items-center">
                  <input v-model="form.ritmo" type="radio" name="ritmo" :value="r.valor" class="escolher">
                  <span class="min-w-0 flex-1">
                    <span class="block text-[15px] font-semibold leading-tight">{{ r.texto }}</span>
                    <span class="mt-0.5 block text-[13.5px] leading-[1.35] text-texto-2">{{ r.resumo }}</span>
                  </span>
                  <span class="shrink-0 text-right">
                    <span class="block font-titulo text-[20px] font-bold leading-none tabular-nums">{{ r.meta }}</span>
                    <span class="mt-1 block text-[12px] leading-none text-texto-3">por dia</span>
                  </span>
                </label>
              </div>
              <p class="ajuda">Questões por dia. Dá para trocar no perfil, uma vez a cada 7 dias.</p>
            </fieldset>
            <div class="max-w-[340px]">
              <label class="rotulo" for="objetivo">Objetivo principal</label>
              <Selecao id="objetivo" v-model="form.objetivo" :opcoes="opcoes.objetivos" descrito="ajuda-objetivo" />
              <p id="ajuda-objetivo" class="ajuda">Opcional. Ajuda a escolher o estilo das questões.</p>
            </div>
          </template>

          <!-- Passo 3: perfil -->
          <template v-else-if="passo === 3">
            <div>
              <p class="rotulo">Foto</p>
              <div class="flex items-center gap-4">
                <AvatarPerfil :src="form.foto" :nome="form.nome" :tamanho="72" />
                <div class="flex min-w-0 flex-col items-start gap-1.5">
                  <div class="flex flex-wrap items-center gap-2">
                    <button type="button" class="botao-secundario botao-p" aria-describedby="ajuda-foto" @click="abrirSeletorDeFoto">
                      <Camera :size="16" :stroke-width="2" aria-hidden="true" />
                      <span>{{ form.foto ? 'Trocar foto' : 'Escolher foto' }}</span>
                    </button>
                    <button v-if="form.foto" type="button" class="botao-fantasma botao-p" @click="form.foto = null">
                      <Trash2 :size="16" :stroke-width="2" aria-hidden="true" />
                      <span>Remover</span>
                    </button>
                  </div>
                  <p id="ajuda-foto" class="ajuda m-0">JPG, PNG ou WebP. Você ajusta o recorte antes de usar.</p>
                </div>
                <input ref="arquivo" type="file" accept="image/jpeg,image/png,image/webp" class="hidden" @change="escolherFoto">
              </div>
              <EntradaErroCampo :mensagem="erroFoto" />
            </div>

            <div class="max-w-[320px]">
              <label class="rotulo" for="apelido">Apelido para o ranking</label>
              <input
                id="apelido"
                v-model="form.apelido"
                class="campo"
                type="text"
                autocomplete="off"
                autocapitalize="off"
                spellcheck="false"
                :maxlength="APELIDO_MAX"
                :aria-invalid="!!erros.apelido"
                :aria-describedby="erros.apelido ? 'ajuda-apelido erro-apelido' : 'ajuda-apelido'"
              >
              <p id="ajuda-apelido" class="ajuda">Só aparece se você entrar no ranking.</p>
              <EntradaErroCampo id="erro-apelido" :mensagem="erros.apelido" :vez="tentativa" />
            </div>

            <div class="max-w-[380px]">
              <label class="rotulo" for="areas">Áreas que você estuda</label>
              <Selecao id="areas" v-model="form.areas" multiplo :opcoes="opcoes.areas" texto-vazio="Escolher áreas" descrito="ajuda-areas" />
              <p id="ajuda-areas" class="ajuda">Escolha uma ou mais. Ajuda a sugerir matérias.</p>
            </div>
          </template>

          <!-- Passo 4: guia -->
          <template v-else>
            <div>
              <p class="rotulo">Seu guia</p>
              <p class="ajuda -mt-1 mb-3">Ele aparece nas telas, explica cada parte do PGC e reage ao que você faz. Dá para trocar depois, no perfil.</p>
              <GuiaEscolherGuia v-model="form.guia" />
              <EntradaErroCampo :mensagem="erros.guia" :vez="tentativa" />
            </div>
          </template>
        </div>

        <EntradaAvisoErro caixa :mensagem="erroGeral" :vez="tentativa" />

        <p v-if="passo === 1" class="m-0 text-[14.5px] text-texto-2 sm:hidden">
          Já tem conta? <NuxtLink to="/entrar" class="link">Entrar</NuxtLink>
        </p>

        <!-- Celular: barra presa no rodapé. Computador: linha comum ao fim da folha. -->
        <div class="barra-acoes -mx-5 -mb-6 mt-auto px-5 sm:static sm:m-0 sm:mt-1 sm:justify-between sm:border-0 sm:bg-transparent sm:p-0 sm:backdrop-blur-none">
          <button v-if="passo > 1" type="button" class="volta h-11 pl-1 pr-3" @click="irParaPasso(passo - 1)">
            <ChevronLeft :size="18" :stroke-width="1.9" aria-hidden="true" />
            <span>Voltar</span>
          </button>
          <p v-else class="m-0 hidden text-[14.5px] text-texto-2 sm:block">
            Já tem conta? <NuxtLink to="/entrar" class="link">Entrar</NuxtLink>
          </p>
          <EntradaBotaoEnviar
            class="flex-1 sm:flex-none"
            :carregando="carregando"
            :texto="passo === PASSOS.length ? 'Criar conta' : 'Continuar'"
            :icone="passo === PASSOS.length ? UserPlus : null"
            texto-carregando="Criando conta"
          />
        </div>
      </form>
    </Transition>

    <RecortarFoto ref="recorte" @pronto="fotoPronta" />

    <JanelaBase ref="janelaPolitica" titulo="Política de privacidade" larga>
      <PoliticaPrivacidade :nivel-titulo="3" />
      <template #rodape>
        <button type="button" class="botao" @click="janelaPolitica.fechar()">Fechar</button>
      </template>
    </JanelaBase>
  </div>
</template>
