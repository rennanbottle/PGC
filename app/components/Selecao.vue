<script setup>
// Lista de escolha do PGC, no lugar do <select> do navegador (que abria uma lista azul, sem estilo).
// Uma escolha (padrão) ou várias (multiplo). Com muitas opções, mostra uma busca no topo da lista.
// Opção: { valor, texto, descricao?, icone? (componente do Lucide), cor? (cor da bolinha, ex. 'var(--marca-azul)'),
//          desativado?, grupo? (opções seguidas do mesmo grupo ganham um título) }
// Teclado: setas andam, Home e End vão às pontas, Enter ou Espaço escolhem, Esc fecha, letras pulam para a opção.
// Uso:
//   <label class="rotulo" for="area">Área</label>
//   <Selecao id="area" v-model="area" :opcoes="AREAS" />
//   <Selecao v-model="filtro" variante="filtro" prefixo="Matéria" :opcoes="[{ valor: '', texto: 'Todas' }, ...]" />
import { Check, ChevronDown, Search } from '@lucide/vue'

const modelo = defineModel({ type: [String, Number, Boolean, Array, null], default: null })
const props = defineProps({
  opcoes: { type: Array, required: true },
  id: { type: String, default: undefined },
  // Nome para leitores de tela quando não existe um <label for="id">.
  rotulo: { type: String, default: undefined },
  multiplo: { type: Boolean, default: false },
  // 'auto' mostra a busca com mais de 8 opções.
  busca: { type: [Boolean, String], default: 'auto' },
  // 'campo' tem a altura dos campos; 'filtro' é compacta, com o prefixo ("Matéria: Todas").
  variante: { type: String, default: 'campo' },
  prefixo: { type: String, default: '' },
  textoVazio: { type: String, default: 'Nenhuma' },
  desativado: { type: Boolean, default: false },
  invalido: { type: Boolean, default: false },
  descrito: { type: String, default: undefined },
  larguraLista: { type: Number, default: 0 },
  // Filtro: diz quando o valor escolhido conta como "filtro ligado" (fica azul). Padrão: valor diferente de ''.
  ativoQuando: { type: Function, default: null },
})
const emit = defineEmits(['change'])

const aberto = ref(false)
const ativa = ref(-1)
const termo = ref('')
const botao = ref(null)
const lista = ref(null)
const ul = ref(null)
const caixaBusca = ref(null)
const destino = ref('body')
const posicao = ref({ left: 0, width: 0, top: 0, bottom: undefined, acima: false, maxHeight: 340 })
const idBase = useId()
const idLista = `${idBase}-lista`
const idOpcao = (i) => `${idBase}-op-${i}`

