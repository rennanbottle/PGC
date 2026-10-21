<script setup>
// Montar conjunto: blocos de Revisão e Prática que rodam em sequência. Cada bloco é um cartão que abre e fecha,
// com os próprios ajustes. Ao lado, o resumo do conjunto inteiro, com o que o servidor encontrou de verdade
// (sem repetir questões entre blocos). Dá para começar agora, salvar com nome, ou as duas coisas.
// ?receita=<id> começa de uma receita. ?conjunto=<id> abre um conjunto salvo para editar.
import { ArrowLeft, ChevronUp, Pencil, Plus } from '@lucide/vue'
import { MAX_BLOCOS, MAX_CONJUNTO, RECEITA, blocoPadrao, blocosDaReceita } from '#shared/regras/conjuntos.js'
import { assuntosAtivos } from '#shared/regras/materias.js'
import { nivelPorPontos } from '#shared/regras/pontos.js'
import { avaliarDesbloqueios, estaLiberado } from '#shared/regras/desbloqueios.js'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const route = useRoute()
const router = useRouter()
// Mesmo entrando por um link direto, o Estudar só abre com as questões que ele pede.
const estatisticasTrava = useEstatisticas()
const liberada = computed(() => estaLiberado('revisao', estatisticasTrava.value))
const bloqueio = computed(() => avaliarDesbloqueios(estatisticasTrava.value).find((d) => d.id === 'revisao'))
const supabase = useSupabaseClient()
const api = useRevisoes()
const conjuntos = useConjuntos()
const { data: estudo } = useResumoEstudo()
const { data: perfil } = usePerfil()
const apiMaterias = useMaterias()
const { data: cota } = useCotaIa()
await apiMaterias.pronto
const ritmo = computed(() => perfil.value?.ritmo ?? 'normal')
const maxNivel = computed(() => ((estudo.value.dominados ?? 0) >= 1 ? 5 : (estudo.value.proficientes ?? 0) >= 1 ? 4 : 3))
const disfarcarLiberado = computed(() => nivelPorPontos(estudo.value.pontos ?? 0) >= 5)

const { data: contagem } = await useAsyncData('conjunto-montar-contagem', async () => {
  const [{ data: qs }, { data: profs }] = await Promise.all([
    supabase.from('questoes').select('assunto_id').eq('em_revisao', true).not('assunto_id', 'is', null).limit(5000),
    supabase.from('proficiencias').select('assunto_id, proficiencia'),
  ])
  const noBanco = {}
  for (const q of qs ?? []) noBanco[q.assunto_id] = (noBanco[q.assunto_id] ?? 0) + 1
  return { noBanco, profs: Object.fromEntries((profs ?? []).map((p) => [p.assunto_id, p.proficiencia])) }
}, { default: () => ({ noBanco: {}, profs: {} }) })

const arvore = computed(() => (apiMaterias.data.value ?? []).filter((m) => !m.arquivada_em).map((m) => ({
  ...m,
  lista: assuntosAtivos(m).map((a) => ({ ...a, n: contagem.value.noBanco[a.id] ?? 0, prof: contagem.value.profs[a.id] ?? null })),
})).filter((m) => m.lista.length))
const info = computed(() => Object.fromEntries(arvore.value.flatMap((m) => m.lista.map((a) => [a.id, { nome: a.nome, cor: m.cor }]))))
const comQuestao = computed(() => arvore.value.flatMap((m) => m.lista.filter((a) => a.n > 0)))

// ---------- Estado inicial ----------
const conjuntoId = ref(UUID.test(String(route.query.conjunto ?? '')) ? String(route.query.conjunto) : null)
const receita = conjuntoId.value ? null : RECEITA[route.query.receita] ? String(route.query.receita) : null
let inicial = null
if (conjuntoId.value) {
  const { data } = await useAsyncData(`conjunto-${conjuntoId.value}`, async () => (await supabase.from('conjuntos').select('id, nome, blocos, atualizado_em').eq('id', conjuntoId.value).maybeSingle()).data)
  if (data.value) inicial = { nome: data.value.nome, blocos: data.value.blocos, salvoEm: data.value.atualizado_em }
  else conjuntoId.value = null
}
// "?materia=<id>&assuntos=a,b" (links de outras telas): o estudo já começa só com esses assuntos (os que têm questão).
const pedidos = (() => {
  if (conjuntoId.value) return null
  const ids = String(route.query.assuntos ?? '').split(',').filter((x) => UUID.test(x))
  const mat = UUID.test(String(route.query.materia ?? '')) ? String(route.query.materia) : null
  if (!ids.length && !mat) return null
  let lista = comQuestao.value
  if (ids.length) lista = lista.filter((a) => ids.includes(a.id))
  else lista = (arvore.value.find((m) => m.id === mat)?.lista ?? []).filter((a) => a.n > 0)
  return lista.length ? lista.map((a) => ({ id: a.id, peso: 5 })) : null
})()
function comAssuntos(b, base = null) {
  if (b.origem !== 'erros_conjunto' && !b.assuntos?.length) b.assuntos = JSON.parse(JSON.stringify(base ?? pedidos ?? comQuestao.value.map((a) => ({ id: a.id, peso: 5 }))))
  return b
}
if (!inicial) {
  const lista = receita ? blocosDaReceita(receita, ritmo.value) : [blocoPadrao('revisao', ritmo.value)]
  inicial = { nome: receita ? RECEITA[receita].nome : 'Novo estudo', blocos: lista.map((b) => comAssuntos(b)) }
}
useHead({ title: () => `${conjuntoId.value ? 'Editar conjunto' : 'Montar conjunto'} | PGC` })

