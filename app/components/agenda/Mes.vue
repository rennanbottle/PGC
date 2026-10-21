<script setup>
// Calendário do mês, semanas de domingo a sábado. Cada dia mostra os itens (ícone do tipo e título curto), quantas
// questões voltam para revisão e se houve estudo. Dia de prova ganha a cor e o nome da matéria. Hoje fica marcado.
// Teclado: setas andam um dia ou uma semana, Home e End vão ao começo e ao fim da semana, Page Up e Page Down
// trocam de mês. O dia com foco é o escolhido (o painel ao lado mostra tudo dele).
import { CircleCheck, RotateCcw } from '@lucide/vue'
import { NOMES_SEMANA, rotuloCurto, diaDaSemana, diaPorExtenso, gradeDoMes, mesDoDia, nomeDoMes, somarDias, somarMeses, ultimoDiaDoMes } from '#shared/regras/agenda.js'

const props = defineProps({
  mes: { type: String, required: true },
  hoje: { type: String, required: true },
  selecionado: { type: String, required: true },
  eventos: { type: Object, default: () => ({}) },
  revisoes: { type: Object, default: () => ({}) },
  estudos: { type: Object, default: () => ({}) },
  materias: { type: Object, default: () => ({}) },
  direcao: { type: Number, default: 1 },
})
const emit = defineEmits(['escolher'])
const grade = ref(null)
const comFoco = ref(false)

const dias = computed(() => gradeDoMes(props.mes))
const semanas = computed(() => Array.from({ length: dias.value.length / 7 }, (_, i) => dias.value.slice(i * 7, i * 7 + 7)))
const focavel = computed(() => (mesDoDia(props.selecionado) === props.mes ? props.selecionado : `${props.mes}-01`))
const MAXIMO = 3
const visiveis = (d) => [...(props.eventos[d] ?? [])].sort((a, b) => Number(b.tipo === 'prova') - Number(a.tipo === 'prova')).slice(0, MAXIMO)
const restantes = (d) => Math.max(0, (props.eventos[d]?.length ?? 0) - MAXIMO)
const prova = (d) => (props.eventos[d] ?? []).find((e) => e.tipo === 'prova')
const cor = (e) => (props.materias[e?.materia_id] ? `${corMateria(props.materias[e.materia_id].cor)}` : 'var(--color-acento)')

function rotulo(d) {
  const lista = props.eventos[d] ?? []
  const partes = [diaPorExtenso(d)]
  if (d === props.hoje) partes.push('hoje')
  const p = prova(d)
  if (p) partes.push(`prova${props.materias[p.materia_id] ? ` de ${props.materias[p.materia_id].nome}` : ''}: ${p.titulo}`)
  const outros = lista.filter((e) => e !== p).map((e) => e.titulo)
  if (outros.length) partes.push(outros.join(', '))
  const r = props.revisoes[d]?.total
  if (r) partes.push(`${r} ${r === 1 ? 'questão' : 'questões'} para revisar`)
  if (props.estudos[d]?.length) partes.push('estudou neste dia')
  return partes.join('. ')
}

function focar() {
  nextTick(() => grade.value?.querySelector(`[data-dia="${props.selecionado}"]`)?.focus())
}
function teclar(ev) {
  const atual = props.selecionado
  const passos = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 }
  let alvo = null
  if (ev.key in passos) alvo = somarDias(atual, passos[ev.key])
  else if (ev.key === 'Home') alvo = somarDias(atual, -diaDaSemana(atual))
  else if (ev.key === 'End') alvo = somarDias(atual, 6 - diaDaSemana(atual))
  else if (ev.key === 'PageUp' || ev.key === 'PageDown') {
    const mes = somarMeses(mesDoDia(atual), ev.key === 'PageUp' ? -1 : 1)
    const dia = Math.min(Number(atual.slice(8)), Number(ultimoDiaDoMes(mes).slice(8)))
    alvo = `${mes}-${String(dia).padStart(2, '0')}`
  }
  if (!alvo) return
  ev.preventDefault()
  comFoco.value = true
  emit('escolher', alvo)
  focar()
}
// Depois da troca de mês pelo teclado, o foco volta para o dia escolhido na grade nova.
function aposEntrar() {
  if (comFoco.value) focar()
}
</script>

