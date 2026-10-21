<script setup>
// Histórico: tudo o que a pessoa fez no PGC, do mais novo ao mais antigo, em dias (horário de Brasília) com o
// nome do dia preso no topo ao rolar. Junta estudos concluídos, textos, matérias, questões criadas e marcos de
// pontos. Abre com o mês atual e o anterior (o resumo do topo compara os dois); "Carregar <mês>" busca um mês
// por vez, até o começo da conta (a primeira matéria). Trava: 1 estudo concluído (regra "historico").
import { Brain, CalendarDays, History, Layers, Library, BookOpen, Sparkles, TrendingUp } from '@lucide/vue'
import { avaliarDesbloqueios } from '#shared/regras/desbloqueios.js'
import {
  MOTIVOS_MARCO, PERIODOS_HISTORICO, TIPOS_EVENTO, agruparPorDia, diaDe, filtrarEventos, inicioDoMes, montarLinhaDoTempo,
  nomeDoMes, respostasPorDia, resumoDoMes, rotuloDoDia,
} from '#shared/regras/historico.js'

useHead({ title: 'Histórico | PGC' })

const supabase = useSupabaseClient()
const usuario = useSupabaseUser()
const { avisar } = useAvisos()
const estatisticas = useEstatisticas()
const { status: statusEstudo } = useResumoEstudo()
const { data: materias } = useMaterias()
const { data: materiais } = useMateriais()

const trava = computed(() => avaliarDesbloqueios(estatisticas.value).find((d) => d.id === 'historico'))
const esperando = computed(() => ['idle', 'pending'].includes(statusEstudo.value))

const hoje = diaDe(new Date())
const INICIO = inicioDoMes(hoje, 1)
const desde = ref(INICIO)
const VAZIO = { revisoes: [], questoes: [], pontos: [] }

// Busca um intervalo [de, ate) de dias. As datas também são conferidas aqui (dia de Brasília).
async function buscar(de, ate = null) {
  const inicio = `${de}T00:00:00-03:00`
  const fim = ate ? `${ate}T00:00:00-03:00` : null
  const janela = (q, coluna) => (fim ? q.gte(coluna, inicio).lt(coluna, fim) : q.gte(coluna, inicio))
  const [r, q, p] = await Promise.all([
    janela(supabase.from('revisoes').select('id, tipo, titulo, status, total, respondidas, certas, parciais, pontos, segundos, encerrada_antes, concluida_em').eq('status', 'concluida'), 'concluida_em')
      .order('concluida_em', { ascending: false }).limit(1000),
    janela(supabase.from('questoes').select('id, origem, materia_id, criado_em'), 'criado_em')
      .order('criado_em', { ascending: false }).limit(4000),
    janela(supabase.from('pontos_eventos').select('id, motivo, pontos, criado_em').in('motivo', MOTIVOS_MARCO), 'criado_em')
      .order('criado_em', { ascending: false }).limit(1000),
  ])
  const falha = r.error || q.error || p.error
  if (falha) throw falha
  const dentro = (x) => {
    const d = diaDe(x)
    return !!d && d >= de && (!ate || d < ate)
  }
  return {
    revisoes: (r.data ?? []).filter((x) => dentro(x.concluida_em)),
    questoes: (q.data ?? []).filter((x) => dentro(x.criado_em)),
    pontos: (p.data ?? []).filter((x) => dentro(x.criado_em)),
  }
}

const { data: inicial, status, refresh } = useAsyncData('historico-inicio', () => (usuario.value ? buscar(INICIO) : VAZIO), {
  default: () => null,
  watch: [() => usuario.value?.sub],
})
const extras = ref([])
const carregando = ref(false)

// Começo da conta: a matéria mais antiga (nada no PGC existe antes de uma matéria).
const inicioConta = computed(() => (materias.value ?? []).map((m) => diaDe(m.criado_em)).filter(Boolean).sort()[0] ?? null)
const temMais = computed(() => !!inicioConta.value && inicioConta.value < desde.value)
const mesParaCarregar = computed(() => nomeDoMes(inicioDoMes(desde.value, 1)))