let seq = 0
const comChave = (b) => ({ ...JSON.parse(JSON.stringify(b)), _k: ++seq })
const nome = ref(inicial.nome)
const blocos = ref(inicial.blocos.map(comChave))
const aberto = ref(0)
const salvoEm = ref(inicial.salvoEm ?? null)
const limpos = () => blocos.value.map(({ _k, ...b }) => JSON.parse(JSON.stringify(b)))
const chave = computed(() => JSON.stringify({ nome: nome.value, blocos: limpos() }))
const ultimaSalva = ref(conjuntoId.value ? chave.value : null)
const mudou = computed(() => chave.value !== ultimaSalva.value)
const totalPedido = computed(() => blocos.value.reduce((s, b) => s + (b.quantidade ?? 0), 0))

const { data: execucoes } = await useAsyncData(`conjunto-execucoes-${conjuntoId.value ?? 'novo'}`, async () => {
  if (!conjuntoId.value) return 0
  const { count } = await supabase.from('revisoes').select('id', { count: 'exact', head: true }).eq('conjunto_id', conjuntoId.value)
  return count ?? 0
}, { default: () => 0 })

// ---------- Blocos ----------
const erro = ref('')
function adicionar(tipo) {
  if (blocos.value.length >= MAX_BLOCOS) {
    erro.value = `Um conjunto tem no máximo ${MAX_BLOCOS} blocos.`
    return
  }
  const ultimo = [...blocos.value].reverse().find((b) => b.origem !== 'erros_conjunto')
  const b = comAssuntos(blocoPadrao(tipo, ritmo.value, { nome: tipo === 'pratica' ? 'Prática' : 'Revisão' }), ultimo?.assuntos)
  blocos.value.push(comChave(b))
  aberto.value = blocos.value.length - 1
}
function trocar(i, j) {
  if (j < 0 || j >= blocos.value.length) return
  const l = blocos.value
  ;[l[i], l[j]] = [l[j], l[i]]
  if (aberto.value === i) aberto.value = j
  else if (aberto.value === j) aberto.value = i
  // Bloco de erros não pode ser o primeiro.
  if (l[0].origem === 'erros_conjunto') l[0].origem = 'vencidas'
}
function duplicar(i) {
  if (blocos.value.length >= MAX_BLOCOS) return
  const copia = comChave({ ...JSON.parse(JSON.stringify(blocos.value[i])), nome: `${blocos.value[i].nome} 2`.slice(0, 60) })
  blocos.value.splice(i + 1, 0, copia)
  aberto.value = i + 1
}
function remover(i) {
  if (blocos.value.length === 1) {
    erro.value = 'O estudo precisa de pelo menos um bloco.'
    return
  }
  blocos.value.splice(i, 1)
  if (blocos.value[0].origem === 'erros_conjunto') blocos.value[0].origem = 'vencidas'
  aberto.value = Math.min(aberto.value ?? 0, blocos.value.length - 1)
}
function acao(i, a) {
  if (a === 'subir') trocar(i, i - 1)
  else if (a === 'descer') trocar(i, i + 1)
  else if (a === 'duplicar') duplicar(i)
  else if (a === 'remover') remover(i)
}

