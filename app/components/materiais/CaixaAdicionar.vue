<script setup>
// Caixa única para adicionar um texto à Biblioteca. A pessoa arrasta um arquivo, cola um texto ou escreve um tema,
// tudo no mesmo lugar, e a caixa entende o que é: arquivo vai para o envio; texto longo pede título e matéria;
// texto curto vira busca em textos abertos (Wikilivros, Wikiversidade, Wikipédia), pensando na matéria, e também
// oferece o pedido de um texto completo para outra IA (MateriaisPedirTexto).
// Depois do envio, "Confira rapidinho" mostra as páginas lidas e aprova tudo com um botão.
// Uso: <MateriaisCaixaAdicionar ref="caixa" :materia-inicial="id" :tema-inicial="tema" />, caixa.value.focar()
import { ChevronDown, CircleAlert, ClipboardType, FileText, RotateCcw, Search, Upload, X } from '@lucide/vue'
import { normalizar } from '#shared/regras/catalogo.js'
import { assuntosAtivos } from '#shared/regras/materias.js'
import { IA_PERMITIDA } from '#shared/regras/perfil.js'
import { limparTextoColado } from '#shared/regras/textoColado.js'
import { LIMITE_TITULO, TEXTO_COLADO_MAXIMO, conferirArquivo, formatarTamanho, mensagemErroMaterial, tipoDeEntrada, tituloDoArquivo, validarTitulo } from '#shared/regras/materiais.js'

const props = defineProps({
  materiaInicial: { type: String, default: '' },
  temaInicial: { type: String, default: '' },
})
const emit = defineEmits(['adicionou'])

const { data: materias } = useMaterias()
const { data: perfil } = usePerfil()
const api = useMateriais()
const { avisar } = useAvisos()

const campo = ref(null)
const seletorArquivo = ref(null)
const entrada = ref(props.temaInicial)
const arquivo = ref(null)
const erroArquivo = ref('')
const arrastando = ref(false)
const materiaId = ref(props.materiaInicial)
const assuntoId = ref('')
const materiaTocada = ref(!!props.materiaInicial)
const titulo = ref('')
const erros = reactive({ titulo: '', materia: '' })
const ia = ref(perfil.value?.ia_permitida_padrao ?? 'sem_treino')
const iaTocada = ref(false)
watch(() => perfil.value?.ia_permitida_padrao, (v) => {
  if (v && !iaTocada.value) ia.value = v
})
const maisOpcoes = ref(false)
const fase = ref('editando') // editando | enviando | lendo | conferir | falhou
const progresso = ref(0)
const novo = ref(null)
const falha = ref('')
const temaBuscado = ref('')

const modo = computed(() => (arquivo.value ? 'arquivo' : tipoDeEntrada(entrada.value)))
const ativas = computed(() => (materias.value ?? []).filter((m) => !m.arquivada_em))
const materia = computed(() => ativas.value.find((m) => m.id === materiaId.value) ?? null)
const opcoesMateria = computed(() => ativas.value.map((m) => ({ valor: m.id, texto: m.nome, cor: `${corMateria(m.cor)}` })))
const opcoesAssunto = computed(() => [
  { valor: '', texto: 'Nenhum em especial' },
  ...assuntosAtivos(materia.value).map((a) => ({ valor: a.id, texto: a.nome })),
])
const opcoesIa = IA_PERMITIDA.map((o) => ({ valor: o.valor, texto: o.texto, descricao: o.descricao }))
const nomeAssunto = computed(() => assuntosAtivos(materia.value).find((a) => a.id === assuntoId.value)?.nome ?? '')
// Texto colado: as fórmulas partidas, o LaTeX e a marcação das IAs já aparecem arrumados no campo (o servidor
// arruma de novo ao salvar, então nada depende disto).
function colou() {
  nextTick(() => {
    const limpo = limparTextoColado(entrada.value)
    if (limpo !== entrada.value) entrada.value = limpo
  })
}
// Copiou o pedido de texto para uma IA: o tema já fica como nome do texto que vai ser colado.
function copiouPedido() {
  if (!titulo.value.trim()) titulo.value = (temaBuscado.value.charAt(0).toUpperCase() + temaBuscado.value.slice(1)).slice(0, LIMITE_TITULO)
}
watch(materiaId, () => {
  erros.materia = ''
  if (!assuntosAtivos(materia.value).some((a) => a.id === assuntoId.value)) assuntoId.value = ''
})

