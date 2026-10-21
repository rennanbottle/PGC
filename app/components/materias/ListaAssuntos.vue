<script setup>
// Assuntos de uma matéria: nome (abre a página do assunto), questões, estado e o atalho para gerar questões do assunto.
// Reordenar: arrastar pela alça (mouse ou dedo) ou, com a alça em foco, usar as setas. A nova ordem é avisada
// a leitores de tela. "Renomear" troca o nome ali mesmo (Enter salva, Esc cancela).
import { Archive, ArrowDown, ArrowUp, FolderInput, GripVertical, Pencil, Sparkles } from '@lucide/vue'
import { ESTADOS } from '#shared/regras/dominio.js'
import { LIMITES, TIPO_SELO_ESTADO, estadoDe, moverNaLista } from '#shared/regras/materias.js'

const props = defineProps({
  materiaId: { type: String, required: true },
  assuntos: { type: Array, required: true },
  estados: { type: Object, default: () => ({}) },
  questoes: { type: Object, default: () => ({}) },
  podeMover: { type: Boolean, default: true },
})
const emit = defineEmits(['reordenar', 'acao', 'renomear'])

const ordem = ref([])
watch(() => props.assuntos.map((a) => a.id).join(), () => {
  ordem.value = props.assuntos.map((a) => a.id)
}, { immediate: true })
const porId = computed(() => Object.fromEntries(props.assuntos.map((a) => [a.id, a])))
const visiveis = computed(() => ordem.value.map((id) => porId.value[id]).filter(Boolean))
const mostrarEstados = computed(() => props.assuntos.some((a) => estadoDe(a, props.estados) !== 'nao_iniciado'))
const nQuestoes = (a) => props.questoes[a.id]?.questoes ?? 0

function acoesDo(a, i) {
  return [
    { id: 'gerar', texto: 'Gerar questões deste assunto', icone: Sparkles },
    { id: 'renomear', texto: 'Renomear', icone: Pencil, separar: true },
    { id: 'subir', texto: 'Mover para cima', icone: ArrowUp, desativado: i <= 0 },
    { id: 'descer', texto: 'Mover para baixo', icone: ArrowDown, desativado: i >= visiveis.value.length - 1 },
    { id: 'mover', texto: 'Mover para outra matéria', icone: FolderInput, desativado: !props.podeMover },
    { id: 'arquivar', texto: 'Arquivar', icone: Archive },
    { id: 'excluir', texto: 'Excluir', perigo: true, separar: true },
  ]
}
function escolher(a, id) {
  if (id === 'gerar') return navigateTo(`/questoes/gerar?materia=${props.materiaId}&assunto=${a.id}`)
  if (id === 'renomear') return comecarRenomear(a)
  if (id === 'subir' || id === 'descer') return mover(a.id, id === 'subir' ? -1 : 1)
  emit('acao', { assunto: a, id })
}

// ---------- Renomear no lugar ----------
const renomeando = ref(null)
const nomeNovo = ref('')
const campo = ref(null)
function comecarRenomear(a) {
  renomeando.value = a.id
  nomeNovo.value = a.nome
  nextTick(() => {
    const el = Array.isArray(campo.value) ? campo.value[0] : campo.value
    el?.focus()
    el?.select()
  })
}
function terminarRenomear(salvar) {
  const id = renomeando.value
  if (!id) return
  renomeando.value = null
  const nome = nomeNovo.value.trim()
  if (salvar && nome && nome !== porId.value[id]?.nome) emit('renomear', { assunto: porId.value[id], nome: nome.slice(0, LIMITES.nomeAssunto) })
}

// ---------- Reordenar ----------
const lista = ref(null)
const raiz = () => lista.value?.$el ?? lista.value
const arrastando = ref(null)
const aviso = ref('')
function terminou() {
  if (ordem.value.join() !== props.assuntos.map((a) => a.id).join()) emit('reordenar', [...ordem.value])
}
function avisarPosicao(id) {
  aviso.value = `${porId.value[id]?.nome}: posição ${ordem.value.indexOf(id) + 1}/${ordem.value.length}.`
}
function mover(id, passo) {
  const nova = moverNaLista(ordem.value, id, passo)
  if (nova.join() === ordem.value.join()) return
  ordem.value = nova
  avisarPosicao(id)
  terminou()
}
function iniciar(evento, id) {
  if (evento.button !== 0) return
  arrastando.value = id
  evento.currentTarget.setPointerCapture(evento.pointerId)
}
function arrastar(evento) {
  if (!arrastando.value) return
  const outras = [...raiz().querySelectorAll('[data-assunto]')].filter((l) => l.dataset.assunto !== arrastando.value)
  const posicao = outras.filter((l) => {
    const r = l.getBoundingClientRect()
    return r.top + r.height / 2 < evento.clientY
  }).length
  const nova = ordem.value.filter((id) => id !== arrastando.value)
  nova.splice(posicao, 0, arrastando.value)
  if (nova.join() !== ordem.value.join()) ordem.value = nova
}
function soltar() {
  if (!arrastando.value) return
  const id = arrastando.value
  arrastando.value = null
  avisarPosicao(id)
  terminou()
}
function teclado(evento, id) {
  const passo = { ArrowUp: -1, ArrowDown: 1 }[evento.key]
  if (!passo) return
  evento.preventDefault()
  mover(id, passo)
  nextTick(() => raiz()?.querySelector(`[data-assunto="${id}"] .alca`)?.focus())
}
</script>

