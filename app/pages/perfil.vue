<script setup>
// Perfil em cinco partes: Conta, Estudo, Aparência, Privacidade e Sessão (âncoras /perfil#conta ... #sessao).
// No computador, um índice preso à esquerda acompanha a rolagem; no celular, atalhos em fichas no topo.
// Escolhas (listas e chaves) gravam na hora: visto verde na linha, aviso "Salvo." e, se falhar, volta ao que era.
// Campos de texto gravam com o botão "Salvar" (aparece quando algo mudou) ou com Enter.
// O ritmo pede confirmação: depois de trocar, fica 7 dias sem poder mudar (o banco confere).
import {
  Activity, Camera, Check, Eye, EyeOff, FileText, Gauge, KeyRound, Lock, MonitorSmartphone, Palette, RotateCcw, ShieldCheck,
  Trash2, Trophy, UserRound, VenetianMask,
} from '@lucide/vue'
import { nomeValido } from '#shared/regras/senha.js'
import { APELIDO_MAX, IA_PERMITIDA, PALETAS, SAIDA_INATIVO, avaliarApelido, paletaDoPerfil } from '#shared/regras/perfil.js'
import { nomeParaGuardar, nomePadraoDoGuia } from '#shared/regras/guias.js'
import { DIAS_ENTRE_TROCAS_DE_RITMO, podeTrocarRitmo } from '#shared/regras/ritmo.js'
import { nivelPorPontos } from '#shared/regras/pontos.js'
import { DESBLOQUEIOS } from '#shared/regras/desbloqueios.js'

useHead({ title: 'Perfil | PGC' })

const supabase = useSupabaseClient()
const usuario = useSupabaseUser()
const route = useRoute()
const { data: perfil } = usePerfil()
const { data: estudo } = useResumoEstudo()
const { avatar } = useAvatarDoPerfil()
const { data: souDono } = useSouDono()
const { avisar } = useAvisos()
const guia = useGuia()
const sair = useSair()
const opcoes = useOpcoesPerfil()

// "Nível na questão" não vem no perfil compartilhado: busca só essa coluna.
const { data: extra } = useAsyncData('perfil-nivel-questao', async () => {
  const { data } = await supabase.from('perfis').select('nivel_na_questao').maybeSingle()
  return data ?? { nivel_na_questao: 'mostrar' }
}, { default: () => ({ nivel_na_questao: 'mostrar' }) })

const SECOES = [
  { id: 'conta', nome: 'Conta', icone: UserRound },
  { id: 'estudo', nome: 'Estudo', icone: Gauge },
  { id: 'aparencia', nome: 'Aparência', icone: Palette },
  { id: 'privacidade', nome: 'Privacidade', icone: ShieldCheck },
  { id: 'sessao', nome: 'Sessão', icone: MonitorSmartphone },
]

// Índice que acompanha a rolagem.
const secaoVisivel = ref('conta')
let observador = null
function observar() {
  observador?.disconnect()
  observador = new IntersectionObserver(
    (entradas) => {
      const visivel = entradas.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0]
      if (visivel) secaoVisivel.value = visivel.target.id
    },
    { rootMargin: '-12% 0px -60% 0px' },
  )
  for (const s of SECOES) {
    const el = document.getElementById(s.id)
    if (el) observador.observe(el)
  }
}
// No fim da página a última parte (Sessão) nunca chega no alto da tela: aí ela fica marcada.
function noFim() {
  if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4) secaoVisivel.value = SECOES.at(-1).id
}
onMounted(() => window.addEventListener('scroll', noFim, { passive: true }))
onBeforeUnmount(() => window.removeEventListener('scroll', noFim))
onMounted(() => {
  guia.carregar()
  // Chegou por um link com âncora (ex.: /perfil#conta, vindo do Ranking): rola até a parte depois que ela aparece.
  const irParaAncora = () => nextTick(() => {
    observar()
    const alvo = route.hash && document.getElementById(route.hash.slice(1))
    if (alvo) {
      alvo.scrollIntoView({ block: 'start' })
      secaoVisivel.value = alvo.id
    }
  })
  if (perfil.value) irParaAncora()
  else {
    const parar = watch(perfil, (p) => {
      if (!p) return
      parar()
      irParaAncora()
    })
  }
})
onBeforeUnmount(() => observador?.disconnect())

// ---------- Gravar ----------
const salvo = reactive({})
const relogiosSalvo = {}
function marcarSalvo(chave) {
  salvo[chave] = true
  clearTimeout(relogiosSalvo[chave])
  relogiosSalvo[chave] = setTimeout(() => (salvo[chave] = false), 2400)
}
const ERRO_SALVAR = 'Não deu para salvar agora. Confira a internet e tente de novo.'

async function gravar(mudancas) {
  if (!perfil.value) return { error: { message: 'sem perfil' } }
  const { error } = await supabase.from('perfis').update(mudancas).eq('id', perfil.value.id)
  if (!error) perfil.value = { ...perfil.value, ...mudancas }
  return { error }
}

// Escolha que grava na hora. Se falhar, "desfazer" põe o valor antigo de volta.
async function salvarEscolha(chave, mudancas, desfazer, texto = 'Salvo.') {
  const { error } = await gravar(mudancas)
  if (error) {
    desfazer()
    avisar({ texto: error.code === 'P0001' ? error.message : ERRO_SALVAR, tipo: 'erro' })
    return false
  }
  marcarSalvo(chave)
  avisar({ texto, tipo: 'ok' })
  return true
}