// Tema com o nome de um assunto ou matéria já escolhe a matéria (e o assunto) sozinho.
watch(entrada, () => {
  if (modo.value !== 'tema' || materiaTocada.value) return
  const t = normalizar(entrada.value)
  if (t.length < 3) return
  for (const m of ativas.value) {
    const a = assuntosAtivos(m).find((x) => normalizar(x.nome) === t)
    if (a) {
      materiaId.value = m.id
      nextTick(() => { assuntoId.value = a.id })
      return
    }
  }
  const m = ativas.value.find((x) => normalizar(x.nome) === t)
  if (m) materiaId.value = m.id
})

const plural = (n, um, varios) => `${n} ${n === 1 ? um : varios}`
const deteccao = computed(() => {
  if (modo.value === 'arquivo') return { icone: FileText, texto: `Arquivo ${conferirArquivo(arquivo.value).formato?.toUpperCase() ?? ''}, ${formatarTamanho(arquivo.value.size)}` }
  if (modo.value === 'texto') return { icone: ClipboardType, texto: `Texto colado, ${new Intl.NumberFormat('pt-BR').format(entrada.value.trim().length)} caracteres` }
  if (modo.value === 'tema') return { icone: Search, texto: 'Tema: o PGC procura textos abertos sobre ele' }
  return null
})

function escolherArquivo(f) {
  if (!f) return
  const c = conferirArquivo(f)
  if (c.erro) {
    erroArquivo.value = c.erro
    return
  }
  erroArquivo.value = ''
  arquivo.value = f
  titulo.value = tituloDoArquivo(f.name)
  erros.titulo = ''
  temaBuscado.value = ''
}
function tirarArquivo() {
  arquivo.value = null
  titulo.value = ''
  nextTick(() => campo.value?.focus())
}
function soltou(e) {
  arrastando.value = false
  escolherArquivo(e.dataTransfer?.files?.[0])
}
function saiu(e) {
  if (!e.currentTarget.contains(e.relatedTarget)) arrastando.value = false
}

function limpar() {
  entrada.value = ''
  arquivo.value = null
  titulo.value = ''
  erroArquivo.value = ''
  erros.titulo = ''
  erros.materia = ''
  temaBuscado.value = ''
  fase.value = 'editando'
  novo.value = null
  falha.value = ''
  progresso.value = 0
  maisOpcoes.value = false
}

const textoBotao = computed(() => ({ tema: 'Buscar textos', texto: 'Salvar texto', arquivo: 'Enviar arquivo' }[modo.value] ?? 'Adicionar'))
const iconeBotao = computed(() => ({ tema: Search, arquivo: Upload }[modo.value] ?? ClipboardType))

function principal() {
  if (modo.value === 'tema') {
    temaBuscado.value = entrada.value.replace(/\s+/g, ' ').trim()
    return
  }
  enviar()
}

async function enviar() {
  erros.titulo = validarTitulo(titulo.value)
  erros.materia = materiaId.value ? '' : 'Escolha a matéria do texto.'
  if (erros.titulo || erros.materia) return
  if (modo.value === 'texto' && entrada.value.trim().length > TEXTO_COLADO_MAXIMO) {
    erros.titulo = 'O texto passa de 400 mil caracteres. Divida em partes menores.'
    return
  }
  const formato = arquivo.value ? conferirArquivo(arquivo.value).formato : 'txt'
  const corpo = arquivo.value ?? new Blob([entrada.value.trim()], { type: 'text/plain' })
  fase.value = 'enviando'
  progresso.value = 0
  try {
    const r = await api.enviar({
      corpo,
      formato,
      origem: arquivo.value ? 'arquivo' : 'texto_colado',
      titulo: titulo.value.trim(),
      nomeArquivo: arquivo.value?.name ?? null,
      materiaId: materiaId.value,
      assuntoId: assuntoId.value || null,
      ia: ia.value,
    }, (p) => {
      progresso.value = p
      if (p >= 100) fase.value = 'lendo'
    })
    novo.value = { id: r.id, titulo: titulo.value.trim(), unidade: formato === 'pdf' ? 'página' : 'parte' }
    if (r.status === 'erro') {
      falha.value = mensagemErroMaterial(r.erro).texto
      fase.value = 'falhou'
    }
    else if (r.status === 'pronto') {
      avisar({ texto: 'Texto adicionado.', tipo: 'ok' })
      emit('adicionou', r.id)
      limpar()
    }
    else fase.value = 'conferir'
  }
  catch (e) {
    falha.value = e?.message || 'Não deu para enviar agora. Confira a internet e tente de novo.'
    fase.value = 'falhou'
  }
}