<template>
  <div ref="grade" role="grid" :aria-label="`Calendário de ${nomeDoMes(mes)}`" class="ag-mes" @keydown="teclar" @focusout="comFoco = false">
    <div role="row" class="grid grid-cols-7 pb-1.5">
      <span v-for="n in NOMES_SEMANA" :key="n" role="columnheader" class="px-2 text-[12.5px] font-semibold text-texto-3">{{ n }}</span>
    </div>
    <Transition :name="direcao < 0 ? 'ag-volta' : 'ag-avanca'" mode="out-in" @after-enter="aposEntrar">
      <div :key="mes" role="rowgroup" class="ag-semanas">
        <div v-for="(s, i) in semanas" :key="i" role="row" class="grid grid-cols-7">
          <div v-for="d in s" :key="d" role="gridcell" :aria-selected="d === selecionado" class="min-w-0">
            <button
              type="button"
              class="ag-dia"
              :class="[mesDoDia(d) !== mes && 'ag-fora', d === selecionado && 'ag-escolhido', prova(d) && 'ag-tem-prova', d < hoje && 'ag-passado']"
              :style="prova(d) ? { '--ag-cor': cor(prova(d)) } : undefined"
              :data-dia="d"
              :tabindex="d === focavel ? 0 : -1"
              :aria-label="rotulo(d)"
              :aria-current="d === hoje ? 'date' : undefined"
              @click="emit('escolher', d)"
            >
              <span class="flex items-center gap-1">
                <span class="ag-numero" :class="d === hoje && 'ag-hoje'">{{ Number(d.slice(8)) }}</span>
                <CircleCheck v-if="estudos[d]?.length" :size="13" :stroke-width="2.4" aria-hidden="true" class="text-ok" />
                <span v-if="revisoes[d]?.total" class="ag-rev" aria-hidden="true"><RotateCcw :size="11" :stroke-width="2.4" />{{ revisoes[d].total }}</span>
              </span>
              <span class="ag-pilulas" aria-hidden="true">
                <span v-for="e in visiveis(d)" :key="e.id" class="ag-pilula" :class="[e.tipo === 'prova' && 'ag-pilula-prova', e.concluido_em && 'ag-pilula-feita']" :style="{ '--ag-cor': cor(e) }">
                  <AgendaIconeTipo :tipo="e.tipo" :tamanho="12" />
                  <span class="truncate">{{ rotuloCurto(e, materias[e.materia_id]?.nome) }}</span>
                </span>
                <span v-if="restantes(d)" class="px-1.5 text-[11.5px] font-semibold text-texto-2">+{{ restantes(d) }}</span>
              </span>
              <span class="ag-pontos" aria-hidden="true">
                <i v-for="e in (eventos[d] ?? []).slice(0, 4)" :key="e.id" :style="{ background: e.tipo === 'prova' || e.materia_id ? cor(e) : 'var(--color-texto-3)' }" />
              </span>
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>

<style>
.ag-mes { --ag-borda: var(--color-borda); }
.ag-semanas { overflow: hidden; border: 1px solid var(--ag-borda); border-radius: 16px; }
.ag-semanas > [role='row'] + [role='row'] { border-top: 1px solid var(--ag-borda); }
.ag-semanas [role='gridcell'] + [role='gridcell'] { border-left: 1px solid var(--ag-borda); }
.ag-dia { position: relative; display: flex; width: 100%; min-height: 112px; flex-direction: column; gap: 6px; padding: 7px 6px 8px; border: 0; background: var(--color-folha); color: var(--color-tinta); font: inherit; text-align: left; cursor: pointer; transition: background-color 0.15s ease; }
.ag-dia:hover { background: var(--color-folha-2); }
.ag-dia:focus-visible { z-index: 1; outline: 2px solid var(--color-acento); outline-offset: -2px; }
.ag-dia.ag-fora { background: var(--color-mesa); }
.ag-dia.ag-fora .ag-numero { color: var(--color-texto-3); }
.ag-dia.ag-escolhido { background: var(--color-acento-suave); box-shadow: inset 0 0 0 2px var(--color-acento); }
.ag-dia.ag-tem-prova::before { content: ''; position: absolute; inset: 0 0 auto; height: 4px; background: var(--ag-cor); }
.ag-dia.ag-tem-prova:not(.ag-escolhido) { background: color-mix(in oklab, var(--ag-cor) 7%, var(--color-folha)); }
.ag-numero { display: grid; min-width: 26px; height: 26px; place-items: center; padding: 0 4px; border-radius: 99px; font-family: var(--font-titulo); font-size: 14.5px; font-weight: 600; font-variant-numeric: tabular-nums; }
.ag-numero.ag-hoje { background: var(--color-acento); color: var(--color-folha); }
.ag-passado .ag-numero:not(.ag-hoje) { color: var(--color-texto-2); }
.ag-rev { display: inline-flex; align-items: center; gap: 3px; margin-left: auto; padding: 1px 6px; border-radius: 99px; background: var(--color-folha-2); color: var(--color-texto-2); font-size: 11.5px; font-weight: 600; font-variant-numeric: tabular-nums; }
.ag-pilulas { display: flex; min-width: 0; flex-direction: column; gap: 3px; }
.ag-pilula { display: flex; min-width: 0; align-items: center; gap: 4px; padding: 2px 6px; border-radius: 8px; background: var(--color-folha-2); color: var(--color-tinta); font-size: 12px; font-weight: 500; line-height: 1.35; }
.ag-pilula > svg { color: var(--color-texto-2); }
.ag-pilula-prova { background: color-mix(in oklab, var(--ag-cor) 18%, var(--color-folha)); font-weight: 700; }
.ag-pilula-prova > svg { color: var(--ag-cor); }
.ag-pilula-feita { color: var(--color-texto-3); text-decoration: line-through; }
.ag-pontos { display: none; gap: 3px; }
.ag-pontos i { width: 6px; height: 6px; border-radius: 50%; }
@media (max-width: 767px) {
  .ag-dia { min-height: 58px; align-items: center; gap: 4px; padding: 5px 2px; }
  .ag-dia > span:first-child { flex-direction: column; }
  .ag-rev, .ag-pilulas, .ag-dia .lucide-circle-check, .ag-dia svg.text-ok { display: none; }
  .ag-pontos { display: flex; }
}
.ag-avanca-enter-active, .ag-avanca-leave-active, .ag-volta-enter-active, .ag-volta-leave-active { transition: transform 0.2s ease, opacity 0.2s ease; }
.ag-avanca-enter-from, .ag-volta-leave-to { transform: translateX(28px); opacity: 0; }
.ag-avanca-leave-to, .ag-volta-enter-from { transform: translateX(-28px); opacity: 0; }
@media (prefers-reduced-motion: reduce) {
  .ag-avanca-enter-active, .ag-avanca-leave-active, .ag-volta-enter-active, .ag-volta-leave-active { transition: none; }
}
:root.menos-movimento :is(.ag-avanca-enter-active, .ag-avanca-leave-active, .ag-volta-enter-active, .ag-volta-leave-active) { transition: none; }
</style>