const normalizar = (t) => String(t ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
const mostrarBusca = computed(() => props.busca === true || (props.busca === 'auto' && props.opcoes.length > 8))
const filtradas = computed(() => {
  const t = normalizar(termo.value.trim())
  if (!t) return props.opcoes
  return props.opcoes.filter((o) => normalizar(o.texto).includes(t) || normalizar(o.descricao).includes(t))
})
// Linhas da lista: cabeçalho de grupo sempre que o grupo muda.
const linhas = computed(() => {
  const saida = []
  let grupo = null
  filtradas.value.forEach((o, i) => {
    if (o.grupo && o.grupo !== grupo) {
      grupo = o.grupo
      saida.push({ tipo: 'grupo', texto: o.grupo, chave: `g-${o.grupo}-${i}` })
    }
    saida.push({ tipo: 'opcao', opcao: o, indice: i, chave: `o-${String(o.valor)}-${i}` })
  })
  return saida
})

const valores = computed(() => (props.multiplo ? (Array.isArray(modelo.value) ? modelo.value : []) : [modelo.value]))
const escolhida = (o) => valores.value.some((v) => v === o.valor)
const opcaoAtual = computed(() => (props.multiplo ? null : (props.opcoes.find((o) => o.valor === modelo.value) ?? null)))
const textoBotao = computed(() => {
  if (!props.multiplo) return opcaoAtual.value?.texto ?? props.textoVazio
  const nomes = props.opcoes.filter((o) => escolhida(o)).map((o) => o.texto)
  if (!nomes.length) return props.textoVazio
  if (nomes.length <= 2) return nomes.join(', ')
  return `${nomes.slice(0, 2).join(', ')} e mais ${nomes.length - 2}`
})
const filtroLigado = computed(() => {
  if (props.variante !== 'filtro') return false
  if (props.ativoQuando) return props.ativoQuando(modelo.value)
  if (props.multiplo) return valores.value.length > 0
  return modelo.value !== '' && modelo.value !== null && modelo.value !== undefined && modelo.value !== false
})

function posicionar() {
  const r = botao.value?.getBoundingClientRect()
  if (!r) return
  const alturaLista = Math.min(340, (lista.value?.scrollHeight ?? 300) + 2)
  const abaixo = window.innerHeight - r.bottom - 12
  const acima = r.top - 12
  const paraCima = abaixo < Math.min(alturaLista, 240) && acima > abaixo
  const largura = Math.min(window.innerWidth - 16, Math.max(r.width, props.larguraLista || 0, props.variante === 'filtro' ? 230 : 0))
  posicao.value = {
    left: Math.min(Math.max(8, r.left), window.innerWidth - largura - 8),
    width: largura,
    top: paraCima ? undefined : r.bottom + 6,
    bottom: paraCima ? window.innerHeight - r.top + 6 : undefined,
    acima: paraCima,
    maxHeight: Math.max(160, Math.min(340, paraCima ? acima : abaixo)),
  }
}

function proximaValida(de, passo) {
  const n = filtradas.value.length
  if (!n) return -1
  let i = de
  for (let k = 0; k < n; k++) {
    i = (i + passo + n) % n
    if (!filtradas.value[i].desativado) return i
  }
  return -1
}

function rolarAteAtiva() {
  nextTick(() => document.getElementById(idOpcao(ativa.value))?.scrollIntoView({ block: 'nearest' }))
}

function abrir() {
  if (props.desativado || aberto.value) return
  termo.value = ''
  const dialogo = botao.value?.closest('dialog')
  destino.value = dialogo ?? 'body'
  const atual = props.opcoes.findIndex((o) => escolhida(o))
  ativa.value = atual >= 0 ? atual : proximaValida(-1, 1)
  aberto.value = true
  nextTick(() => {
    posicionar()
    if (mostrarBusca.value) caixaBusca.value?.focus()
    else ul.value?.focus()
    rolarAteAtiva()
  })
}

function fechar(devolverFoco = true) {
  if (!aberto.value) return
  aberto.value = false
  if (devolverFoco) nextTick(() => botao.value?.focus())
}

function escolher(o) {
  if (!o || o.desativado) return
  if (props.multiplo) {
    const atual = valores.value
    modelo.value = atual.includes(o.valor) ? atual.filter((v) => v !== o.valor) : [...atual, o.valor]
    emit('change', modelo.value)
    return
  }
  modelo.value = o.valor
  emit('change', o.valor)
  fechar()
}

let digitado = ''
let relogio = null
function pularPorLetra(tecla) {
  digitado += normalizar(tecla)
  clearTimeout(relogio)
  relogio = setTimeout(() => (digitado = ''), 650)
  const lista = filtradas.value
  const inicio = digitado.length === 1 ? ativa.value + 1 : ativa.value
  for (let k = 0; k < lista.length; k++) {
    const i = (inicio + k) % lista.length
    if (!lista[i].desativado && normalizar(lista[i].texto).startsWith(digitado)) {
      ativa.value = i
      rolarAteAtiva()
      return
    }
  }
}

function tecladoBotao(evento) {
  if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(evento.key)) {
    evento.preventDefault()
    abrir()
  }
}

function tecladoLista(evento) {
  const naBusca = evento.target === caixaBusca.value
  switch (evento.key) {
    case 'ArrowDown':
      evento.preventDefault()
      ativa.value = proximaValida(ativa.value, 1)
      rolarAteAtiva()
      break
    case 'ArrowUp':
      evento.preventDefault()
      ativa.value = proximaValida(ativa.value, -1)
      rolarAteAtiva()
      break
    case 'Home':
      if (naBusca) return
      evento.preventDefault()
      ativa.value = proximaValida(-1, 1)
      rolarAteAtiva()
      break
    case 'End':
      if (naBusca) return
      evento.preventDefault()
      ativa.value = proximaValida(filtradas.value.length, -1)
      rolarAteAtiva()
      break
    case 'Enter':
      evento.preventDefault()
      escolher(filtradas.value[ativa.value])
      break
    case ' ':
      if (naBusca) return
      evento.preventDefault()
      escolher(filtradas.value[ativa.value])
      break
    case 'Escape':
      evento.preventDefault()
      evento.stopPropagation()
      fechar()
      break
    case 'Tab':
      fechar(false)
      break
    default:
      if (!naBusca && evento.key.length === 1 && !evento.ctrlKey && !evento.metaKey && !evento.altKey) pularPorLetra(evento.key)
  }
}

watch(termo, () => {
  ativa.value = proximaValida(-1, 1)
  nextTick(posicionar)
})

function cliqueFora(evento) {
  if (!aberto.value) return
  if (botao.value?.contains(evento.target) || lista.value?.contains(evento.target)) return
  fechar(false)
}
function aoRolar(evento) {
  if (aberto.value && !lista.value?.contains(evento.target)) posicionar()
}
onMounted(() => {
  document.addEventListener('pointerdown', cliqueFora)
  window.addEventListener('resize', posicionar)
  window.addEventListener('scroll', aoRolar, true)
})
onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', cliqueFora)
  window.removeEventListener('resize', posicionar)
  window.removeEventListener('scroll', aoRolar, true)
  clearTimeout(relogio)
})

