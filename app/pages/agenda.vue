<script setup>
// Agenda: provas, trabalhos, tarefas e estudos num calendário, com as questões que voltam para revisão em cada dia.
// Três jeitos de ver: Mês (padrão no computador), Semana e Lista (padrão no celular). Ao lado, a próxima prova com a
// contagem e o plano de estudo, as metas (do dia, da semana e com data) e o dia escolhido com tudo dele.
// "?meta=nova" já abre a janela de nova meta.
// "?dia=AAAA-MM-DD" escolhe o dia; "?novo=prova" (ou outro tipo) já abre a janela de novo item.
import { ChevronLeft, ChevronRight, Columns3, LayoutGrid, List } from '@lucide/vue'
import {
  NOME_TIPO, agruparPorDia, diaCurto, diaDeHoje, diasDaSemana, diferencaDias, ehDia, gradeDoMes, inicioDaSemana,
  mesDoDia, nomeDoMes, progressoDoPlano, proximaProva, somarDias, somarMeses,
} from '#shared/regras/agenda.js'

useHead({ title: 'Agenda | PGC' })
const route = useRoute()
const api = useAgenda()
await api.pronto
const eventos = api.data
const { data: materias } = useMaterias()
const { avisar } = useAvisos()
const janelaEvento = ref(null)
const janelaPlano = ref(null)
const janelaMeta = ref(null)

const hoje = diaDeHoje()
const selecionado = ref(typeof route.query.dia === 'string' && ehDia(route.query.dia) ? route.query.dia : hoje)
const mes = ref(mesDoDia(selecionado.value))
const direcao = ref(1)
const VISOES = [
  { id: 'mes', nome: 'Mês', icone: LayoutGrid },
  { id: 'semana', nome: 'Semana', icone: Columns3 },
  { id: 'lista', nome: 'Lista', icone: List },
]
const visao = ref('mes')
const telaGrande = ref(true)
const indiceVisao = computed(() => VISOES.findIndex((v) => v.id === visao.value))

let consultaTela = null
const aoMudarTela = (e) => { telaGrande.value = e.matches }
onMounted(() => {
  consultaTela = window.matchMedia('(min-width: 1024px)')
  telaGrande.value = consultaTela.matches
  consultaTela.addEventListener?.('change', aoMudarTela)
  let salva = null
  try {
    salva = localStorage.getItem('pgc-agenda-visao')
  }
  catch {}
  visao.value = VISOES.some((v) => v.id === salva) ? salva : (telaGrande.value ? 'mes' : 'lista')
  if (route.query.meta === 'nova') janelaMeta.value?.abrir()
  if (typeof route.query.novo === 'string') janelaEvento.value?.abrir({ dia: selecionado.value, tipo: NOME_TIPO[route.query.novo] ? route.query.novo : 'prova' })
})
onBeforeUnmount(() => consultaTela?.removeEventListener?.('change', aoMudarTela))
function trocarVisao(id) {
  visao.value = id
  try {
    localStorage.setItem('pgc-agenda-visao', id)
  }
  catch {}
}
function setasVisao(ev) {
  const passo = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[ev.key]
  if (!passo) return
  ev.preventDefault()
  const proxima = VISOES[(indiceVisao.value + passo + VISOES.length) % VISOES.length]
  trocarVisao(proxima.id)
  nextTick(() => ev.currentTarget?.querySelector?.('[aria-checked="true"]')?.focus())
}

const porDia = computed(() => agruparPorDia(eventos.value ?? []))
const materiasPorId = computed(() => Object.fromEntries((materias.value ?? []).map((m) => [m.id, m])))
const periodo = computed(() => {
  if (visao.value === 'mes') {
    const grade = gradeDoMes(mes.value)
    return { inicio: grade[0], fim: grade.at(-1) }
  }
  const inicio = inicioDaSemana(selecionado.value)
  return { inicio, fim: somarDias(inicio, visao.value === 'semana' ? 6 : 34) }
})
const { data: revisoes } = useRevisoesDaAgenda(periodo)
const { data: estudos } = useEstudosDaAgenda(periodo)

const prova = computed(() => proximaProva(eventos.value ?? [], hoje))
const progresso = computed(() => (prova.value ? progressoDoPlano(eventos.value ?? [], prova.value.id) : null))
const vazia = computed(() => !(eventos.value ?? []).length)
const descricao = computed(() => {
  const partes = []
  if (prova.value) {
    const n = diferencaDias(hoje, prova.value.data)
    partes.push(n === 0 ? `${prova.value.titulo} é hoje.` : `${prova.value.titulo} ${n === 1 ? 'amanhã' : `em ${n} dias`}.`)
  }
  const r = revisoes.value?.[hoje]?.total
  if (r) partes.push(`${r} ${r === 1 ? 'questão volta' : 'questões voltam'} para revisão hoje.`)
  return partes.join(' ') || 'Provas, tarefas e as revisões de cada dia, num lugar só.'
})