// ---------- Prévia ----------
const previa = ref(null)
const carregando = ref(false)
const erroPrevia = ref('')
let temporizador = null
const blocosParaPrevia = () => JSON.stringify(limpos())
async function atualizar() {
  const lista = limpos()
  if (lista.some((b) => b.origem !== 'erros_conjunto' && (!b.assuntos.length || !b.tipos.length))) {
    previa.value = null
    erroPrevia.value = ''
    return
  }
  carregando.value = true
  try {
    previa.value = await api.previa(lista)
    erroPrevia.value = ''
  }
  catch (e) {
    previa.value = null
    erroPrevia.value = e.message
  }
  carregando.value = false
}
watch(blocosParaPrevia, () => {
  clearTimeout(temporizador)
  temporizador = setTimeout(atualizar, 500)
})
onMounted(atualizar)
onBeforeUnmount(() => clearTimeout(temporizador))

// ---------- Salvar e começar ----------
const salvando = ref(false)
const criando = ref(false)
const hora = (d) => (d ? new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' }).format(new Date(d)) : '')
async function salvar() {
  erro.value = ''
  salvando.value = true
  try {
    const r = await conjuntos.salvar({ id: conjuntoId.value, nome: nome.value, blocos: limpos() })
    conjuntoId.value = r.id
    salvoEm.value = r.atualizadoEm ?? new Date().toISOString()
    ultimaSalva.value = chave.value
    router.replace({ query: { conjunto: r.id } })
  }
  catch (e) {
    erro.value = e.message
  }
  salvando.value = false
}
async function comecar() {
  erro.value = ''
  criando.value = true
  try {
    const r = await api.criar({ blocos: limpos(), nome: nome.value, conjuntoId: conjuntoId.value ?? undefined, receita: receita ?? undefined })
    await navigateTo(`/revisar/${r.id}`)
  }
  catch (e) {
    erro.value = e.message
  }
  criando.value = false
}
const podeComecar = computed(() => !!previa.value && previa.value.total > 0 && totalPedido.value <= MAX_CONJUNTO)
const usaCompletar = computed(() => blocos.value.some((b) => b.tipo === 'pratica' && (b.completarMaterial || b.completarIa)))
const notaSalvo = computed(() => {
  if (!conjuntoId.value) return 'Ainda não salvo. Salvar guarda o conjunto com nome para usar de novo.'
  const ex = execucoes.value ? ` ${execucoes.value} ${execucoes.value === 1 ? 'execução feita' : 'execuções feitas'}; elas não mudam.` : ''
  return mudou.value ? `Mudanças não salvas.${ex}` : `Salvo às ${hora(salvoEm.value)}.${ex}`
})
const janelaResumo = ref(null)
const idNome = useId()
</script>

<template>
  <TelaBloqueada v-if="!liberada && bloqueio" nome="Estudar" resumo="Estudos em blocos de Revisão e Prática, montados com os seus assuntos, em modo foco." :requisitos="bloqueio.requisitos" />
  <div v-else class="pb-28 lg:pb-0">
    <NuxtLink to="/revisar" class="volta mb-3 pl-0 text-[14.5px] no-underline"><ArrowLeft :size="16" :stroke-width="2" aria-hidden="true" /><span>Estudar</span></NuxtLink>
    <div class="flex items-center gap-3">
      <label :for="idNome" class="so-leitor">Nome do estudo</label>
      <input :id="idNome" v-model="nome" maxlength="80" class="min-w-0 max-w-full flex-1 border-0 border-b-[1.5px] border-borda-campo bg-transparent px-0 pb-1 font-titulo text-[30px] font-medium leading-[1.15] tracking-[-0.015em] text-tinta outline-none focus:border-tinta sm:text-[36px]">
      <Pencil :size="18" :stroke-width="1.9" class="shrink-0 text-texto-2" aria-hidden="true" />
    </div>
    <p class="m-0 mt-2 text-[15px] text-texto-2">Os blocos rodam em sequência, sem voltar à tela de Estudar entre eles. O comentário sobre as respostas vem só no fim do estudo.</p>

    <div class="mt-7 grid items-start gap-7 lg:grid-cols-[minmax(0,1fr)_310px]">
      <div class="flex min-w-0 flex-col gap-3">
        <ConjuntoBloco
          v-for="(b, i) in blocos"
          :key="b._k"
          :bloco="b"
          :numero="i + 1"
          :aberto="aberto === i"
          :primeiro="i === 0"
          :ultimo="i === blocos.length - 1"
          :pode-duplicar="blocos.length < MAX_BLOCOS"
          :info="info"
          :arvore="arvore"
          :previa="previa?.blocos?.[i] ?? null"
          :max-nivel="maxNivel"
          :disfarcar-liberado="disfarcarLiberado"
          :cota="cota"
          @alternar="aberto = aberto === i ? null : i"
          @subir="acao(i, 'subir')"
          @descer="acao(i, 'descer')"
          @duplicar="acao(i, 'duplicar')"
          @remover="acao(i, 'remover')"
        />
        <div class="flex flex-wrap items-center gap-3 rounded-[16px] bg-folha-2 px-4 py-3.5">
          <button type="button" class="botao-secundario h-10 gap-1.5 px-3.5 text-[14.5px]" :disabled="blocos.length >= MAX_BLOCOS" @click="adicionar('revisao')"><Plus :size="16" :stroke-width="2" aria-hidden="true" />Bloco de Revisão</button>
          <button type="button" class="botao-secundario h-10 gap-1.5 px-3.5 text-[14.5px]" :disabled="blocos.length >= MAX_BLOCOS" @click="adicionar('pratica')"><Plus :size="16" :stroke-width="2" aria-hidden="true" />Bloco de Prática</button>
          <span class="text-[13px] leading-snug text-texto-2">Revisão volta no que você já respondeu. Prática traz questões que você ainda não viu. Até {{ MAX_BLOCOS }} blocos e {{ MAX_CONJUNTO }} questões. Prova não entra em conjunto; ela tem tela própria.</span>
        </div>
      </div>

      <aside class="hidden flex-col gap-4 rounded-[14px] border border-borda bg-campo p-5 lg:sticky lg:top-5 lg:flex" aria-label="Resumo do conjunto">
        <p class="m-0 text-[12.5px] font-semibold text-texto-2">Resumo do estudo</p>
        <ConjuntoResumo :blocos="blocos" :previa="previa" :carregando="carregando" :cota="cota" />
        <p v-if="erro || erroPrevia" class="m-0 text-[13.5px] font-semibold text-erro" role="alert">{{ erro || erroPrevia }}</p>
        <button type="button" class="botao h-12 w-full text-[15.5px]" :aria-busy="criando" :disabled="criando || !podeComecar" @click="comecar">{{ criando ? 'Montando' : 'Começar agora' }}</button>
        <button type="button" class="botao-secundario h-11 w-full text-[15px]" :aria-busy="salvando" :disabled="salvando || (!mudou && !!conjuntoId)" @click="salvar">{{ salvando ? 'Salvando' : conjuntoId ? 'Salvar mudanças' : 'Salvar estudo' }}</button>
        <p class="-mt-1 m-0 text-center text-[12.5px] text-texto-2">{{ criando && usaCompletar ? 'Completar com material ou IA pode levar até 40 segundos.' : notaSalvo }}</p>
      </aside>
    </div>

    <!-- Celular: resumo no rodapé -->
    <div class="fixed inset-x-0 bottom-[calc(66px+env(safe-area-inset-bottom))] z-10 border-t border-borda bg-folha py-3 pl-4 pr-[92px] lg:hidden">
      <p v-if="erro || erroPrevia" class="m-0 mb-2 text-[13px] font-semibold text-erro" role="alert">{{ erro || erroPrevia }}</p>
      <div class="flex items-center gap-3">
        <button type="button" class="min-w-0 flex-1 cursor-pointer border-0 bg-transparent p-0 text-left" aria-haspopup="dialog" @click="janelaResumo?.abrir()">
          <b class="block text-[15px] tabular-nums">{{ previa ? `${previa.total} ${previa.total === 1 ? 'questão' : 'questões'}, ${previa.minutos} min` : carregando ? 'Fazendo a conta' : 'Sem questões ainda' }}</b>
          <span class="flex items-center gap-1 text-[13px] font-semibold text-texto-2">Ver resumo<ChevronUp :size="14" :stroke-width="2" aria-hidden="true" /></span>
        </button>
        <button type="button" class="botao h-11 px-5" :aria-busy="criando" :disabled="criando || !podeComecar" @click="comecar">{{ criando ? 'Montando' : 'Começar' }}</button>
      </div>
    </div>
    <JanelaBase ref="janelaResumo" titulo="Resumo do estudo">
      <ConjuntoResumo :blocos="blocos" :previa="previa" :carregando="carregando" :cota="cota" :numero-grande="false" />
      <div class="grid grid-cols-2 gap-2">
        <button type="button" class="botao-secundario h-11 text-[14.5px]" :disabled="salvando || (!mudou && !!conjuntoId)" @click="salvar">{{ conjuntoId ? 'Salvar mudanças' : 'Salvar' }}</button>
        <button type="button" class="botao h-11 text-[14.5px]" :disabled="criando || !podeComecar" @click="comecar">Começar</button>
      </div>
      <p class="m-0 text-[12.5px] text-texto-2">{{ notaSalvo }}</p>
    </JanelaBase>
  </div>
</template>
