<script setup>
// Montar prova: o que cai (matérias e assuntos com peso), o formato, quantas questões e o tempo. O caderno sai do
// banco de questões (só tipos que o PGC corrige sozinho) e aparece logo embaixo: dá para trocar uma questão ou
// sortear outras antes de começar. Ao lado, o resumo com o tempo e quanto cai de cada matéria.
// ?repetir=<id> abre com a configuração de uma prova feita; ?evento=<id> usa o nome e as matérias de uma prova
// marcada na Agenda.
import { CircleAlert, Play, Repeat2, Shuffle } from '@lucide/vue'
import { FORMATOS, MINUTOS_MAX, MINUTOS_MIN, ORDENS, QUANTIDADES, QUANTAS_MAX, QUANTAS_MIN, RELOGIOS, duracao, formatoDe, lerConfigProva, tempoSugerido } from '#shared/regras/provas.js'
import { assuntosAtivos } from '#shared/regras/materias.js'
import { enunciadoCurto, nomeDoNivel } from '#shared/regras/questoes.js'
import { avaliarDesbloqueios, estaLiberado } from '#shared/regras/desbloqueios.js'

useHead({ title: 'Nova prova | PGC' })
const route = useRoute()
const estatisticas = useEstatisticas()
const liberada = computed(() => estaLiberado('prova', estatisticas.value))
const bloqueio = computed(() => avaliarDesbloqueios(estatisticas.value).find((d) => d.id === 'prova'))
const supabase = useSupabaseClient()
const apiMaterias = useMaterias()
const api = useProvas()
await apiMaterias.pronto

const { data: noBanco } = await useAsyncData('prova-montar-contagem', async () => {
  const { data } = await supabase.from('questoes').select('assunto_id').eq('em_revisao', true).not('assunto_id', 'is', null).limit(5000)
  const n = {}
  for (const q of data ?? []) n[q.assunto_id] = (n[q.assunto_id] ?? 0) + 1
  return n
}, { default: () => ({}) })
const arvore = computed(() => (apiMaterias.data.value ?? []).filter((m) => !m.arquivada_em).map((m) => ({
  ...m,
  lista: assuntosAtivos(m).map((a) => ({ ...a, n: noBanco.value[a.id] ?? 0, prof: null })),
})).filter((m) => m.lista.some((a) => a.n > 0)))

// ---------- Configuração ----------
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const pedirAoServidor = useRequestFetch()
const { data: base } = await useAsyncData(`prova-base-${route.query.repetir ?? route.query.evento ?? 'nova'}`, async () => {
  const repetir = String(route.query.repetir ?? '')
  const evento = String(route.query.evento ?? '')
  if (UUID.test(repetir)) return pedirAoServidor(`/api/provas/${repetir}/config`).catch(() => null)
  if (UUID.test(evento)) {
    // Prova marcada na Agenda: o nome dela e os assuntos (ou todos os da matéria que têm questão).
    const { data: e } = await supabase.from('agenda_eventos').select('titulo, materia_id, assuntos').eq('id', evento).maybeSingle()
    if (!e) return null
    const ids = e.assuntos?.length ? e.assuntos : (arvore.value.find((m) => m.id === e.materia_id)?.lista ?? []).filter((a) => a.n > 0).map((a) => a.id)
    return { titulo: `Simulado para ${e.titulo}`.slice(0, 80), assuntos: ids.length ? ids.map((id) => ({ id, peso: 5 })) : null }
  }
  return null
}, { default: () => null })
const formato = ref(base.value?.formato ?? 'enem')
const assuntos = ref(base.value?.assuntos?.length ? base.value.assuntos : arvore.value.flatMap((m) => m.lista.filter((a) => a.n > 0).map((a) => ({ id: a.id, peso: 5 }))))
const quantas = ref(base.value?.quantas ?? 20)
const minutos = ref(base.value?.minutos ?? tempoSugerido(formato.value, quantas.value))
const tempoMexido = ref(!!base.value?.minutos)
const relogio = ref(base.value?.relogio ?? 'sempre')
const ordem = ref(base.value?.ordem ?? 'misturada')
const fracos = ref(base.value?.fracos ?? true)
const sugerido = computed(() => tempoSugerido(formato.value, quantas.value))
watch([formato, quantas], () => {
  if (!tempoMexido.value) minutos.value = sugerido.value
})
function mudarMinutos(v) {
  minutos.value = v
  tempoMexido.value = v !== sugerido.value
}