<template>
  <div>
    <TransitionGroup ref="lista" name="lista" tag="ul" class="m-0 list-none p-0">
      <li
        v-for="(a, i) in visiveis"
        :id="`assunto-${a.id}`"
        :key="a.id"
        class="linha-assunto assunto"
        :class="{ arrastando: arrastando === a.id }"
        :data-assunto="a.id"
      >
        <button
          type="button"
          class="alca"
          :aria-label="`Mover ${a.nome}. Use as setas para cima e para baixo.`"
          @pointerdown="iniciar($event, a.id)"
          @pointermove="arrastar"
          @pointerup="soltar"
          @pointercancel="soltar"
          @keydown="teclado($event, a.id)"
        >
          <GripVertical :size="17" :stroke-width="2" aria-hidden="true" />
        </button>

        <div class="nome min-w-0">
          <input
            v-if="renomeando === a.id"
            ref="campo"
            v-model="nomeNovo"
            class="texto-inline font-semibold"
            :maxlength="LIMITES.nomeAssunto"
            :aria-label="`Novo nome de ${a.nome}`"
            @keydown.enter.prevent="terminarRenomear(true)"
            @keydown.esc.prevent.stop="terminarRenomear(false)"
            @blur="terminarRenomear(true)"
          >
          <NuxtLink v-else :to="`/assuntos/${a.id}`" class="nome-assunto block truncate text-[15.5px] font-semibold text-tinta no-underline">{{ a.nome }}</NuxtLink>
        </div>

        <span class="contagem text-[13.5px]" :class="nQuestoes(a) ? 'text-texto-2' : 'text-texto-3'">
          {{ nQuestoes(a) ? `${nQuestoes(a)} ${nQuestoes(a) === 1 ? 'questão' : 'questões'}` : 'Sem questões' }}
        </span>
        <span v-if="mostrarEstados" class="estado">
          <span class="selo" :data-tipo="TIPO_SELO_ESTADO[estadoDe(a, estados)] || undefined">{{ ESTADOS[estadoDe(a, estados)] }}</span>
        </span>

        <div class="acoes flex items-center gap-0.5">
          <NuxtLink
            :to="`/questoes/gerar?materia=${materiaId}&assunto=${a.id}`"
            class="botao-icone pequeno text-texto-2 hover:text-acento"
            :aria-label="`Gerar questões de ${a.nome}`"
            data-dica="Gerar questões deste assunto"
            data-dica-lado="esquerda"
          >
            <Sparkles :size="17" :stroke-width="2" aria-hidden="true" />
          </NuxtLink>
          <MenuAcoes :rotulo="`Ações de ${a.nome}`" :itens="acoesDo(a, i)" @escolher="escolher(a, $event)" />
        </div>
      </li>
    </TransitionGroup>
    <p class="so-leitor" aria-live="polite">{{ aviso }}</p>
  </div>
</template>

<style scoped>
.assunto {
  display: grid;
  grid-template-columns: 28px max-content minmax(0, 1fr) auto;
  grid-template-areas: 'alca nome nome acoes' 'alca contagem estado acoes';
  align-items: center;
  column-gap: 8px;
  row-gap: 4px;
  min-height: 56px;
  padding: 8px 12px 8px 10px;
  border-top: 1px solid var(--borda);
}
.assunto:first-child {
  border-top: 0;
}
.alca { grid-area: alca; }
.nome { grid-area: nome; }
.contagem { grid-area: contagem; }
.estado { grid-area: estado; margin-left: 10px; }
.acoes { grid-area: acoes; }
@media (min-width: 640px) {
  .assunto {
    grid-template-columns: 28px minmax(0, 1fr) 104px 178px auto;
    grid-template-areas: 'alca nome contagem estado acoes';
    padding: 6px 14px 6px 12px;
  }
  .estado {
    margin-left: 0;
  }
}
.assunto:hover {
  background: var(--folha-2);
}
.alca {
  display: grid;
  place-items: center;
  width: 28px;
  height: 36px;
  padding: 0;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: var(--texto-3);
  cursor: grab;
  touch-action: none;
  opacity: 0.55;
  transition: opacity 0.15s, color 0.15s;
}
.assunto:hover .alca,
.alca:focus-visible {
  opacity: 1;
  color: var(--texto-2);
}
.alca:active {
  cursor: grabbing;
}
.nome-assunto:hover {
  color: var(--acento);
  text-decoration: underline;
  text-underline-offset: 3px;
}
</style>