// ---------- Conta ----------
const conta = reactive({ nome: '', apelido: '' })
const errosConta = reactive({ nome: '', apelido: '' })
const salvando = reactive({ nome: false, apelido: false })
const tentativa = ref(0)
watch(() => perfil.value?.nome_exibicao, (v) => (conta.nome = v ?? ''), { immediate: true })
watch(() => perfil.value?.apelido, (v) => (conta.apelido = v ?? ''), { immediate: true })
const nomeMudou = computed(() => !!perfil.value && conta.nome.trim() !== (perfil.value.nome_exibicao ?? ''))
const apelidoMudou = computed(() => !!perfil.value && conta.apelido.trim() !== (perfil.value.apelido ?? ''))
const focar = (id) => {
  const el = document.getElementById(id)
  el?.scrollIntoView({ block: 'center' })
  el?.focus({ preventScroll: true })
}

async function salvarNome() {
  tentativa.value += 1
  errosConta.nome = nomeValido(conta.nome) ? '' : 'Informe como quer ser chamado.'
  if (errosConta.nome) return focar('nome-perfil')
  if (!nomeMudou.value || salvando.nome) return
  salvando.nome = true
  const { error } = await gravar({ nome_exibicao: conta.nome.trim() })
  salvando.nome = false
  if (error) return avisar({ texto: ERRO_SALVAR, tipo: 'erro' })
  marcarSalvo('nome')
  avisar({ texto: 'Salvo.', tipo: 'ok' })
}

async function salvarApelido() {
  tentativa.value += 1
  const avaliacao = avaliarApelido(conta.apelido)
  errosConta.apelido = avaliacao.mensagem
  if (!avaliacao.valido) return focar('apelido-perfil')
  if (!apelidoMudou.value || salvando.apelido) return
  salvando.apelido = true
  const novo = conta.apelido.trim() || null
  const estavaNoRanking = !!perfil.value?.ranking_participa
  const { error } = await gravar({ apelido: novo })
  salvando.apelido = false
  if (error) {
    if (error.code === '23505') {
      errosConta.apelido = 'Esse apelido já é de outra pessoa. Escolha outro.'
      return focar('apelido-perfil')
    }
    return avisar({ texto: ERRO_SALVAR, tipo: 'erro' })
  }
  marcarSalvo('apelido')
  // Veio do botão "Participar do ranking": com o apelido salvo, completa o pedido.
  if (novo && precisaApelido.value) {
    precisaApelido.value = false
    await salvarEscolha('ranking', { ranking_participa: true }, () => {}, 'Apelido salvo. Você entrou no ranking.')
    return
  }
  precisaApelido.value = false
  // Sem apelido não há o que mostrar no ranking: o banco tira a pessoa de lá.
  if (!novo && estavaNoRanking) {
    perfil.value = { ...perfil.value, ranking_participa: false }
    avisar({ texto: 'Apelido apagado. Sem apelido, você saiu do ranking.', tipo: 'info' })
  }
  else avisar({ texto: 'Salvo.', tipo: 'ok' })
}

// Foto: escolher, ajustar o recorte e enviar (bucket avatares, pasta com o id da pessoa).
const arquivo = ref(null)
const recorte = ref(null)
const enviandoFoto = ref(false)
const erroFoto = ref('')
async function escolherFoto(evento) {
  const escolhido = evento.target.files?.[0]
  evento.target.value = ''
  if (!escolhido) return
  erroFoto.value = ''
  if (escolhido.size > 15 * 1024 * 1024) {
    erroFoto.value = 'Essa imagem é grande demais (até 15 MB). Escolha outra.'
    return
  }
  const abriu = await recorte.value?.abrir(escolhido)
  if (abriu === false) erroFoto.value = recorte.value?.erro || 'Escolha uma imagem JPG, PNG ou WebP.'
}
async function fotoPronta({ blob, dataUrl }) {
  if (!perfil.value) return
  enviandoFoto.value = true
  try {
    const caminho = await enviarAvatar(supabase, perfil.value.id, blob)
    avatar.value = dataUrl
    perfil.value = { ...perfil.value, avatar_caminho: caminho }
    marcarSalvo('foto')
    avisar({ texto: 'Foto salva.', tipo: 'ok' })
  }
  catch {
    erroFoto.value = 'Não deu para enviar a foto agora. Tente de novo.'
  }
  enviandoFoto.value = false
}
async function removerFoto() {
  if (!perfil.value) return
  erroFoto.value = ''
  try {
    await removerAvatar(supabase, perfil.value.id, perfil.value.avatar_caminho)
    avatar.value = null
    perfil.value = { ...perfil.value, avatar_caminho: null }
    avisar({ texto: 'Foto removida.', tipo: 'ok' })
  }
  catch {
    erroFoto.value = 'Não deu para remover a foto agora. Tente de novo.'
  }
}
const trocarSenha = ref(null)

const pontos = computed(() => estudo.value?.pontos ?? 0)
const nivel = computed(() => nivelPorPontos(pontos.value))

// ---------- Estudo ----------
const form = reactive({ ritmo: 'normal', objetivo: '', areas: [], nivelQuestao: 'mostrar', ia: 'sem_treino', saida: null })
watch(perfil, (p) => {
  if (!p) return
  form.ritmo = p.ritmo
  form.objetivo = p.objetivo ?? ''
  form.areas = [...(p.areas_interesse ?? [])]
  form.ia = p.ia_permitida_padrao ?? 'sem_treino'
  form.saida = p.sair_inativo_min ?? null
}, { immediate: true })
watch(() => extra.value?.nivel_na_questao, (v) => (form.nivelQuestao = v ?? 'mostrar'), { immediate: true })