const marcados = computed(() => new Set(assuntos.value.map((a) => a.id)))
// Nome: sai do formato e das matérias até a pessoa escrever outro.
const tituloEscrito = ref(base.value?.titulo ?? '')
const tituloAuto = computed(() => {
  const nomes = arvore.value.filter((m) => doBanco(m).some((a) => marcados.value.has(a.id))).map((m) => m.nome)
  const lista = nomes.length > 3 ? `${nomes.slice(0, 2).join(', ')} e mais ${nomes.length - 2}` : nomes.length > 1 ? `${nomes.slice(0, -1).join(', ')} e ${nomes.at(-1)}` : nomes[0] ?? ''
  return `Simulado ${formatoDe(formato.value).nome}${lista ? `, ${lista}` : ''}`.slice(0, 80)
})
const titulo = computed({
  get: () => tituloEscrito.value || tituloAuto.value,
  set: (v) => (tituloEscrito.value = v === tituloAuto.value ? '' : v),
})
const doBanco = (m) => m.lista.filter((a) => a.n > 0)
const materiaMarcada = (m) => doBanco(m).some((a) => marcados.value.has(a.id))
function alternarMateria(m) {
  const ids = doBanco(m).map((a) => a.id)
  assuntos.value = materiaMarcada(m) ? assuntos.value.filter((a) => !ids.includes(a.id)) : [...assuntos.value, ...ids.filter((id) => !marcados.value.has(id)).map((id) => ({ id, peso: 5 }))]
}
function resumoMateria(m) {
  const lista = doBanco(m)
  const n = lista.filter((a) => marcados.value.has(a.id)).length
  const q = lista.filter((a) => marcados.value.has(a.id)).reduce((s, a) => s + a.n, 0)
  if (!n) return `${lista.length} ${lista.length === 1 ? 'assunto' : 'assuntos'} com questões`
  return `${n === lista.length ? 'Todos os' : `${n} de`} ${lista.length} assuntos, ${q} questões no banco`
}
const janelaAssuntos = ref(null)

// ---------- Caderno (prévia do servidor) ----------
const lida = computed(() => lerConfigProva({ titulo: titulo.value, formato: formato.value, assuntos: assuntos.value, quantas: quantas.value, minutos: minutos.value, relogio: relogio.value, ordem: ordem.value, fracos: fracos.value }))
const previa = ref(null)
const carregando = ref(false)
const erro = ref('')
let semente = Math.floor(Math.random() * 1e9)
let pedido = 0
async function pedirPrevia(extra = {}) {
  if (lida.value.erro) {
    previa.value = null
    return
  }
  const meu = ++pedido
  carregando.value = true
  try {
    const r = await api.previa({ ...lida.value.config, semente, ...extra })
    if (meu === pedido) {
      previa.value = r
      erro.value = ''
    }
  }
  catch (e) {
    if (meu === pedido) erro.value = e.message
  }
  if (meu === pedido) carregando.value = false
}
let espera = null
watch(() => JSON.stringify(lida.value), () => {
  clearTimeout(espera)
  espera = setTimeout(() => pedirPrevia(), 350)
})
onMounted(() => pedirPrevia())
function sortear() {
  semente = Math.floor(Math.random() * 1e9)
  pedirPrevia()
}
function trocar(q) {
  pedirPrevia({ caderno: (previa.value?.caderno ?? []).map((c) => c.questaoId), trocar: [q.questaoId] })
}
const verTodas = ref(false)
const caderno = computed(() => previa.value?.caderno ?? [])
const visiveis = computed(() => (verTodas.value ? caderno.value : caderno.value.slice(0, 8)))
const nomeAssunto = (id) => arvore.value.flatMap((m) => m.lista.map((a) => ({ ...a, materia: m.nome, cor: m.cor }))).find((a) => a.id === id) ?? null

const comecando = ref(false)
async function comecar() {
  if (lida.value.erro) {
    erro.value = lida.value.erro
    return
  }
  comecando.value = true
  try {
    const r = await api.criar({ ...lida.value.config, semente, caderno: caderno.value.map((c) => c.questaoId) })
    await navigateTo(`/prova/${r.id}`)
  }
  catch (e) {
    erro.value = e.message
    comecando.value = false
  }
}
</script>