async function carregarMais() {
  const novo = inicioDoMes(desde.value, 1)
  carregando.value = true
  try {
    extras.value.push(await buscar(novo, desde.value))
    desde.value = novo
  }
  catch {
    avisar({ texto: 'Não deu para carregar. Confira a internet e tente de novo.', tipo: 'erro' })
  }
  finally {
    carregando.value = false
  }
}

const eventos = computed(() => {
  const pacotes = [inicial.value, ...extras.value].filter(Boolean)
  const noPeriodo = (x) => (diaDe(x) ?? '') >= desde.value
  return montarLinhaDoTempo({
    revisoes: pacotes.flatMap((p) => p.revisoes),
    questoes: pacotes.flatMap((p) => p.questoes),
    pontos: pacotes.flatMap((p) => p.pontos),
    materiais: (materiais.value ?? []).filter((m) => noPeriodo(m.criado_em)),
    materias: (materias.value ?? []).filter((m) => noPeriodo(m.criado_em)),
  })
})
const materiaPorId = computed(() => Object.fromEntries((materias.value ?? []).map((m) => [m.id, m])))
const resumo = computed(() => resumoDoMes(eventos.value, hoje))
const porDia = computed(() => respostasPorDia(eventos.value, hoje))

const ICONES = { estudo: Brain, questoes: Sparkles, texto: Library, materia: BookOpen, marco: TrendingUp }
const OPCOES_TIPO = [{ valor: '', texto: 'Tudo', icone: Layers }, ...TIPOS_EVENTO.map((t) => ({ ...t, icone: ICONES[t.valor] }))]
const OPCOES_PERIODO = PERIODOS_HISTORICO.map((p) => ({ ...p, icone: CalendarDays }))
const tipo = ref('')
const periodo = ref('tudo')
const filtrando = computed(() => !!tipo.value || periodo.value !== 'tudo')
function limpar() {
  tipo.value = ''
  periodo.value = 'tudo'
}

const dias = computed(() => agruparPorDia(filtrarEventos(eventos.value, { tipo: tipo.value, periodo: periodo.value }, hoje), hoje))
// O que o dia teve de estudo, escrito ao lado do nome do dia.
function resumoDia(lista) {
  const estudos = lista.filter((e) => e.tipo === 'estudo')
  if (!estudos.length) return ''
  const pontos = estudos.reduce((s, e) => s + e.pontos, 0)
  return `${estudos.length} ${estudos.length === 1 ? 'estudo' : 'estudos'}, +${pontos.toLocaleString('pt-BR')} pontos`
}
// "foi criada em 4 de setembro" (ou "hoje", "ontem").
const primeiraMateria = computed(() => {
  if (!inicioConta.value) return ''
  const rotulo = rotuloDoDia(inicioConta.value, hoje)
  return rotulo === 'Hoje' || rotulo === 'Ontem' ? rotulo.toLowerCase() : `em ${rotulo.replace(/^[^,]+, /, '')}`
})
</script>