const opcoesRitmo = opcoes.ritmos.map((r) => ({ valor: r.valor, texto: `${r.texto} (${r.meta} por dia)`, descricao: r.resumo, icone: r.icone }))
const formatarData = (data) => new Intl.DateTimeFormat('pt-BR', { day: 'numeric', month: 'long', timeZone: 'America/Sao_Paulo' }).format(data)
const trocadoEm = computed(() => (perfil.value?.ritmo_trocado_em ? new Date(perfil.value.ritmo_trocado_em) : null))
const ritmoLivre = computed(() => podeTrocarRitmo(trocadoEm.value, new Date()))
const proximaTroca = computed(() => (trocadoEm.value ? new Date(trocadoEm.value.getTime() + DIAS_ENTRE_TROCAS_DE_RITMO * 86400000) : null))
const ritmoPendente = ref(null)
const trocandoRitmo = ref(false)
const nomeRitmo = (valor) => opcoes.ritmos.find((r) => r.valor === valor)?.texto ?? valor

function pedirTrocaRitmo(valor) {
  ritmoPendente.value = valor === perfil.value?.ritmo ? null : valor
}
function cancelarRitmo() {
  form.ritmo = perfil.value?.ritmo ?? 'normal'
  ritmoPendente.value = null
}
async function confirmarRitmo() {
  if (!ritmoPendente.value || trocandoRitmo.value) return
  trocandoRitmo.value = true
  const valor = ritmoPendente.value
  const { error } = await gravar({ ritmo: valor })
  trocandoRitmo.value = false
  if (error) {
    cancelarRitmo()
    return avisar({ texto: error.code === 'P0001' ? error.message : ERRO_SALVAR, tipo: 'erro' })
  }
  // O banco marca a data da troca; aqui a tela faz o mesmo para já mostrar a regra dos 7 dias.
  perfil.value = { ...perfil.value, ritmo_trocado_em: new Date().toISOString() }
  ritmoPendente.value = null
  marcarSalvo('ritmo')
  avisar({ texto: `Ritmo trocado para ${nomeRitmo(valor)}.`, tipo: 'ok' })
}

function mudouObjetivo(valor) {
  const antes = perfil.value?.objetivo ?? ''
  salvarEscolha('objetivo', { objetivo: valor || null }, () => (form.objetivo = antes))
}

// Áreas: várias escolhas seguidas viram uma gravação só, quando a pessoa para de marcar.
let relogioAreas = null
let areasAntes = null
const mesmas = (a, b) => a.length === b.length && a.every((x) => b.includes(x))
function gravarAreas() {
  clearTimeout(relogioAreas)
  relogioAreas = null
  const antes = areasAntes ?? []
  areasAntes = null
  const novas = [...form.areas]
  if (mesmas(antes, novas)) return
  salvarEscolha('areas', { areas_interesse: novas }, () => (form.areas = antes))
}
function mudouAreas() {
  if (!areasAntes) areasAntes = [...(perfil.value?.areas_interesse ?? [])]
  clearTimeout(relogioAreas)
  relogioAreas = setTimeout(gravarAreas, 900)
}
onBeforeUnmount(() => {
  if (relogioAreas) gravarAreas()
})

// O nível que libera vem da regra (shared/regras/desbloqueios.js), para o texto não ficar diferente dela.
const NIVEL_DISFARCE = DESBLOQUEIOS.find((d) => d.id === 'nivel_disfarcado').requisitos({ nivel: 1 })[0].meta
const disfarcarLiberado = computed(() => nivel.value >= NIVEL_DISFARCE)
const opcoesNivelQuestao = computed(() => [
  { valor: 'mostrar', texto: 'Mostrar o nível', descricao: 'Cada questão mostra o nível, de 1 a 5.', icone: Eye },
  { valor: 'esconder', texto: 'Esconder o nível', descricao: 'Você responde sem saber o nível.', icone: EyeOff },
  {
    valor: 'disfarcar',
    texto: 'Disfarçar o nível',
    descricao: disfarcarLiberado.value ? 'Mostra um nível perto do real, para você não se guiar só por ele.' : `Libera no nível ${NIVEL_DISFARCE}. Você está no nível ${nivel.value}.`,
    icone: disfarcarLiberado.value ? VenetianMask : Lock,
    desativado: !disfarcarLiberado.value,
  },
])
async function mudouNivelQuestao(valor) {
  const antes = extra.value?.nivel_na_questao ?? 'mostrar'
  const { error } = await supabase.from('perfis').update({ nivel_na_questao: valor }).eq('id', perfil.value?.id)
  if (error) {
    form.nivelQuestao = antes
    return avisar({ texto: ERRO_SALVAR, tipo: 'erro' })
  }
  extra.value = { ...extra.value, nivel_na_questao: valor }
  marcarSalvo('nivelQuestao')
  avisar({ texto: 'Salvo.', tipo: 'ok' })
}