defineExpose({ abrir, fechar })
</script>

<template>
  <div class="relative" :class="variante === 'filtro' ? 'inline-block' : 'block'">
    <button
      :id="id"
      ref="botao"
      type="button"
      class="selecao-botao"
      :class="variante === 'filtro' && 'filtro-compacto'"
      :data-ativo="filtroLigado || undefined"
      :disabled="desativado"
      :aria-label="rotulo"
      aria-haspopup="listbox"
      :aria-expanded="aberto"
      :aria-controls="aberto ? idLista : undefined"
      :aria-invalid="invalido || undefined"
      :aria-describedby="descrito"
      @click="aberto ? fechar() : abrir()"
      @keydown="tecladoBotao"
    >
      <span v-if="prefixo" class="prefixo">{{ prefixo }}:</span>
      <span v-if="opcaoAtual?.cor" class="ponto-cor" :style="{ background: opcaoAtual.cor }" aria-hidden="true" />
      <component :is="opcaoAtual.icone" v-else-if="opcaoAtual?.icone" :size="17" :stroke-width="2" class="shrink-0 text-texto-2" aria-hidden="true" />
      <span class="min-w-0 truncate" :class="!multiplo && !opcaoAtual && variante !== 'filtro' && 'text-texto-3'">{{ textoBotao }}</span>
      <ChevronDown :size="variante === 'filtro' ? 15 : 17" :stroke-width="2.2" class="seta" aria-hidden="true" />
    </button>

    <Teleport v-if="aberto" :to="destino">
      <div
        ref="lista"
        class="selecao-lista"
        :data-acima="posicao.acima || undefined"
        :style="{
          left: `${posicao.left}px`,
          width: `${posicao.width}px`,
          top: posicao.top !== undefined ? `${posicao.top}px` : 'auto',
          bottom: posicao.bottom !== undefined ? `${posicao.bottom}px` : 'auto',
          maxHeight: `${posicao.maxHeight}px`,
        }"
        @keydown="tecladoLista"
      >
        <label v-if="mostrarBusca" class="campo-icone mb-1.5 shrink-0">
          <Search :size="16" :stroke-width="2" aria-hidden="true" />
          <input
            ref="caixaBusca"
            v-model="termo"
            class="campo campo-p"
            type="search"
            autocomplete="off"
            aria-label="Buscar na lista"
            :aria-controls="idLista"
            :aria-activedescendant="ativa >= 0 ? idOpcao(ativa) : undefined"
          >
        </label>
        <ul
          :id="idLista"
          ref="ul"
          role="listbox"
          tabindex="-1"
          class="outline-none"
          :aria-multiselectable="multiplo || undefined"
          :aria-label="rotulo || prefixo || 'Opções'"
          :aria-activedescendant="ativa >= 0 ? idOpcao(ativa) : undefined"
        >
          <template v-for="(l, n) in linhas" :key="l.chave">
            <li v-if="l.tipo === 'grupo'" role="presentation" class="selecao-grupo">{{ l.texto }}</li>
            <li
              v-else
              :id="idOpcao(l.indice)"
              role="option"
              class="selecao-opcao"
              :style="{ animationDelay: `${Math.min(n, 10) * 14}ms` }"
              :aria-selected="escolhida(l.opcao)"
              :aria-disabled="l.opcao.desativado || undefined"
              :data-ativa="ativa === l.indice || undefined"
              @pointermove="ativa = l.indice"
              @click="escolher(l.opcao)"
            >
              <input v-if="multiplo" type="checkbox" class="marcar pointer-events-none mt-px" tabindex="-1" :checked="escolhida(l.opcao)" aria-hidden="true">
              <span v-if="l.opcao.cor" class="ponto-cor mt-1" :style="{ background: l.opcao.cor }" aria-hidden="true" />
              <component :is="l.opcao.icone" v-else-if="l.opcao.icone" :size="17" :stroke-width="2" class="mt-px shrink-0 text-texto-2" aria-hidden="true" />
              <span class="min-w-0 flex-1">
                {{ l.opcao.texto }}
                <span v-if="l.opcao.descricao" class="descricao">{{ l.opcao.descricao }}</span>
              </span>
              <Check v-if="!multiplo && escolhida(l.opcao)" :size="17" :stroke-width="2.4" class="mt-px shrink-0" aria-hidden="true" />
            </li>
          </template>
          <li v-if="!filtradas.length" role="presentation" class="px-3 py-4 text-center text-[14px] text-texto-3">Nada com "{{ termo }}".</li>
        </ul>
      </div>
    </Teleport>
  </div>
</template>