<template>
  <TelaBloqueada v-if="!liberada && bloqueio" nome="Prova" resumo="Simulados com cronômetro, montados do seu jeito, para treinar antes da prova de verdade." :requisitos="bloqueio.requisitos" />
  <div v-else class="pb-28 lg:pb-12">
    <CabecalhoPagina titulo="Nova prova" descricao="O caderno sai do seu banco de questões. Dá para trocar qualquer questão antes de começar." :voltar="{ para: '/prova', texto: 'Prova' }" />

    <div class="mt-6 grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
      <div class="flex min-w-0 flex-col gap-4">
        <!-- O que cai -->
        <section data-guia="prova-cai" class="cartao" aria-labelledby="titulo-cai">
          <div class="flex flex-wrap items-baseline justify-between gap-2">
            <h2 id="titulo-cai" class="titulo-cartao m-0">O que cai</h2>
            <button type="button" class="link text-[14px]" @click="janelaAssuntos?.abrir()">Escolher assuntos e pesos</button>
          </div>
          <ul class="m-0 mt-3 grid list-none gap-2 p-0 sm:grid-cols-2">
            <li v-for="m in arvore" :key="m.id">
              <label class="opcao-materia" :data-marcada="materiaMarcada(m)">
                <input type="checkbox" class="so-leitor" :checked="materiaMarcada(m)" @change="alternarMateria(m)">
                <span class="caixa mt-0.5" aria-hidden="true" />
                <span class="min-w-0">
                  <b class="flex items-center gap-2 text-[15px]"><span class="size-2.5 shrink-0 rounded-full" :style="{ background: corMateria(m.cor ?? 'cinza') }" aria-hidden="true" />{{ m.nome }}</b>
                  <span class="block text-[13px] text-texto-2">{{ resumoMateria(m) }}</span>
                </span>
              </label>
            </li>
          </ul>
          <label class="linha-opcao mt-3 w-fit items-start py-2 pr-3">
            <input v-model="fracos" type="checkbox" class="marcar mt-0.5">
            <span><b class="block text-[14.5px]">Mais questões dos assuntos em que você mais erra</b><span class="block text-[13px] text-texto-2">Sem tirar nenhuma matéria: os assuntos fracos só ganham mais peso.</span></span>
          </label>
        </section>

        <!-- Formato -->
        <section data-guia="prova-formato" class="cartao" aria-labelledby="titulo-formato">
          <h2 id="titulo-formato" class="titulo-cartao m-0">Formato</h2>
          <div role="radiogroup" aria-labelledby="titulo-formato" class="mt-3 grid gap-2 sm:grid-cols-2">
            <button v-for="f in FORMATOS" :key="f.id" type="button" role="radio" class="opcao-formato" :aria-checked="formato === f.id" @click="formato = f.id">
              <span class="flex items-center gap-2.5"><span class="radio" aria-hidden="true" /><b class="text-[15px]">{{ f.nome }}</b><span class="ml-auto text-[12.5px] text-texto-3">{{ String(f.minutos).replace('.', ',') }} min por questão</span></span>
              <span class="mt-1 block pl-[30px] text-[13.5px] leading-snug text-texto-2">{{ f.descricao }}</span>
            </button>
          </div>
        </section>

        <!-- Tamanho e tempo -->
        <section data-guia="prova-tempo" class="cartao" aria-labelledby="titulo-tempo">
          <h2 id="titulo-tempo" class="titulo-cartao m-0">Tamanho e tempo</h2>
          <dl class="m-0 mt-2">
            <div class="ajuste">
              <dt><b>Questões</b></dt>
              <dd class="flex flex-wrap items-center gap-2">
                <button v-for="n in QUANTIDADES" :key="n" type="button" class="pilula" role="radio" :aria-checked="quantas === n" @click="quantas = n">{{ n }}</button>
                <EntradaContador v-model="quantas" :min="QUANTAS_MIN" :max="QUANTAS_MAX" rotulo="Quantas questões" />
              </dd>
            </div>
            <div class="ajuste">
              <dt><b>Tempo</b><span>Sugerido: {{ duracao(sugerido * 60) }}</span></dt>
              <dd class="flex flex-wrap items-center gap-3">
                <EntradaContador :model-value="minutos" :min="MINUTOS_MIN" :max="MINUTOS_MAX" rotulo="Minutos de prova" @update:model-value="mudarMinutos" />
                <span class="text-[14px] text-texto-2">minutos, {{ duracao(minutos * 60) }}</span>
                <button v-if="tempoMexido" type="button" class="link text-[14px]" @click="mudarMinutos(sugerido)">Usar o sugerido</button>
              </dd>
            </div>
            <div class="ajuste">
              <dt><b>Relógio</b><span>Dá para mostrar ou esconder durante a prova.</span></dt>
              <dd role="radiogroup" aria-label="Relógio" class="flex flex-wrap gap-2">
                <button v-for="r in RELOGIOS" :key="r.id" type="button" class="pilula" role="radio" :aria-checked="relogio === r.id" @click="relogio = r.id">{{ r.nome }}</button>
              </dd>
            </div>
            <div class="ajuste">
              <dt><b>Ordem</b></dt>
              <dd role="radiogroup" aria-label="Ordem" class="flex flex-wrap gap-2">
                <button v-for="o in ORDENS" :key="o.id" type="button" class="pilula" role="radio" :aria-checked="ordem === o.id" @click="ordem = o.id">{{ o.nome }}</button>
              </dd>
            </div>
          </dl>
        </section>

        <!-- Caderno -->
        <section data-guia="prova-caderno" class="cartao" aria-labelledby="titulo-caderno" :aria-busy="carregando">
          <div class="flex flex-wrap items-center justify-between gap-2">
            <h2 id="titulo-caderno" class="titulo-cartao m-0">Caderno</h2>
            <button type="button" class="botao-secundario botao-p gap-1.5" :disabled="carregando || !caderno.length" @click="sortear"><Shuffle :size="15" :stroke-width="2.1" aria-hidden="true" />Sortear outras</button>
          </div>
          <p v-if="erro" class="erro-campo treme mt-3" role="alert"><CircleAlert :size="16" :stroke-width="2.2" aria-hidden="true" />{{ erro }}</p>
          <p v-else-if="lida.erro" class="m-0 mt-2 text-[14px] text-texto-2">{{ lida.erro }}</p>
          <template v-else-if="previa">
            <p v-if="previa.faltam" class="aviso-caderno mt-3">
              Seu banco tem {{ caderno.length }} questões desses assuntos no formato {{ formatoDe(formato).nome }}. A prova fica com {{ caderno.length }}; para chegar a {{ quantas }}, gere mais em <NuxtLink to="/questoes/gerar" class="link">Questões</NuxtLink>.
            </p>
            <ol class="m-0 mt-3 list-none p-0">
              <li v-for="(q, k) in visiveis" :key="q.questaoId" class="grid items-start gap-x-3 gap-y-1 border-t border-borda py-2.5 sm:grid-cols-[28px_minmax(0,1fr)_auto]">
                <span class="pt-0.5 text-[13px] font-semibold tabular-nums text-texto-2">{{ k + 1 }}</span>
                <span class="min-w-0">
                  <TextoRico :texto="enunciadoCurto(q.enunciado, 120)" tag="span" class="block truncate text-[14.5px]" />
                  <span class="mt-0.5 flex items-center gap-1.5 text-[12.5px] text-texto-2">
                    <span class="size-2 shrink-0 rounded-full" :style="{ background: corMateria(nomeAssunto(q.assuntoId)?.cor ?? 'cinza') }" aria-hidden="true" />
                    {{ nomeAssunto(q.assuntoId)?.materia }}, {{ nomeAssunto(q.assuntoId)?.nome }}. {{ nomeDoNivel(q.nivel) }}
                  </span>
                </span>
                <button type="button" class="botao-fantasma botao-p gap-1.5 justify-self-start" :disabled="carregando" :aria-label="`Trocar a questão ${k + 1}`" @click="trocar(q)"><Repeat2 :size="15" :stroke-width="2.1" aria-hidden="true" />Trocar</button>
              </li>
            </ol>
            <button v-if="caderno.length > 8" type="button" class="link mt-2 text-[14px]" :aria-expanded="verTodas" @click="verTodas = !verTodas">{{ verTodas ? 'Mostrar só as primeiras' : `Ver o caderno inteiro (${caderno.length})` }}</button>
          </template>
          <p v-else class="m-0 mt-3 flex items-center gap-2.5 text-[14px] text-texto-2" role="status"><span class="rodando text-acento" aria-hidden="true" />Montando o caderno</p>
        </section>
      </div>

      <!-- Resumo -->
      <aside class="cartao sticky top-[88px] hidden lg:block" aria-labelledby="titulo-resumo">
        <h2 id="titulo-resumo" class="m-0 text-[13px] font-semibold text-texto-2">Resumo da prova</h2>
        <label class="rotulo mt-3" for="titulo-prova">Nome</label>
        <textarea id="titulo-prova" v-model="titulo" class="campo h-auto resize-none py-2.5 leading-snug" rows="2" maxlength="80" autocomplete="off" @keydown.enter.prevent />
        <p class="m-0 mt-4 flex items-baseline gap-2"><span class="numero-medio">{{ caderno.length || quantas }}</span><span class="text-[14px] text-texto-2">questões, {{ formatoDe(formato).nome }}</span></p>
        <p class="m-0 mt-1 text-[14px] text-texto-2">{{ duracao(minutos * 60) }} de prova</p>
        <div v-if="previa?.porMateria?.length" class="mt-4">
          <div class="flex h-2.5 gap-[2px]" aria-hidden="true">
            <span v-for="m in previa.porMateria" :key="m.materia" class="rounded-[3px]" :style="{ flex: m.n, background: corMateria(m.cor ?? 'cinza') }" />
          </div>
          <ul class="m-0 mt-2.5 list-none p-0 text-[13.5px]">
            <li v-for="m in previa.porMateria" :key="m.materia" class="flex justify-between gap-2 border-t border-borda py-1.5"><span>{{ m.materia }}</span><b class="tabular-nums">{{ m.n }}</b></li>
          </ul>
        </div>
        <p v-if="previa?.porNivel" class="m-0 mt-2 text-[13px] text-texto-2">{{ previa.porNivel }}</p>
        <button type="button" class="botao mt-4 w-full gap-2" :aria-busy="comecando" :disabled="comecando || carregando || !caderno.length" @click="comecar">
          <span v-if="comecando" class="rodando" aria-hidden="true" /><Play v-else :size="16" :stroke-width="2.2" aria-hidden="true" />Começar a prova
        </button>
        <p class="m-0 mt-2.5 text-[12.5px] leading-snug text-texto-2">O relógio começa quando você clicar. Dá para sair e voltar, mas ele continua correndo.</p>
      </aside>
    </div>

    <!-- Celular: começar preso embaixo -->
    <div class="fixed inset-x-0 bottom-0 z-10 flex items-center gap-3 border-t border-borda bg-folha px-4 pt-2.5 pb-[calc(10px+env(safe-area-inset-bottom))] lg:hidden">
      <span class="min-w-0 flex-1 text-[13.5px]"><b>{{ caderno.length || quantas }} questões</b><span class="block text-texto-2">{{ duracao(minutos * 60) }}, {{ formatoDe(formato).nome }}</span></span>
      <button type="button" class="botao h-12 gap-2 px-5" :disabled="comecando || carregando || !caderno.length" @click="comecar"><Play :size="16" :stroke-width="2.2" aria-hidden="true" />Começar</button>
    </div>

    <ConjuntoAssuntos ref="janelaAssuntos" v-model="assuntos" :arvore="arvore" titulo="O que cai na prova" />
  </div>