// ---------- Aparência ----------
// Cor do PGC: troca na hora (o layout lê perfil.paleta) e volta atrás se não salvar.
const paletaAtual = computed(() => paletaDoPerfil(perfil.value?.paleta))
// A prévia de cada paleta usa as cores dela mesma (fundo, folha, borda, ações e a mescla), no tema da tela.
const estiloPaleta = (p) => Object.fromEntries(['claro', 'escuro'].flatMap((m) => Object.entries(p[m]).filter(([, v]) => typeof v === 'string').map(([k, v]) => [`--${m[0]}-${k}`, v])))
function escolherPaleta(id) {
  if (!perfil.value || paletaAtual.value === id) return
  const antes = perfil.value.paleta
  perfil.value = { ...perfil.value, paleta: id }
  salvarEscolha('paleta', { paleta: id }, () => (perfil.value = { ...perfil.value, paleta: antes }))
}
function mudouMovimento(evento) {
  const ligado = evento.target.checked
  salvarEscolha('movimento', { movimento_reduzido: ligado }, () => (evento.target.checked = !ligado))
}
const guiaVisivel = computed(() => !guia.estado.value.escondido)
function mudouGuia(evento) {
  if (evento.target.checked) guia.mostrar()
  else guia.esconder()
  marcarSalvo('guia')
  avisar({ texto: 'Salvo.', tipo: 'ok' })
}
const ESTILOS_GUIA = [
  { id: 'balao', nome: 'Balão perto da parte' },
  { id: 'painel', nome: 'Painel embaixo' },
]
const estiloGuia = computed(() => guia.estado.value.estilo)
function escolherEstiloGuia(id) {
  guia.definirEstilo(id)
  marcarSalvo('estiloGuia')
}
function reverPasseios() {
  guia.reverTudo()
  marcarSalvo('guia')
  avisar({ texto: 'Pronto. O guia mostra cada tela de novo na próxima visita.', tipo: 'ok' })
}

// ---------- Guia ----------
// Trocar o guia: um pronto ou o próprio (envio dos mosaicos, recortados no navegador). O nome vale para o próprio.
const { escolha: guiaAtual, url: guiaUrl } = useGuiaAtual()
const janelaGuia = ref(null)
const novoGuia = ref({ id: 'gato', imagem: null, nome: '' })
const erroGuia = ref('')
const salvandoGuia = ref(false)
function abrirGuia() {
  const id = guiaAtual.value.tipo === 'proprio' ? 'proprio' : guiaAtual.value.id
  novoGuia.value = { id, imagem: null, nome: guiaAtual.value.nomeDado ?? nomePadraoDoGuia(id) }
  erroGuia.value = ''
  janelaGuia.value?.abrir()
}
async function salvarGuia() {
  const g = novoGuia.value
  erroGuia.value = ''
  if (g.id === 'proprio' && !g.imagem && guiaAtual.value.tipo !== 'proprio') {
    erroGuia.value = 'Envie as duas imagens para criar o seu guia, ou escolha um pronto.'
    return
  }
  salvandoGuia.value = true
  try {
    if (g.id === 'proprio' && g.imagem) {
      await enviarGuia(supabase, perfil.value.id, dataUrlParaBlob(g.imagem), { nome: nomeParaGuardar('proprio', g.nome), versao: perfil.value.guia_versao ?? 0 })
    }
    else {
      const { error } = await supabase.from('perfis').update({ guia: g.id, guia_nome: nomeParaGuardar(g.id, g.nome) }).eq('id', perfil.value.id)
      if (error) throw error
    }
    await refreshNuxtData('perfil')
    janelaGuia.value?.fechar()
    marcarSalvo('personagem')
    avisar({ texto: 'Guia salvo.', tipo: 'ok' })
  }
  catch {
    erroGuia.value = 'Não deu para salvar o guia agora. Tente de novo.'
  }
  salvandoGuia.value = false
}

// ---------- Privacidade ----------
function mudouIa(valor) {
  const antes = perfil.value?.ia_permitida_padrao ?? 'sem_treino'
  salvarEscolha('ia', { ia_permitida_padrao: valor }, () => (form.ia = antes))
}
const precisaApelido = ref(false)
function mudouRanking(evento) {
  const ligar = evento.target.checked
  if (ligar && !perfil.value?.apelido) {
    evento.target.checked = false
    precisaApelido.value = true
    focar('apelido-perfil')
    return
  }
  precisaApelido.value = false
  salvarEscolha('ranking', { ranking_participa: ligar }, () => (evento.target.checked = !ligar), ligar ? 'Você entrou no ranking.' : 'Você saiu do ranking.')
}

// ---------- Sessão ----------
function mudouSaida(valor) {
  const antes = perfil.value?.sair_inativo_min ?? null
  salvarEscolha('saida', { sair_inativo_min: valor }, () => (form.saida = antes))
}
const saindo = ref('')
async function sairDaConta(escopo) {
  if (saindo.value) return
  saindo.value = escopo
  await sair(escopo)
  saindo.value = ''
}
</script>

