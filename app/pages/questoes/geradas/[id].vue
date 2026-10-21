<script setup>
// Resumo das questões que acabaram de ser geradas. Elas já estão no banco e entram direto no Estudar: não há passo
// de "manter" e a resposta não aparece aqui (pedido do R, 11/10). Só os números: quantas, de que tipo e nível.
// A busca nem traz enunciado e conteúdo, para o gabarito não ir parar no navegador antes da hora.
// Questão com problema sai dos estudos pela correção, no próprio estudo.
// /questoes/geradas/sem-ia mostra as questões tiradas do texto sem IA (os ids vêm da página Gerar).
import { BookOpenCheck, ChevronDown, Clock3, FileText, ListChecks, Plus, Sparkles } from '@lucide/vue'
import { NIVEIS, enunciadoCurto, nomeDoTipo } from '#shared/regras/questoes.js'

const route = useRoute()
const supabase = useSupabaseClient()
const { data: materias } = useMaterias()
const { data: cota } = useCotaIa()
const id = String(route.params.id)
const semIa = id === 'sem-ia'
const doTexto = useState('gerar-sem-ia', () => null)
useHead({ title: 'Questões prontas | PGC' })

const { data: geracao } = await useAsyncData(`geracao-${id}`, async () => {
  if (semIa) return null
  const { data, error } = await supabase.from('ia_geracoes').select('*, materiais(titulo)').eq('id', id).maybeSingle()
  if (error) throw error
  return data
})
if (!semIa && !geracao.value) throw createError({ statusCode: 404, statusMessage: 'Geração não encontrada', fatal: true })

const { data: questoes } = await useAsyncData(`geracao-questoes-${id}`, async () => {
  let consulta = supabase.from('questoes').select('id, materia_id, assunto_id, tipo, nivel').eq('status', 'ativa')
  if (semIa) {
    const ids = doTexto.value?.ids ?? []
    if (!ids.length) return []
    consulta = consulta.in('id', ids)
  }
  else consulta = consulta.eq('geracao_id', id)
  const { data, error } = await consulta.order('criado_em')
  if (error) throw error
  return data
}, { default: () => [] })

const materiaId = computed(() => geracao.value?.materia_id ?? doTexto.value?.materiaId ?? questoes.value[0]?.materia_id ?? null)
const materia = computed(() => (materias.value ?? []).find((m) => m.id === materiaId.value) ?? null)
const nomeAssunto = (aid) => (materia.value?.assuntos ?? []).find((a) => a.id === aid)?.nome ?? ''
const assuntoIds = computed(() => geracao.value?.config?.assuntoIds ?? doTexto.value?.assuntoIds ?? [])
const assuntosPedidos = computed(() => assuntoIds.value.map(nomeAssunto).filter(Boolean))
const quando = computed(() => (geracao.value?.criado_em
  ? new Intl.DateTimeFormat('pt-BR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' }).format(new Date(geracao.value.criado_em))
  : ''))
const descartadasNaConferencia = computed(() => geracao.value?.descartadas ?? [])
const quemEscreveu = computed(() => {
  if (semIa) return 'Tiradas do texto, sem IA'
  if (geracao.value?.modo === 'externa' || geracao.value?.modelo_nome === 'Outra IA, resposta colada') return 'Outra IA, resposta colada'
  return geracao.value?.modelo_nome ? `IA do PGC (${geracao.value.modelo_nome})` : 'IA do PGC'
})

const total = computed(() => questoes.value.length)
// Contagens para o quadro "O que tem nelas", da maior para a menor.
function contar(chave) {
  const mapa = new Map()
  for (const q of questoes.value) mapa.set(q[chave], (mapa.get(q[chave]) ?? 0) + 1)
  return [...mapa.entries()].sort((a, b) => b[1] - a[1])
}
const porTipo = computed(() => contar('tipo').map(([tipo, n]) => ({ tipo, nome: nomeDoTipo(tipo), n })))
const porNivel = computed(() => NIVEIS.map((x) => ({ ...x, n: questoes.value.filter((q) => q.nivel === x.valor).length })).filter((x) => x.n))
const porAssunto = computed(() => contar('assunto_id').map(([aid, n]) => ({ nome: nomeAssunto(aid) || 'Sem assunto', n })))

const linkEstudar = computed(() => ({ path: '/revisar/nova', query: { ...(materiaId.value ? { materia: materiaId.value } : {}), ...(assuntoIds.value.length ? { assuntos: assuntoIds.value.join(',') } : {}) } }))
const linkGerar = computed(() => ({ path: '/questoes/gerar', query: { ...(materiaId.value ? { materia: materiaId.value } : {}), ...(assuntoIds.value[0] ? { assunto: assuntoIds.value[0] } : {}) } }))
const linkBanco = computed(() => ({ path: '/questoes', query: materiaId.value ? { materia: materiaId.value } : {} }))
const verDescartadas = ref(false)
</script>