<template>
  <div class="mx-auto w-full max-w-[920px]">
    <div v-if="esperando" class="flex flex-col gap-5" aria-busy="true">
      <div class="esqueleto h-[64px] max-w-[420px] rounded-[16px]" />
      <div class="esqueleto h-[220px] rounded-[20px]" />
    </div>

    <TelaBloqueada
      v-else-if="trava && !trava.liberado"
      nome="Histórico"
      resumo="Tudo o que você fez no PGC, do mais novo ao mais antigo."
      :requisitos="trava.requisitos"
    />

    <template v-else>
      <CabecalhoPagina titulo="Histórico" descricao="Tudo o que você fez no PGC, do mais novo ao mais antigo." />

      <div v-if="status === 'error'" class="cartao mt-6 flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p class="m-0 text-[14.5px] text-erro">Não deu para carregar o histórico. Confira a internet e tente de novo.</p>
        <button type="button" class="botao-secundario botao-p" @click="refresh()">Tentar de novo</button>
      </div>

      <div v-else-if="!inicial" class="mt-6 flex flex-col gap-5" aria-busy="true">
        <div class="esqueleto h-[220px] rounded-[20px]" />
        <div class="esqueleto h-[320px] rounded-[20px]" />
      </div>

      <template v-else>
        <HistoricoResumo class="entra mt-6" style="--i: 1" :resumo="resumo" :por-dia="porDia" />

        <div class="entra mt-7 flex flex-wrap items-center gap-2" style="--i: 2">
          <Selecao v-model="tipo" variante="filtro" prefixo="Mostrar" rotulo="O que mostrar" :opcoes="OPCOES_TIPO" />
          <Selecao v-model="periodo" variante="filtro" prefixo="Período" rotulo="Período" :opcoes="OPCOES_PERIODO" />
          <button v-if="filtrando" type="button" class="botao-fantasma botao-p" @click="limpar">Limpar filtros</button>
        </div>

        <!-- Uma folha só: cada dia tem o nome preso no topo ao rolar e o trilho com o que aconteceu. -->
        <div v-if="dias.length" class="quadro entra mt-4 rounded-[20px] border border-borda bg-folha" style="--i: 3">
          <section v-for="d in dias" :key="d.dia" class="dia" :aria-labelledby="`dia-${d.dia}`">
            <h2
              :id="`dia-${d.dia}`"
              class="cabeca-dia sticky top-[64px] z-[6] m-0 flex flex-wrap items-baseline gap-x-3 bg-folha px-4 pb-2 pt-3.5 sm:px-5 lg:top-0"
            >
              <span class="font-titulo text-[16.5px] font-bold first-letter:uppercase">{{ d.rotulo }}</span>
              <span v-if="resumoDia(d.eventos)" class="text-[13px] font-medium text-texto-3">{{ resumoDia(d.eventos) }}</span>
            </h2>
            <TransitionGroup tag="ol" name="lista" class="trilho relative m-0 flex list-none flex-col gap-0.5 px-2.5 pb-3 pt-0 sm:px-3.5">
              <HistoricoEvento v-for="e in d.eventos" :key="e.id" :evento="e" :materias="materiaPorId" />
            </TransitionGroup>
          </section>
        </div>

        <Vazio
          v-else-if="filtrando"
          class="mt-6"
          titulo="Nada com esses filtros"
          texto="Tente outro tipo ou um período maior."
          humor="pensando"
          compacto
        >
          <template #acoes>
            <button type="button" class="botao-secundario" @click="limpar">Limpar filtros</button>
          </template>
        </Vazio>
        <Vazio
          v-else
          class="mt-6"
          titulo="Nada por aqui neste mês"
          texto="Cada estudo, texto e questão nova aparece aqui, com o dia e a hora."
          humor="dormindo"
          compacto
        >
          <template #acoes>
            <NuxtLink to="/revisar/nova" class="botao"><Brain :size="18" :stroke-width="2" aria-hidden="true" />Começar um estudo</NuxtLink>
          </template>
        </Vazio>

        <div v-if="periodo === 'tudo'" class="mt-6 flex flex-col items-center gap-2 pb-4 text-center">
          <button v-if="temMais" type="button" class="botao-secundario" :disabled="carregando" @click="carregarMais">
            <span v-if="carregando" class="rodando" aria-hidden="true" />
            <History v-else :size="18" :stroke-width="2" aria-hidden="true" />
            Carregar {{ mesParaCarregar }}
          </button>
          <p v-else-if="primeiraMateria" class="m-0 text-[13.5px] text-texto-3">
            Aqui começa o seu histórico: a primeira matéria foi criada {{ primeiraMateria }}.
          </p>
        </div>
      </template>
    </template>
  </div>
</template>

<style scoped>
.trilho {
  --recuo: 10px;
}
@media (min-width: 640px) {
  .trilho {
    --recuo: 14px;
  }
}
.dia + .dia {
  border-top: 1px solid var(--borda);
}
.dia:first-child .cabeca-dia {
  border-radius: 20px 20px 0 0;
}
.trilho::before {
  content: '';
  position: absolute;
  top: 24px;
  bottom: 36px;
  left: calc(var(--recuo) + 17px);
  width: 2px;
  border-radius: 2px;
  background: var(--borda);
}
</style>