<template>
  <div class="mx-auto w-full max-w-[1040px]">
    <CabecalhoPagina titulo="Perfil" descricao="Sua conta, seu jeito de estudar e a sua privacidade." />

    <!-- Celular: atalhos para cada parte -->
    <nav aria-label="Partes do perfil" class="-mx-4 mt-4 overflow-x-auto px-4 pb-1 lg:hidden">
      <ul class="m-0 flex w-max list-none gap-2 p-0">
        <li v-for="s in SECOES" :key="s.id">
          <a
            :href="`#${s.id}`"
            class="flex h-10 items-center gap-2 rounded-[12px] border px-3.5 text-[14px] font-semibold no-underline transition-colors"
            :class="secaoVisivel === s.id ? 'border-acento bg-acento-suave text-acento' : 'border-borda bg-folha text-texto-2'"
            :aria-current="secaoVisivel === s.id ? 'true' : undefined"
            @click="secaoVisivel = s.id"
          >
            <component :is="s.icone" :size="16" :stroke-width="2" aria-hidden="true" />
            <span>{{ s.nome }}</span>
          </a>
        </li>
      </ul>
    </nav>

    <div class="mt-5 lg:mt-7 lg:grid lg:grid-cols-[196px_minmax(0,1fr)] lg:gap-10">
      <!-- Computador: índice preso ao lado -->
      <nav aria-label="Partes do perfil" class="hidden lg:block">
        <ul class="sticky top-6 m-0 flex list-none flex-col gap-1 p-0">
          <li v-for="s in SECOES" :key="s.id">
            <a
              :href="`#${s.id}`"
              class="flex h-10 items-center gap-2.5 rounded-[11px] px-3 text-[14.5px] font-semibold no-underline transition-colors"
              :class="secaoVisivel === s.id ? 'bg-acento-suave text-acento' : 'text-texto-2 hover:bg-folha-2 hover:text-tinta'"
              :aria-current="secaoVisivel === s.id ? 'true' : undefined"
              @click="secaoVisivel = s.id"
            >
              <component :is="s.icone" :size="17" :stroke-width="2" aria-hidden="true" />
              <span>{{ s.nome }}</span>
            </a>
          </li>
        </ul>
      </nav>

      <div v-if="!perfil" class="flex max-w-[780px] flex-col gap-5" aria-busy="true">
        <div class="esqueleto h-[320px] rounded-[20px]" />
        <div class="esqueleto h-[260px] rounded-[20px]" />
      </div>

      <div v-else class="flex min-w-0 max-w-[780px] flex-col gap-5">
        <!-- Conta -->
        <PerfilSecao id="conta" titulo="Conta" :icone="UserRound" class="entra" style="--i: 0">
          <div class="flex flex-wrap items-center gap-x-5 gap-y-3 py-4">
            <AvatarPerfil :src="avatar" :nome="perfil.nome_exibicao" :tamanho="80" class="shrink-0" />
            <div class="min-w-0 flex-1">
              <p class="m-0 truncate font-titulo text-[26px] font-semibold leading-tight tracking-[-0.01em]">{{ perfil.nome_exibicao }}</p>
              <div class="mt-1.5 flex flex-wrap items-center gap-2">
                <span class="selo" data-tipo="acento">Nível {{ nivel }}</span>
                <span class="selo" data-tipo="energia"><NumeroAnimado :valor="pontos" /> pontos</span>
              </div>
            </div>
            <div class="flex basis-full flex-wrap items-center gap-2 sm:basis-auto">
              <button type="button" class="botao-secundario botao-p" :aria-busy="enviandoFoto" :disabled="enviandoFoto" @click="arquivo?.click()">
                <Camera :size="16" :stroke-width="2" aria-hidden="true" />
                <span>{{ enviandoFoto ? 'Enviando' : avatar ? 'Trocar foto' : 'Escolher foto' }}</span>
              </button>
              <button v-if="perfil.avatar_caminho" type="button" class="botao-fantasma botao-p" @click="removerFoto">
                <Trash2 :size="16" :stroke-width="2" aria-hidden="true" />
                <span>Remover</span>
              </button>
            </div>
            <input ref="arquivo" type="file" accept="image/jpeg,image/png,image/webp" class="hidden" @change="escolherFoto">
            <EntradaErroCampo class="basis-full" :mensagem="erroFoto" />
          </div>

          <PerfilLinha rotulo="Nome de exibição" para="nome-perfil" ajuda="Aparece no menu e no início." :salvo="salvo.nome">
            <form class="flex max-w-[400px] items-start gap-2" novalidate @submit.prevent="salvarNome">
              <div class="min-w-0 flex-1">
                <input
                  id="nome-perfil"
                  v-model="conta.nome"
                  class="campo"
                  type="text"
                  autocomplete="nickname"
                  maxlength="60"
                  :aria-invalid="!!errosConta.nome"
                  :aria-describedby="errosConta.nome ? 'erro-nome-perfil' : undefined"
                >
                <EntradaErroCampo id="erro-nome-perfil" :mensagem="errosConta.nome" :vez="tentativa" />
              </div>
              <Transition name="desliza">
                <EntradaBotaoEnviar v-if="nomeMudou" :carregando="salvando.nome" texto="Salvar" texto-carregando="Salvando" />
              </Transition>
            </form>
          </PerfilLinha>

          <PerfilLinha rotulo="Apelido" para="apelido-perfil" id-ajuda="ajuda-apelido-perfil" :salvo="salvo.apelido">
            <template #ajuda>Seu nome no ranking. Letras, números, ponto, hífen e sublinhado.</template>
            <form class="flex max-w-[400px] items-start gap-2" novalidate @submit.prevent="salvarApelido">
              <div class="min-w-0 flex-1">
                <input
                  id="apelido-perfil"
                  v-model="conta.apelido"
                  class="campo"
                  type="text"
                  autocomplete="off"
                  autocapitalize="off"
                  spellcheck="false"
                  :maxlength="APELIDO_MAX"
                  :aria-invalid="!!errosConta.apelido"
                  :aria-describedby="errosConta.apelido ? 'ajuda-apelido-perfil erro-apelido-perfil' : 'ajuda-apelido-perfil'"
                >
                <EntradaErroCampo id="erro-apelido-perfil" :mensagem="errosConta.apelido" :vez="tentativa" />
                <Transition name="abre">
                  <div v-if="precisaApelido && !errosConta.apelido">
                    <p class="m-0 mt-2 flex items-start gap-2 rounded-[12px] bg-aviso-suave px-3.5 py-2.5 text-[13.5px] leading-[1.45]" role="alert">
                      <Trophy :size="16" :stroke-width="2" class="mt-px shrink-0 text-aviso" aria-hidden="true" />
                      <span>Para entrar no ranking, escolha um apelido e salve. Você entra logo em seguida.</span>
                    </p>
                  </div>
                </Transition>
              </div>
              <Transition name="desliza">
                <EntradaBotaoEnviar v-if="apelidoMudou" :carregando="salvando.apelido" texto="Salvar" texto-carregando="Salvando" />
              </Transition>
            </form>
          </PerfilLinha>

          <PerfilLinha rotulo="E-mail" ajuda="Usado para entrar. Não muda por aqui.">
            <p class="m-0 flex min-h-[46px] items-center gap-2 text-[15px] [overflow-wrap:anywhere]">
              <Lock :size="15" :stroke-width="2" class="shrink-0 text-texto-3" aria-hidden="true" />
              <span>{{ usuario?.email }}</span>
            </p>
          </PerfilLinha>

          <PerfilLinha rotulo="Senha" ajuda="Pede a senha atual antes de trocar.">
            <button type="button" class="botao-secundario botao-p" @click="trocarSenha?.abrir()">
              <KeyRound :size="16" :stroke-width="2" aria-hidden="true" />
              <span>Trocar a senha</span>
            </button>
          </PerfilLinha>
        </PerfilSecao>

        <!-- Estudo -->
        <PerfilSecao id="estudo" titulo="Estudo" :icone="Gauge" data-guia="perfil-estudo" class="entra" style="--i: 1">
          <PerfilLinha rotulo="Ritmo" para="ritmo-perfil" id-ajuda="ajuda-ritmo" :salvo="salvo.ritmo">
            <template #ajuda>
              <template v-if="ritmoLivre">Quantas questões por dia o PGC cobra. Dá para trocar uma vez a cada 7 dias.</template>
              <template v-else>Você trocou em {{ formatarData(trocadoEm) }}. A próxima troca fica livre em {{ formatarData(proximaTroca) }}.</template>
            </template>
            <div class="max-w-[400px]">
              <Selecao id="ritmo-perfil" v-model="form.ritmo" :opcoes="opcoesRitmo" :desativado="!ritmoLivre" descrito="ajuda-ritmo" @change="pedirTrocaRitmo" />
              <p v-if="!ritmoLivre" class="m-0 mt-2 flex items-center gap-1.5 text-[13px] font-semibold text-texto-2">
                <Lock :size="14" :stroke-width="2.1" aria-hidden="true" />
                <span>Travado até {{ formatarData(proximaTroca) }}</span>
              </p>
            </div>
            <Transition name="abre">
              <div v-if="ritmoPendente" class="max-w-[400px]">
                <div class="mt-3 rounded-[14px] bg-aviso-suave px-4 py-3" role="alert">
                  <p class="m-0 text-[14px] leading-[1.45]">
                    Trocar para <strong>{{ nomeRitmo(ritmoPendente) }}</strong>? Depois disso, o ritmo fica 7 dias sem poder mudar.
                  </p>
                  <div class="mt-2.5 flex flex-wrap gap-2">
                    <button type="button" class="botao botao-p" :aria-busy="trocandoRitmo" :disabled="trocandoRitmo" @click="confirmarRitmo">
                      <Gauge :size="16" :stroke-width="2" aria-hidden="true" />
                      <span>Trocar o ritmo</span>
                    </button>
                    <button type="button" class="botao-fantasma botao-p" @click="cancelarRitmo">Cancelar</button>
                  </div>
                </div>
              </div>
            </Transition>
          </PerfilLinha>

          <PerfilLinha rotulo="Objetivo" para="objetivo-perfil" ajuda="Ajuda a escolher o estilo das questões." :salvo="salvo.objetivo">
            <div class="max-w-[400px]">
              <Selecao id="objetivo-perfil" v-model="form.objetivo" :opcoes="opcoes.objetivos" @change="mudouObjetivo" />
            </div>
          </PerfilLinha>

          <PerfilLinha rotulo="Áreas que você estuda" para="areas-perfil" ajuda="Ajuda a sugerir matérias e textos." :salvo="salvo.areas">
            <div class="max-w-[400px]">
              <Selecao id="areas-perfil" v-model="form.areas" multiplo :opcoes="opcoes.areas" texto-vazio="Nenhuma escolhida" @change="mudouAreas" />
            </div>
          </PerfilLinha>

          <PerfilLinha rotulo="Nível na questão" para="nivel-questao-perfil" ajuda="Padrão dos estudos novos. Cada estudo pode mudar." :salvo="salvo.nivelQuestao">
            <div class="max-w-[400px]">
              <Selecao id="nivel-questao-perfil" v-model="form.nivelQuestao" :opcoes="opcoesNivelQuestao" @change="mudouNivelQuestao" />
            </div>
          </PerfilLinha>
        </PerfilSecao>

        <!-- Aparência -->
        <PerfilSecao id="aparencia" titulo="Aparência" :icone="Palette" class="entra" style="--i: 2">
          <PerfilLinha rotulo="Tema" ajuda="Claro, escuro ou igual ao sistema. Fica salvo neste navegador.">
            <div class="inline-flex">
              <SeletorTema />
            </div>
          </PerfilLinha>
          <PerfilLinha rotulo="Cor do PGC" ajuda="A cor dos botões e destaques. Azul é o padrão." :salvo="salvo.paleta">
            <div role="radiogroup" aria-label="Cor do PGC" class="paletas">
              <button
                v-for="p in PALETAS"
                :key="p.id"
                type="button"
                role="radio"
                :aria-checked="paletaAtual === p.id"
                class="paleta"
                :style="estiloPaleta(p)"
                @click="escolherPaleta(p.id)"
              >
                <span class="previa" aria-hidden="true">
                  <span class="mini-lado"><i /><i class="mini-ativo" /><i /><i /></span>
                  <span class="mini-corpo"><i class="mini-linha" /><i class="mini-trilho"><b /></i><i class="mini-botao" /></span>
                </span>
                <span class="flex items-center gap-1.5 text-[13.5px] font-semibold">
                  {{ p.nome }}<span v-if="p.descricao" class="font-normal text-texto-3">{{ p.descricao.toLowerCase() }}</span>
                  <Check v-if="paletaAtual === p.id" :size="14" :stroke-width="2.8" class="ml-auto text-acento" aria-hidden="true" />
                </span>
              </button>
            </div>
          </PerfilLinha>
          <PerfilLinha rotulo="Menos movimento" para="movimento-perfil" id-ajuda="ajuda-movimento" ajuda="Desliga as animações. Bom se elas incomodam ou deixam o computador lento." :salvo="salvo.movimento">
            <label class="flex min-h-10 cursor-pointer items-center gap-3">
              <input
                id="movimento-perfil"
                type="checkbox"
                role="switch"
                class="alternador"
                :checked="!!perfil.movimento_reduzido"
                aria-describedby="ajuda-movimento"
                @change="mudouMovimento"
              >
              <span class="text-[14px] text-texto-2" aria-hidden="true">{{ perfil.movimento_reduzido ? 'Ligado' : 'Desligado' }}</span>
            </label>
          </PerfilLinha>
          <PerfilLinha rotulo="Seu guia" ajuda="Quem te acompanha nas telas. Pode ser um pronto ou um seu, criado com uma imagem." :salvo="salvo.personagem">
            <div class="flex flex-wrap items-center gap-3.5">
              <GuiaPersonagem humor="feliz" :tamanho="64" />
              <div class="min-w-0">
                <p class="m-0 text-[15px] font-semibold">{{ guiaAtual.nome }}</p>
                <p class="m-0 text-[13px] text-texto-2">{{ guiaAtual.tipo === 'proprio' ? 'Criado por você' : 'Guia pronto' }}</p>
              </div>
              <button type="button" class="botao-secundario botao-p" @click="abrirGuia">Trocar o guia</button>
            </div>
          </PerfilLinha>
          <JanelaBase ref="janelaGuia" titulo="Trocar o guia" larga>
            <GuiaEscolherGuia v-model="novoGuia" :imagem-atual="guiaAtual.tipo === 'proprio' ? guiaUrl || '' : ''" />
            <EntradaErroCampo :mensagem="erroGuia" />
            <template #rodape>
              <button type="button" class="botao-fantasma" @click="janelaGuia.fechar()">Cancelar</button>
              <button type="button" class="botao" :disabled="salvandoGuia" :aria-busy="salvandoGuia" @click="salvarGuia">
                <span v-if="salvandoGuia" class="rodando" aria-hidden="true" />Salvar
              </button>
            </template>
          </JanelaBase>
          <PerfilLinha rotulo="Passeios do guia" para="guia-perfil" id-ajuda="ajuda-guia" ajuda="O guia explica cada tela na primeira visita." :salvo="salvo.guia">
            <div class="flex flex-wrap items-center gap-x-5 gap-y-3">
              <label class="flex min-h-10 cursor-pointer items-center gap-3">
                <input
                  id="guia-perfil"
                  type="checkbox"
                  role="switch"
                  class="alternador"
                  :checked="guiaVisivel"
                  aria-describedby="ajuda-guia"
                  @change="mudouGuia"
                >
                <span class="text-[14px] text-texto-2" aria-hidden="true">{{ guiaVisivel ? 'Aparece nas telas' : 'Escondido' }}</span>
              </label>
              <button type="button" class="botao-secundario botao-p" @click="reverPasseios">
                <RotateCcw :size="16" :stroke-width="2" aria-hidden="true" />
                <span>Rever os passeios</span>
              </button>
            </div>
          </PerfilLinha>
          <PerfilLinha rotulo="Jeito do passeio" ajuda="Como o guia fala com você no computador. No celular é sempre o painel." :salvo="salvo.estiloGuia">
            <div role="radiogroup" aria-label="Jeito do passeio" class="flex flex-wrap gap-2">
              <button
                v-for="e in ESTILOS_GUIA"
                :key="e.id"
                type="button"
                role="radio"
                class="pilula"
                :aria-checked="estiloGuia === e.id"
                @click="escolherEstiloGuia(e.id)"
              >
                {{ e.nome }}
              </button>
            </div>
          </PerfilLinha>
        </PerfilSecao>

        <!-- Privacidade -->
        <PerfilSecao id="privacidade" titulo="Privacidade" :icone="ShieldCheck" class="entra" style="--i: 3">
          <PerfilLinha rotulo="Quem pode ler os seus textos novos" para="ia-perfil" ajuda="Vale para os textos que você adicionar daqui em diante. Cada texto pode mudar depois." :salvo="salvo.ia">
            <div class="max-w-[400px]">
              <Selecao id="ia-perfil" v-model="form.ia" :opcoes="IA_PERMITIDA" @change="mudouIa" />
            </div>
          </PerfilLinha>
          <PerfilLinha rotulo="Participar do ranking" para="ranking-perfil" id-ajuda="ajuda-ranking" ajuda="Seu apelido e seus pontos aparecem para os colegas. Suas respostas, nunca." :salvo="salvo.ranking">
            <label class="flex min-h-10 cursor-pointer items-center gap-3">
              <input
                id="ranking-perfil"
                type="checkbox"
                role="switch"
                class="alternador"
                :checked="!!perfil.ranking_participa"
                aria-describedby="ajuda-ranking"
                @change="mudouRanking"
              >
              <span class="text-[14px] text-texto-2" aria-hidden="true">{{ perfil.ranking_participa ? 'Participando' : 'Fora do ranking' }}</span>
            </label>
            <p v-if="!perfil.apelido" class="m-0 mt-1.5 flex items-center gap-1.5 text-[13px] text-texto-2">
              <UserRound :size="14" :stroke-width="2" aria-hidden="true" />
              <span>Precisa de um apelido (em Conta).</span>
            </p>
          </PerfilLinha>
          <PerfilLinha rotulo="Política de privacidade" ajuda="O que o PGC guarda e quem pode ver.">
            <NuxtLink to="/privacidade" class="botao-secundario botao-p">
              <FileText :size="16" :stroke-width="2" aria-hidden="true" />
              <span>Ler a política</span>
            </NuxtLink>
          </PerfilLinha>
        </PerfilSecao>

        <!-- Sessão -->
        <PerfilSecao id="sessao" titulo="Sessão" :icone="MonitorSmartphone" data-guia="perfil-sessao" class="entra" style="--i: 4">
          <PerfilLinha rotulo="Sair sozinho depois de um tempo parado" para="saida-perfil" ajuda="Em computador da escola, escolha 30 minutos." :salvo="salvo.saida">
            <div class="max-w-[400px]">
              <Selecao id="saida-perfil" v-model="form.saida" :opcoes="SAIDA_INATIVO" @change="mudouSaida" />
            </div>
          </PerfilLinha>
          <PerfilLinha rotulo="Sair" ajuda="Em computador da escola, saia sempre que terminar.">
            <div class="flex flex-wrap items-center gap-2.5">
              <BotaoSair texto="Sair desta conta" :carregando="saindo === 'local'" @click="sairDaConta('local')" />
              <button type="button" class="botao-secundario botao-p" :aria-busy="saindo === 'global'" :disabled="!!saindo" @click="sairDaConta('global')">
                <MonitorSmartphone :size="16" :stroke-width="2" aria-hidden="true" />
                <span>Sair de todos os aparelhos</span>
              </button>
            </div>
          </PerfilLinha>
          <PerfilLinha v-if="souDono" rotulo="Diagnóstico de IA" ajuda="Só quem cuida do PGC vê esta opção.">
            <NuxtLink to="/diagnostico" class="botao-secundario botao-p">
              <Activity :size="16" :stroke-width="2" aria-hidden="true" />
              <span>Abrir o diagnóstico</span>
            </NuxtLink>
          </PerfilLinha>
        </PerfilSecao>
      </div>
    </div>

    <RecortarFoto ref="recorte" @pronto="fotoPronta" />
    <PerfilTrocarSenha ref="trocarSenha" />
  </div>