async function tentarDeNovo() {
  if (!novo.value?.id) return limpar()
  fase.value = 'lendo'
  const r = await api.extrair(novo.value.id)
  if (r.status === 'erro') {
    falha.value = mensagemErroMaterial(r.erro).texto
    fase.value = 'falhou'
  }
  else fase.value = 'conferir'
}

function aprovado() {
  emit('adicionou', novo.value?.id)
  limpar()
}
function importou(id) {
  emit('adicionou', id)
  limpar()
}

function focar() {
  campo.value?.scrollIntoView({ block: 'center', behavior: 'smooth' })
  campo.value?.focus({ preventScroll: true })
}
onMounted(() => {
  if (props.temaInicial && tipoDeEntrada(props.temaInicial) === 'tema') temaBuscado.value = props.temaInicial.trim()
})
defineExpose({ focar })
</script>

<template>
  <section data-guia="biblioteca-adicionar" class="cartao" aria-labelledby="titulo-adicionar">
    <h2 id="titulo-adicionar" class="titulo-secao">Adicionar texto</h2>
    <p class="m-0 mt-1 text-[14.5px] text-texto-2">Arraste um arquivo, cole um texto ou escreva um tema. O PGC entende o que é.</p>

    <template v-if="fase === 'editando'">
      <label for="entrada-biblioteca" class="rotulo mt-4">Tema, texto ou arquivo</label>
      <div
        class="zona"
        :data-arrastando="arrastando || undefined"
        @dragenter.prevent="arrastando = true"
        @dragover.prevent="arrastando = true"
        @dragleave="saiu"
        @drop.prevent="soltou"
      >
        <div v-if="arquivo" class="flex items-center gap-3 px-4 py-3.5">
          <FileText :size="22" :stroke-width="1.9" aria-hidden="true" class="shrink-0 text-texto-2" />
          <div class="min-w-0 flex-1">
            <p class="m-0 truncate text-[15px] font-semibold">{{ arquivo.name }}</p>
            <p class="m-0 text-[13px] text-texto-3">{{ formatarTamanho(arquivo.size) }}</p>
          </div>
          <button type="button" class="botao-fantasma botao-p" @click="seletorArquivo?.click()">Trocar</button>
          <button type="button" class="botao-icone pequeno" aria-label="Tirar o arquivo" data-dica="Tirar o arquivo" @click="tirarArquivo">
            <X :size="17" :stroke-width="2" aria-hidden="true" />
          </button>
        </div>
        <textarea
          v-else
          id="entrada-biblioteca"
          ref="campo"
          v-model="entrada"
          class="entrada"
          rows="2"
          spellcheck="true"
          aria-describedby="ajuda-entrada"
          @keydown.enter.exact="modo === 'tema' && ($event.preventDefault(), principal())"
          @paste="colou"
        />
        <div class="barra-zona">
          <button type="button" class="botao-fantasma botao-p -ml-1" @click="seletorArquivo?.click()">
            <Upload :size="16" :stroke-width="2" aria-hidden="true" />Escolher arquivo
          </button>
          <span id="ajuda-entrada" class="text-[12.5px] text-texto-3">PDF, DOCX ou TXT até 10 MB</span>
          <Transition name="aparece-rapido" mode="out-in">
            <span v-if="deteccao" :key="modo" class="deteccao" aria-live="polite">
              <component :is="deteccao.icone" :size="15" :stroke-width="2.1" aria-hidden="true" />{{ deteccao.texto }}
            </span>
          </Transition>
        </div>
        <p v-if="arrastando" class="solte" aria-hidden="true"><Upload :size="20" :stroke-width="2" />Solte o arquivo para enviar</p>
        <input ref="seletorArquivo" type="file" class="so-leitor" tabindex="-1" accept=".pdf,.docx,.txt,application/pdf,text/plain" @change="escolherArquivo($event.target.files?.[0]); $event.target.value = ''">
      </div>
      <p v-if="erroArquivo" class="erro-campo" role="alert"><CircleAlert :size="16" :stroke-width="2" aria-hidden="true" class="mt-px shrink-0" />{{ erroArquivo }}</p>

      <Transition name="abre">
        <div v-if="modo !== 'vazio'" class="campos">
          <div v-if="modo !== 'tema'" class="max-w-[520px] sm:col-span-2">
            <label class="rotulo" for="titulo-texto">Nome do texto</label>
            <input
              id="titulo-texto"
              v-model="titulo"
              class="campo"
              type="text"
              :maxlength="LIMITE_TITULO"
              :aria-invalid="!!erros.titulo || undefined"
              :aria-describedby="erros.titulo ? 'erro-titulo-texto' : 'ajuda-titulo-texto'"
              @input="erros.titulo = ''"
            >
            <p v-if="erros.titulo" id="erro-titulo-texto" class="erro-campo" role="alert"><CircleAlert :size="16" :stroke-width="2" aria-hidden="true" class="mt-px shrink-0" />{{ erros.titulo }}</p>
            <p v-else id="ajuda-titulo-texto" class="ajuda">Como você vai achar depois. Por exemplo: Resumo da aula de terça.</p>
          </div>
          <div>
            <label class="rotulo" for="materia-texto">Matéria</label>
            <Selecao id="materia-texto" v-model="materiaId" :opcoes="opcoesMateria" texto-vazio="Escolha a matéria" :invalido="!!erros.materia" :descrito="erros.materia ? 'erro-materia-texto' : undefined" @change="materiaTocada = true" />
            <p v-if="erros.materia" id="erro-materia-texto" class="erro-campo" role="alert"><CircleAlert :size="16" :stroke-width="2" aria-hidden="true" class="mt-px shrink-0" />{{ erros.materia }}</p>
          </div>
          <div>
            <label class="rotulo" for="assunto-texto">Assunto <span class="font-normal text-texto-3">(opcional)</span></label>
            <Selecao id="assunto-texto" v-model="assuntoId" :opcoes="opcoesAssunto" :desativado="!materia" />
          </div>
        </div>
      </Transition>

      <Transition name="abre">
        <div v-if="modo !== 'vazio'" class="mt-5 flex flex-wrap items-center gap-2.5">
          <button type="button" class="botao" @click="principal">
            <component :is="iconeBotao" :size="17" :stroke-width="2.1" aria-hidden="true" />{{ textoBotao }}
          </button>
          <button v-if="modo !== 'tema'" type="button" class="botao-fantasma botao-p h-10" :aria-expanded="maisOpcoes" aria-controls="mais-opcoes-texto" @click="maisOpcoes = !maisOpcoes">
            Mais opções<ChevronDown :size="16" :stroke-width="2" aria-hidden="true" class="transition-transform duration-300" :class="maisOpcoes && 'rotate-180'" />
          </button>
          <button type="button" class="link ml-1 text-[14px]" @click="limpar">Limpar</button>
        </div>
      </Transition>

      <Transition name="abre">
        <div v-if="maisOpcoes && modo !== 'tema' && modo !== 'vazio'" id="mais-opcoes-texto" class="mt-4 max-w-[520px]">
          <label class="rotulo" for="ia-texto">Serviços de IA que podem ler este texto</label>
          <Selecao id="ia-texto" v-model="ia" :opcoes="opcoesIa" @change="iaTocada = true" />
          <p class="ajuda">O padrão vem do seu perfil. Sem IA, as questões saem só do próprio texto.</p>
        </div>
      </Transition>

      <div v-if="temaBuscado && modo === 'tema'" class="mt-6 border-t border-borda pt-5">
        <FontesWiki :tema="temaBuscado" :materia-id="materiaId" :assunto-id="assuntoId" @importou="importou" @precisa-materia="erros.materia = 'Escolha a matéria do texto.'" />
        <MateriaisPedirTexto :tema="temaBuscado" :materia="materia" :assunto="nomeAssunto" @copiou="copiouPedido" />
      </div>
    </template>

    <!-- Enviando e lendo -->
    <div v-else-if="fase === 'enviando' || fase === 'lendo'" class="mt-5 max-w-[560px]" role="status" aria-live="polite">
      <p class="m-0 flex items-center gap-2.5 text-[15px] font-semibold">
        <span class="rodando text-acento" aria-hidden="true" />
        {{ fase === 'enviando' ? `Enviando ${progresso}%` : 'Lendo o texto. Leva alguns segundos.' }}
      </p>
      <div class="barra mt-3" :class="fase === 'lendo' && 'barra-lendo'"><i :style="{ width: fase === 'enviando' ? `${progresso}%` : '40%' }" /></div>
      <p class="m-0 mt-2 truncate text-[13.5px] text-texto-3">{{ titulo }}</p>
    </div>

    <!-- Confira rapidinho -->
    <div v-else-if="fase === 'conferir'" class="mt-5">
      <MateriaisConfiraRapido :material-id="novo.id" :titulo="novo.titulo" :unidade="novo.unidade" @aprovado="aprovado" />
      <button type="button" class="link mt-3 text-[14px]" @click="limpar">Conferir depois e adicionar outro</button>
    </div>

    <!-- Deu errado -->
    <div v-else class="mt-5 max-w-[620px]">
      <p class="erro-campo m-0 text-[15px]" role="alert"><CircleAlert :size="17" :stroke-width="2" aria-hidden="true" class="mt-0.5 shrink-0" />{{ falha }}</p>
      <div class="mt-4 flex flex-wrap gap-2.5">
        <button v-if="novo?.id" type="button" class="botao-secundario botao-p h-10" @click="tentarDeNovo">
          <RotateCcw :size="16" :stroke-width="2" aria-hidden="true" />Tentar ler de novo
        </button>
        <button type="button" class="botao-fantasma botao-p h-10" @click="limpar">Começar de novo</button>
      </div>
    </div>
  </section>