const tituloPeriodo = computed(() => {
  if (visao.value === 'mes') return nomeDoMes(mes.value)
  const semana = diasDaSemana(selecionado.value)
  const [a, b] = [semana[0], semana[6]]
  if (mesDoDia(a) === mesDoDia(b)) return `${Number(a.slice(8))} a ${Number(b.slice(8))} de ${nomeDoMes(mesDoDia(a)).split(' de ')[0].toLowerCase()}`
  return `${diaCurto(a)} a ${diaCurto(b)}`
})
const diasDaLista = computed(() => {
  const lista = []
  for (let i = 0; i < 28; i++) {
    const d = somarDias(selecionado.value, i)
    if (d === selecionado.value || d === hoje || porDia.value[d]?.length || revisoes.value?.[d]?.total) lista.push(d)
  }
  return lista
})

function escolher(dia) {
  const novoMes = mesDoDia(dia)
  if (novoMes !== mes.value) {
    direcao.value = novoMes > mes.value ? 1 : -1
    mes.value = novoMes
  }
  selecionado.value = dia
}
function andar(n) {
  if (visao.value !== 'mes') return escolher(somarDias(selecionado.value, 7 * n))
  direcao.value = n
  mes.value = somarMeses(mes.value, n)
  selecionado.value = mes.value === mesDoDia(hoje) ? hoje : `${mes.value}-01`
}

const novo = (dia = selecionado.value, tipo = null) => janelaEvento.value?.abrir({ dia, tipo })
const editar = (evento) => janelaEvento.value?.abrir({ evento })
const abrirPlano = (p) => janelaPlano.value?.abrir(p)

async function concluir(evento, sim) {
  try {
    await api.concluir(evento, sim)
    if (sim) avisar({ texto: 'Marcado como feito.', tipo: 'ok' })
  }
  catch (e) {
    avisar({ texto: e.message, tipo: 'erro' })
  }
}
function aoExcluir(linhas) {
  const n = linhas.filter((l) => l.origem !== 'plano').length
  avisar({
    texto: n > 1 ? `${n} itens apagados.` : 'Item apagado.',
    acao: { texto: 'Desfazer', fazer: () => api.restaurar(linhas).catch((e) => avisar({ texto: e.message, tipo: 'erro' })) },
  })
}
async function excluir(evento) {
  try {
    aoExcluir(await api.excluir(evento, 'so'))
  }
  catch (e) {
    avisar({ texto: e.message, tipo: 'erro' })
  }
}
function criouProva(p) {
  escolher(p.data)
  avisar({ texto: 'Prova criada.', tipo: 'ok', acao: { texto: 'Montar plano', fazer: () => abrirPlano(p) } })
}
</script>