</template>

<style scoped>
/* Cor do PGC: cada opção mostra uma tela em miniatura nas cores dela (fundo, menu, barra com a mescla e botão). */
.paletas {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(118px, 1fr));
  gap: 10px;
  max-width: 660px;
}
.paleta {
  --pm: var(--c-mesa);
  --pf: var(--c-folha);
  --pb: var(--c-borda);
  --a: var(--c-acento);
  --s: var(--c-suave);
  --p2: var(--c-segunda);
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 7px 8px 8px;
  border: 1.5px solid var(--borda);
  border-radius: 14px;
  background: var(--folha);
  color: var(--tinta);
  text-align: left;
  cursor: pointer;
  transition: border-color 0.15s, transform 0.15s var(--ease-mola);
}
:global(:root.dark) .paleta {
  --pm: var(--e-mesa);
  --pf: var(--e-folha);
  --pb: var(--e-borda);
  --a: var(--e-acento);
  --s: var(--e-suave);
  --p2: var(--e-segunda);
}
.paleta:hover {
  border-color: var(--borda-forte);
  transform: translateY(-1px);
}
.paleta[aria-checked='true'] {
  border-color: var(--a);
}
.previa {
  display: flex;
  height: 60px;
  overflow: hidden;
  border: 1px solid var(--pb);
  border-radius: 9px;
  background: var(--pm);
}
.previa i,
.previa b {
  display: block;
  border-radius: 3px;
}
.mini-lado {
  display: flex;
  width: 30%;
  flex-direction: column;
  gap: 5px;
  padding: 7px 5px;
  border-right: 1px solid var(--pb);
  background: var(--pf);
}
.mini-lado i {
  height: 5px;
  background: var(--pb);
}
.mini-lado i.mini-ativo {
  background: var(--a);
}
.mini-corpo {
  display: flex;
  flex: 1;
  flex-direction: column;
  justify-content: center;
  gap: 7px;
  padding: 6px 8px;
}
.mini-linha {
  width: 68%;
  height: 5px;
  background: var(--pb);
}
.mini-trilho {
  height: 6px;
  overflow: hidden;
  background: var(--s);
}
.mini-trilho b {
  width: 70%;
  height: 100%;
  background: linear-gradient(90deg, var(--a), var(--p2));
}
.mini-botao {
  width: 48%;
  height: 12px;
  border-radius: 999px;
  background: var(--a);
}
@media (prefers-reduced-motion: reduce) {
  .paleta {
    transition: none;
  }
  .paleta:hover {
    transform: none;
  }
}
</style>