</template>

<style scoped>
.opcao-materia,
.opcao-formato {
  display: flex;
  width: 100%;
  gap: 12px;
  padding: 12px 14px;
  border: 1.5px solid var(--borda);
  border-radius: 14px;
  background: var(--folha);
  color: var(--tinta);
  text-align: left;
  cursor: pointer;
  transition: border-color 0.15s;
}
.opcao-formato {
  flex-direction: column;
  gap: 0;
}
.opcao-materia:hover,
.opcao-formato:hover {
  border-color: var(--borda-forte);
}
.opcao-materia[data-marcada='true'],
.opcao-formato[aria-checked='true'] {
  border-color: var(--acento);
}
.opcao-formato .radio {
  width: 18px;
  height: 18px;
  flex-shrink: 0;
  border: 1.5px solid var(--borda-campo);
  border-radius: 999px;
}
.opcao-formato[aria-checked='true'] .radio {
  border: 5.5px solid var(--acento);
}
.ajuste {
  display: grid;
  gap: 8px 20px;
  padding: 14px 0;
  border-top: 1px solid var(--borda);
}
.ajuste:first-child {
  border-top: 0;
}
.ajuste dt span {
  display: block;
  font-size: 12.5px;
  color: var(--texto-2);
}
.ajuste dd {
  margin: 0;
}
@media (min-width: 640px) {
  .ajuste {
    grid-template-columns: 170px minmax(0, 1fr);
    align-items: center;
  }
}
.aviso-caderno {
  margin-bottom: 0;
  padding: 10px 12px;
  border: 1px solid var(--aviso);
  border-radius: 12px;
  background: var(--aviso-suave);
  font-size: 14px;
}
</style>