<template>
  <div>
    <CabecalhoPagina
      titulo="Questões prontas"
      descricao="Já estão no seu banco e entram no Estudar. A resposta só aparece quando você responder."
      :voltar="{ para: '/questoes', texto: 'Questões' }"
    >
      <template #acoes>
        <NuxtLink :to="linkGerar" class="botao-secundario no-underline"><Plus :size="17" :stroke-width="2.3" aria-hidden="true" />Gerar mais</NuxtLink>
      </template>
    </CabecalhoPagina>

    <Vazio
      v-if="!total"
      class="mt-6"
      titulo="Nenhuma questão nova"
      :texto="semIa ? 'As questões tiradas do texto já estão no banco de questões.' : 'Nenhuma questão desta geração ficou no banco.'"
      humor="pensando"
    >
      <template #acoes>
        <NuxtLink to="/questoes" class="botao-secundario no-underline">Ver o banco</NuxtLink>
        <NuxtLink :to="linkGerar" class="botao no-underline">Gerar questões</NuxtLink>
      </template>
    </Vazio>

    <template v-else>
      <div class="mt-6 grid items-start gap-4 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <!-- Principal: quantas ficaram prontas e o próximo passo -->
        <section class="cartao entra flex flex-col gap-5 sm:flex-row sm:items-center" style="--i: 0" aria-labelledby="titulo-novas">
          <GuiaPersonagem humor="comemorando" :tamanho="88" class="shrink-0 self-center" />
          <div class="min-w-0 flex-1">
            <h2 id="titulo-novas" class="m-0 flex items-baseline gap-2">
              <span class="numero-grande tabular-nums"><NumeroAnimado :valor="total" /></span>
              <span class="text-[18px] font-semibold">{{ total === 1 ? 'questão nova' : 'questões novas' }}</span>
            </h2>
            <p class="m-0 mt-1.5 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-[14px]">
              <span class="size-2.5 shrink-0 rounded-full" :style="{ background: corMateria(materia?.cor ?? 'cinza') }" aria-hidden="true" />
              <b class="font-semibold">{{ materia?.nome ?? 'Matéria' }}</b>
              <span class="text-texto-2">{{ assuntosPedidos.length ? assuntosPedidos.join(', ') : 'a matéria toda' }}</span>
            </p>
            <p class="m-0 mt-3 max-w-[520px] text-[14px] leading-[1.5] text-texto-2">
              Elas entram na Prática do próximo estudo e depois voltam nas revisões, no tempo certo para você não esquecer.
            </p>
            <div class="mt-4 flex flex-wrap gap-2">
              <NuxtLink :to="linkEstudar" class="botao no-underline"><BookOpenCheck :size="17" :stroke-width="2.2" aria-hidden="true" />Estudar agora</NuxtLink>
              <NuxtLink :to="linkBanco" class="botao-fantasma no-underline"><ListChecks :size="17" :stroke-width="2.1" aria-hidden="true" />Ver no banco</NuxtLink>
            </div>
          </div>
        </section>

        <!-- Como foi feito -->
        <section class="cartao-p entra text-[14px]" style="--i: 1" aria-labelledby="titulo-como">
          <h2 id="titulo-como" class="titulo-cartao">Como foi feito</h2>
          <dl class="m-0 mt-2">
            <div class="flex items-start justify-between gap-3 border-b border-borda py-2.5">
              <dt class="flex shrink-0 items-center gap-2 text-texto-2"><Sparkles :size="15" :stroke-width="2" aria-hidden="true" />Quem escreveu</dt>
              <dd class="m-0 min-w-0 text-right font-semibold">{{ quemEscreveu }}</dd>
            </div>
            <div v-if="geracao?.palavras_enviadas || doTexto?.textos?.length" class="flex items-start justify-between gap-3 border-b border-borda py-2.5">
              <dt class="flex shrink-0 items-center gap-2 text-texto-2"><FileText :size="15" :stroke-width="2" aria-hidden="true" />Texto de base</dt>
              <dd class="m-0 min-w-0 text-right font-semibold">
                <template v-if="geracao?.palavras_enviadas">{{ geracao.materiais?.titulo ?? 'Texto' }}, {{ geracao.palavras_enviadas.toLocaleString('pt-BR') }} palavras</template>
                <template v-else>{{ doTexto.textos.join(', ') }}</template>
              </dd>
            </div>
            <div v-if="geracao?.latencia_ms" class="flex items-start justify-between gap-3 border-b border-borda py-2.5">
              <dt class="flex items-center gap-2 text-texto-2"><Clock3 :size="15" :stroke-width="2" aria-hidden="true" />Tempo</dt>
              <dd class="m-0 font-semibold tabular-nums">{{ Math.round(geracao.latencia_ms / 1000) }} s</dd>
            </div>
            <div v-if="geracao" class="flex items-start justify-between gap-3 border-b border-borda py-2.5">
              <dt class="text-texto-2">Ficaram no banco</dt>
              <dd class="m-0"><Fracao :valor="total" :total="Math.max(total, geracao.pedidas ?? total)" /></dd>
            </div>
            <div class="flex items-start justify-between gap-3 py-2.5">
              <dt class="text-texto-2">Cota de hoje</dt>
              <dd class="m-0"><template v-if="semIa || geracao?.modo === 'externa'">não usou</template><Fracao v-else :valor="cota.usadas" :total="cota.limite" /></dd>
            </div>
          </dl>
          <p v-if="quando" class="m-0 mt-1 text-[12.5px] text-texto-3">Gerada em {{ quando }}.</p>
        </section>
      </div>

      <!-- O que tem nelas, sem enunciado nem resposta -->
      <section class="cartao-p entra mt-4" style="--i: 2" aria-labelledby="titulo-nelas">
        <h2 id="titulo-nelas" class="titulo-cartao">O que tem nelas</h2>
        <div class="mt-3 grid gap-x-10 gap-y-5 md:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_minmax(0,1fr)]">
          <div>
            <h3 class="m-0 text-[13px] font-semibold text-texto-2">Tipos</h3>
            <ul class="m-0 mt-1.5 list-none p-0">
              <li v-for="t in porTipo" :key="t.tipo" class="flex items-center gap-2.5 border-b border-borda py-2 text-[14px] last:border-b-0">
                <QuestoesIconeTipo :tipo="t.tipo" :tamanho="16" class="shrink-0 text-texto-2" />
                <span class="min-w-0 flex-1 truncate">{{ t.nome }}</span>
                <b class="font-semibold tabular-nums">{{ t.n }}</b>
              </li>
            </ul>
          </div>
          <div>
            <h3 class="m-0 text-[13px] font-semibold text-texto-2">Níveis</h3>
            <ul class="m-0 mt-1.5 list-none p-0">
              <li v-for="n in porNivel" :key="n.valor" class="flex items-center gap-2.5 border-b border-borda py-2 text-[14px] last:border-b-0">
                <span class="min-w-0 flex-1">{{ n.nome }}</span>
                <b class="font-semibold tabular-nums">{{ n.n }}</b>
              </li>
            </ul>
          </div>
          <div>
            <h3 class="m-0 text-[13px] font-semibold text-texto-2">Assuntos</h3>
            <ul class="m-0 mt-1.5 list-none p-0">
              <li v-for="a in porAssunto" :key="a.nome" class="flex items-center gap-2.5 border-b border-borda py-2 text-[14px] last:border-b-0">
                <span class="min-w-0 flex-1 truncate">{{ a.nome }}</span>
                <b class="font-semibold tabular-nums">{{ a.n }}</b>
              </li>
            </ul>
          </div>
        </div>
        <p class="m-0 mt-4 text-[13.5px] text-texto-2">Achou uma questão com problema no estudo? Na correção dela, use "Questão com problema" para tirá-la dos estudos.</p>
      </section>

      <!-- O que ficou de fora na conferência -->
      <section v-if="descartadasNaConferencia.length" class="mt-6">
        <button type="button" class="flex items-center gap-2 text-[14px] font-semibold text-texto-2" :aria-expanded="verDescartadas" aria-controls="lista-fora" @click="verDescartadas = !verDescartadas">
          <ChevronDown :size="17" :stroke-width="2.2" class="transition-transform" :class="verDescartadas && 'rotate-180'" aria-hidden="true" />
          {{ descartadasNaConferencia.length }} {{ descartadasNaConferencia.length === 1 ? 'ficou' : 'ficaram' }} de fora na conferência do PGC
        </button>
        <Transition name="abre">
          <div v-if="verDescartadas" id="lista-fora">
            <ul class="m-0 mt-3 flex list-none flex-col gap-2 p-0">
              <li v-for="(d, i) in descartadasNaConferencia" :key="i" class="painel text-[14px]">
                <TextoRico :texto="enunciadoCurto(d.enunciado, 200) || 'Questão sem enunciado'" tag="p" class="m-0 font-semibold" />
                <p class="m-0 mt-1 text-[13.5px] text-texto-2">{{ d.motivo }}</p>
              </li>
            </ul>
          </div>
        </Transition>
      </section>
    </template>
  </div>
</template>