<template>
  <div>
    <CabecalhoPagina titulo="Agenda" :descricao="descricao">
      <template #acoes>
        <div class="ag-segmentos" role="radiogroup" aria-label="Jeito de ver a agenda" :style="{ '--ag-i': indiceVisao }" @keydown="setasVisao">
          <span class="ag-indicador" aria-hidden="true" />
          <button
            v-for="v in VISOES"
            :key="v.id"
            type="button"
            role="radio"
            :aria-checked="visao === v.id"
            :tabindex="visao === v.id ? 0 : -1"
            @click="trocarVisao(v.id)"
          >
            <component :is="v.icone" :size="16" :stroke-width="2" aria-hidden="true" />{{ v.nome }}
          </button>
        </div>
        <BotaoAdicionar class="max-lg:hidden" :data-guia="telaGrande ? 'agenda-novo' : undefined" @click="novo()">Novo item</BotaoAdicionar>
      </template>
    </CabecalhoPagina>

    <div class="ag-pagina">
      <section class="ag-area-cal cartao min-w-0 p-3 sm:p-5" data-guia="agenda-calendario" aria-labelledby="ag-periodo">
        <div class="mb-3 flex flex-wrap items-center gap-2">
          <h2 id="ag-periodo" class="titulo-secao m-0 mr-auto" aria-live="polite">{{ tituloPeriodo }}</h2>
          <button type="button" class="botao-secundario botao-p" @click="escolher(hoje)">Hoje</button>
          <button type="button" class="botao-icone" :aria-label="visao === 'mes' ? 'Mês anterior' : 'Semana anterior'" :data-dica="visao === 'mes' ? 'Mês anterior' : 'Semana anterior'" @click="andar(-1)">
            <ChevronLeft :size="18" :stroke-width="2" aria-hidden="true" />
          </button>
          <button type="button" class="botao-icone" :aria-label="visao === 'mes' ? 'Próximo mês' : 'Próxima semana'" :data-dica="visao === 'mes' ? 'Próximo mês' : 'Próxima semana'" @click="andar(1)">
            <ChevronRight :size="18" :stroke-width="2" aria-hidden="true" />
          </button>
        </div>
        <AgendaMes
          v-if="visao === 'mes'"
          :mes="mes"
          :hoje="hoje"
          :selecionado="selecionado"
          :eventos="porDia"
          :revisoes="revisoes"
          :estudos="estudos"
          :materias="materiasPorId"
          :direcao="direcao"
          @escolher="escolher"
        />
        <AgendaSemana v-else-if="visao === 'semana'" :hoje="hoje" :selecionado="selecionado" :eventos="porDia" :revisoes="revisoes" :materias="materiasPorId" @escolher="escolher" @editar="editar" @novo="novo" />
        <AgendaLista v-else :dias="diasDaLista" :hoje="hoje" :selecionado="selecionado" :eventos="porDia" :revisoes="revisoes" :materias="materiasPorId" @escolher="escolher" @editar="editar" @concluir="concluir" @excluir="excluir" @novo="novo" />
      </section>

      <div class="ag-area-prova empty:hidden">
        <AgendaProva v-if="prova" :prova="prova" :hoje="hoje" :materia="materiasPorId[prova.materia_id] ?? null" :progresso="progresso" @plano="abrirPlano" @abrir="editar" />
        <Vazio v-else-if="vazia" humor="acenando" titulo="Sua agenda está vazia" texto="Marque a data da próxima prova. O PGC monta um plano de estudo até o dia.">
          <template #acoes>
            <button type="button" class="botao" @click="novo(selecionado, 'prova')">Marcar uma prova</button>
          </template>
        </Vazio>
      </div>

      <AgendaMetas class="ag-area-metas" :materias="materiasPorId" @nova="janelaMeta?.abrir()" @editar="janelaMeta?.abrir($event)" />

      <AgendaDia
        v-if="telaGrande || visao !== 'lista'"
        class="ag-area-dia"
        :dia="selecionado"
        :hoje="hoje"
        :eventos="porDia[selecionado] ?? []"
        :revisao="revisoes?.[selecionado] ?? null"
        :estudos="estudos?.[selecionado] ?? []"
        :materias="materiasPorId"
        @novo="novo"
        @editar="editar"
        @concluir="concluir"
        @excluir="excluir"
      />
    </div>

    <BotaoAdicionar redondo rotulo="Novo item" class="ag-flutuante lg:hidden" :data-guia="telaGrande ? undefined : 'agenda-novo'" @click="novo()" />
    <AgendaJanelaEvento ref="janelaEvento" :hoje="hoje" @excluiu="aoExcluir" @criou-prova="criouProva" />
    <AgendaJanelaPlano ref="janelaPlano" :hoje="hoje" :eventos="eventos ?? []" />
    <AgendaJanelaMeta ref="janelaMeta" :hoje="hoje" />
  </div>
</template>

<style>
.ag-pagina { display: grid; gap: 20px; grid-template-areas: 'prova' 'cal' 'dia' 'metas'; grid-template-columns: minmax(0, 1fr); align-items: start; }
.ag-area-cal { grid-area: cal; }
.ag-area-prova { grid-area: prova; }
.ag-area-dia { grid-area: dia; }
.ag-area-metas { grid-area: metas; }
@media (min-width: 1024px) {
  .ag-pagina { grid-template-areas: 'cal prova' 'cal metas' 'cal dia'; grid-template-columns: minmax(0, 1fr) 340px; grid-template-rows: auto auto 1fr; }
}
.ag-segmentos { position: relative; display: inline-grid; grid-template-columns: repeat(3, minmax(0, 1fr)); padding: 4px; border-radius: 14px; background: var(--color-folha-3); }
.ag-segmentos button { position: relative; z-index: 1; display: inline-flex; min-height: 36px; align-items: center; justify-content: center; gap: 6px; padding: 0 14px; border: 0; border-radius: 10px; background: transparent; color: var(--color-texto-2); font: inherit; font-size: 14px; font-weight: 600; cursor: pointer; transition: color 0.2s ease; }
.ag-segmentos button[aria-checked='true'] { color: var(--color-tinta); }
.ag-segmentos button:focus-visible { outline: 2px solid var(--color-acento); outline-offset: 1px; }
.ag-indicador { position: absolute; top: 4px; bottom: 4px; left: 4px; width: calc((100% - 8px) / 3); border-radius: 10px; background: var(--color-folha); box-shadow: 0 1px 2px color-mix(in oklab, var(--color-tinta) 14%, transparent); transform: translateX(calc(var(--ag-i, 0) * 100%)); transition: transform 0.25s cubic-bezier(0.3, 1.2, 0.5, 1); }
.ag-flutuante { position: fixed; right: 96px; bottom: calc(80px + env(safe-area-inset-bottom)); z-index: 50; }
@media (prefers-reduced-motion: reduce) { .ag-indicador { transition: none; } }
:root.menos-movimento .ag-indicador { transition: none; }
</style>