</template>

<style scoped>
.zona {
  position: relative;
  border: 1px solid var(--borda-campo);
  border-radius: 16px;
  background: var(--campo);
  transition: border-color 0.18s, box-shadow 0.18s, background-color 0.18s;
}
.zona:focus-within {
  border-color: var(--acento);
  box-shadow: 0 0 0 3px var(--acento-anel);
}
.zona[data-arrastando] {
  border-color: var(--acento);
  background: var(--acento-suave);
}
.entrada {
  display: block;
  width: 100%;
  min-height: 64px;
  max-height: 240px;
  padding: 14px 16px 6px;
  border: 0;
  background: transparent;
  color: var(--tinta);
  font: inherit;
  font-size: 16px;
  line-height: 1.5;
  resize: none;
  field-sizing: content;
  outline: none;
}
.barra-zona {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px 12px;
  padding: 6px 12px 8px;
}
.deteccao {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  margin-left: auto;
  font-size: 13px;
  font-weight: 600;
  color: var(--acento);
}
.solte {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  margin: 0;
  border-radius: inherit;
  background: color-mix(in oklab, var(--acento-suave) 92%, transparent);
  color: var(--acento);
  font-weight: 700;
  pointer-events: none;
}
.campos {
  display: grid;
  gap: 16px;
  max-width: 760px;
  margin-top: 18px;
}
@media (min-width: 640px) {
  .campos { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
.barra-lendo > i {
  animation: vai-e-volta 1.4s ease-in-out infinite;
}
@keyframes vai-e-volta {
  0% { transform: translateX(-100%); }
  100% { transform: translateX(260%); }
}
.aparece-rapido-enter-active,
.aparece-rapido-leave-active {
  transition: opacity 0.18s ease, transform 0.18s ease;
}
.aparece-rapido-enter-from,
.aparece-rapido-leave-to {
  opacity: 0;
  transform: translateY(3px);
}
@media (prefers-reduced-motion: reduce) {
  .barra-lendo > i { animation: none; }
  .zona { transition: none; }
}
:global(:root.menos-movimento) .barra-lendo > i {
  animation: none;
}
</style>
