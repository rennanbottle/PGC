<script setup>
// Prova em andamento, em modo foco: uma questão por vez, o cartão-resposta ao lado e o relógio em cima.
// Nada é corrigido antes de entregar: cada resposta fica guardada (pode mudar à vontade) e a nota sai de uma vez.
// O tempo corre mesmo fora da tela; avisos aos 10 e aos 5 minutos; quando zera, a prova é entregue sozinha com o
// que estiver marcado. Teclado: 1 a 5 escolhem, setas mudam de questão, M marca para voltar.
import { ArrowLeft, ArrowRight, CircleAlert, Clock, Eye, EyeOff, Flag, LayoutList, LogOut, Send } from '@lucide/vue'
import { AVISOS_TEMPO, relogio, relogioVisivel, respostaPreenchida } from '#shared/regras/provas.js'

definePageMeta({ layout: 'foco' })
const route = useRoute()
const id = String(route.params.id)
const api = useProvas()
const { data, error } = await useFetch(`/api/provas/${id}`)
if (error.value) throw createError({ statusCode: error.value.statusCode ?? 500, statusMessage: error.value.statusMessage ?? 'Não deu para abrir a prova.', fatal: true })
// Entregue (ou o tempo acabou e o servidor entregou): vai para o resultado.
if (data.value?.prova?.status && data.value.prova.status !== 'em_andamento') await navigateTo(`/prova/${id}/resultado`, { replace: true })
useHead({ title: () => `${data.value?.prova?.titulo ?? 'Prova'} | PGC` })

const prova = computed(() => data.value?.prova ?? {})
const itens = computed(() => data.value?.itens ?? [])
const assuntos = computed(() => data.value?.assuntos ?? {})
const respostas = reactive(Object.fromEntries(itens.value.map((i) => [i.id, i.resposta ?? {}])))
const marcadas = reactive(Object.fromEntries(itens.value.map((i) => [i.id, !!i.marcada])))
const atual = ref(Math.min(Math.max(0, prova.value.atual ?? 0), Math.max(0, itens.value.length - 1)))
const item = computed(() => itens.value[atual.value])
const questao = ref(null)

const respondidas = computed(() => itens.value.filter((i) => respostaPreenchida(i.tipo, respostas[i.id])).length)
const emBranco = computed(() => itens.value.map((i, k) => (respostaPreenchida(i.tipo, respostas[i.id]) ? null : k + 1)).filter(Boolean))
const nMarcadas = computed(() => itens.value.filter((i) => marcadas[i.id]).length)

// ---------- Relógio ----------
// O servidor manda quanto falta; o fim é contado a partir do relógio deste aparelho (sem depender da hora certa dele).
const fim = Date.now() + Math.max(0, prova.value.restante ?? 0) * 1000
const restante = ref(Math.max(0, prova.value.restante ?? 0))
const mostrarRelogio = ref(relogioVisivel(prova.value.relogio, restante.value))
const avisoTempo = ref('')
let avisados = new Set(AVISOS_TEMPO.filter((s) => restante.value <= s))
let tique = null
let apagarAviso = null
function contar() {
  restante.value = Math.max(0, Math.round((fim - Date.now()) / 1000))
  for (const s of AVISOS_TEMPO) {
    if (restante.value <= s && !avisados.has(s)) {
      avisados = new Set([...avisados, s])
      avisoTempo.value = `Faltam ${s / 60} minutos.`
      if (prova.value.relogio !== 'escondido') mostrarRelogio.value = true
      clearTimeout(apagarAviso)
      apagarAviso = setTimeout(() => (avisoTempo.value = ''), 8000)
    }
  }
  if (restante.value === 0 && !entregando.value) entregar(true)
}

// ---------- Guardar ----------
// Cada mudança vai para o servidor meio segundo depois, junto com o tempo gasto na questão (só informação).
const estadoSalvo = ref('') // '', 'guardando', 'guardado', 'falhou'
const pendentes = new Map()
const salvas = Object.fromEntries(itens.value.map((i) => [i.id, JSON.stringify(i.resposta ?? {})]))
let espera = null
let inicioItem = Date.now()
function juntar(itemId, extra) {
  const antes = pendentes.get(itemId) ?? { itemId }
  pendentes.set(itemId, { ...antes, ...extra, segundos: (antes.segundos ?? 0) + (extra.segundos ?? 0) })
}
function guardarDepois(itemId, extra) {
  juntar(itemId, extra)
  estadoSalvo.value = 'guardando'
  clearTimeout(espera)
  espera = setTimeout(enviarPendentes, 500)
}
// Tempo na questão aberta desde a última vez que ele foi contado.
function contarTempoDoItem() {
  const it = item.value
  const seg = Math.round((Date.now() - inicioItem) / 1000)
  inicioItem = Date.now()
  if (it && seg > 0) juntar(it.id, { segundos: Math.min(3600, seg) })
}
async function enviarPendentes() {
  const lote = [...pendentes.values()]
  pendentes.clear()
  try {
    for (const p of lote) {
      const r = await api.guardar(id, { ...p, atual: atual.value })
      if (p.resposta) salvas[p.itemId] = JSON.stringify(p.resposta)
      if (r?.entregue) return navigateTo(`/prova/${id}/resultado`, { replace: true })
    }
    estadoSalvo.value = pendentes.size ? 'guardando' : 'guardado'
  }
  catch {
    for (const p of lote) if (!pendentes.has(p.itemId)) pendentes.set(p.itemId, p)
    estadoSalvo.value = 'falhou'
  }
}
watch(() => item.value && JSON.stringify(respostas[item.value.id] ?? {}), (agora) => {
  const it = item.value
  if (it && agora !== salvas[it.id]) guardarDepois(it.id, { resposta: respostas[it.id] })
})

// ---------- Navegar ----------
const celularCartao = ref(null)
function ir(k) {
  if (k < 0 || k >= itens.value.length) return
  contarTempoDoItem()
  atual.value = k
  celularCartao.value?.fechar?.()
  if (import.meta.client) window.scrollTo({ top: 0, behavior: 'auto' })
}
function alternarMarca() {
  const it = item.value
  marcadas[it.id] = !marcadas[it.id]
  guardarDepois(it.id, { marcada: marcadas[it.id] })
}
function teclado(e) {
  if (e.target?.closest?.('input, textarea, select, [contenteditable="true"]') || e.ctrlKey || e.metaKey || e.altKey) return
  if (janelaEntregar.value?.aberta || janelaSair.value?.aberta) return
  if (e.key === 'ArrowRight') ir(atual.value + 1)
  else if (e.key === 'ArrowLeft') ir(atual.value - 1)
  else if (e.key === 'm' || e.key === 'M') alternarMarca()
  else if (/^[1-9]$/.test(e.key)) questao.value?.escolher?.(Number(e.key) - 1)
}

// ---------- Entregar e sair ----------
const janelaEntregar = ref(null)
const janelaSair = ref(null)
const entregando = ref(false)
const erro = ref('')
async function entregar(porTempo = false) {
  entregando.value = true
  erro.value = ''
  try {
    clearTimeout(espera)
    contarTempoDoItem()
    await enviarPendentes()
    await api.entregar(id, { porTempo })
    await navigateTo(`/prova/${id}/resultado${porTempo ? '?tempo=1' : ''}`, { replace: true })
  }
  catch (e) {
    erro.value = e.message
    entregando.value = false
  }
}
async function sairDepois() {
  clearTimeout(espera)
  contarTempoDoItem()
  await enviarPendentes()
  await navigateTo('/prova')
}

// Trocou de aba ou fechou: conta o tempo e guarda o que faltava.
function aoEsconder() {
  if (document.visibilityState !== 'hidden') {
    inicioItem = Date.now()
    return
  }
  contarTempoDoItem()
  if (pendentes.size) enviarPendentes()
}
onMounted(() => {
  tique = setInterval(contar, 1000)
  window.addEventListener('keydown', teclado)
  document.addEventListener('visibilitychange', aoEsconder)
})
onBeforeUnmount(() => {
  clearInterval(tique)
  window.removeEventListener('keydown', teclado)
  document.removeEventListener('visibilitychange', aoEsconder)
  if (pendentes.size) enviarPendentes()
})
const textoBranco = computed(() => {
  const n = emBranco.value.length
  if (!n) return 'Todas as questões têm resposta.'
  const lista = emBranco.value.slice(0, 8).join(', ')
  return `${n === 1 ? 'Ficou 1 em branco' : `Ficaram ${n} em branco`}: ${lista}${n > 8 ? ' e outras' : ''}.`
})
</script>

<template>
  <div v-if="item" class="pb-28 lg:pb-12">
    <header class="sticky top-0 z-10 border-b border-borda bg-folha">
      <div class="mx-auto flex max-w-[1240px] items-center gap-3 px-4 py-3 sm:gap-5 sm:px-8">
        <span class="min-w-0 flex-1">
          <b class="block truncate text-[14.5px]">{{ prova.titulo }}</b>
          <span class="block text-[12.5px] text-texto-2">Questão {{ atual + 1 }} de {{ itens.length }}<span class="hidden sm:inline">, <Fracao :valor="respondidas" :total="itens.length" sem-animacao /> respondidas</span></span>
        </span>
        <span class="flex shrink-0 items-center gap-1" role="timer" :aria-label="`Tempo restante: ${relogio(restante)}`">
          <span
            v-if="mostrarRelogio"
            class="flex items-center gap-1.5 rounded-[10px] px-2.5 py-1.5 text-[15px] font-semibold tabular-nums"
            :class="restante <= 300 ? 'bg-aviso-suave text-aviso' : 'bg-folha-2'"
          ><Clock :size="15" :stroke-width="2" aria-hidden="true" />{{ relogio(restante) }}</span>
          <button v-if="prova.relogio !== 'sempre' || mostrarRelogio" type="button" class="botao-icone pequeno" :aria-label="mostrarRelogio ? 'Esconder o relógio' : 'Mostrar o relógio'" :aria-pressed="mostrarRelogio" @click="mostrarRelogio = !mostrarRelogio">
            <EyeOff v-if="mostrarRelogio" :size="16" :stroke-width="2" aria-hidden="true" /><Eye v-else :size="16" :stroke-width="2" aria-hidden="true" />
          </button>
        </span>
        <button type="button" class="botao-icone pequeno sm:hidden" aria-label="Sair da prova" @click="janelaSair?.abrir()"><LogOut :size="16" :stroke-width="2" aria-hidden="true" /></button>
        <button type="button" class="botao-secundario botao-p hidden shrink-0 gap-1.5 sm:inline-flex" @click="janelaSair?.abrir()"><LogOut :size="15" :stroke-width="2" aria-hidden="true" />Sair</button>
        <button type="button" class="botao botao-p shrink-0 gap-1.5" @click="janelaEntregar?.abrir()"><Send :size="15" :stroke-width="2" aria-hidden="true" />Entregar</button>
      </div>
      <Transition name="desliza">
        <p v-if="avisoTempo" class="m-0 border-t border-borda bg-aviso-suave px-4 py-2 text-center text-[14px] font-semibold text-aviso" role="status">{{ avisoTempo }}</p>
      </Transition>
    </header>

    <div class="mx-auto grid max-w-[1240px] items-start gap-10 px-4 pt-6 sm:px-8 sm:pt-10 lg:grid-cols-[minmax(0,1fr)_292px]">
      <div class="mx-auto w-full min-w-0 max-w-[780px]">
        <SessaoQuestao :key="item.id" ref="questao" v-model="respostas[item.id]" :item="item" :numero="atual + 1" :assunto="assuntos[item.assuntoId]" sem-nivel />
        <p v-if="erro" :key="erro" class="erro-campo treme mt-4" role="alert"><CircleAlert :size="16" :stroke-width="2.2" aria-hidden="true" />{{ erro }}</p>

        <div class="mt-7 hidden flex-wrap items-center gap-2.5 border-t border-borda pt-5 lg:flex">
          <button type="button" class="botao-secundario gap-2" :disabled="atual === 0" aria-keyshortcuts="ArrowLeft" @click="ir(atual - 1)"><ArrowLeft :size="16" :stroke-width="2.2" aria-hidden="true" />Anterior</button>
          <button type="button" class="botao-secundario gap-2" :class="marcadas[item.id] && 'marcada'" :aria-pressed="marcadas[item.id]" aria-keyshortcuts="M" @click="alternarMarca">
            <Flag :size="16" :stroke-width="2" aria-hidden="true" />{{ marcadas[item.id] ? 'Marcada para voltar' : 'Marcar para voltar' }}
          </button>
          <span class="ml-auto text-[13px]" :class="estadoSalvo === 'falhou' ? 'text-erro' : 'text-texto-3'" role="status">
            {{ estadoSalvo === 'guardando' ? 'Guardando' : estadoSalvo === 'guardado' ? 'Resposta guardada' : estadoSalvo === 'falhou' ? 'Sem conexão. Guardo quando voltar.' : '' }}
          </span>
          <button v-if="atual < itens.length - 1" type="button" class="botao min-w-[150px] gap-2" aria-keyshortcuts="ArrowRight" @click="ir(atual + 1)">Próxima<ArrowRight :size="16" :stroke-width="2.2" aria-hidden="true" /></button>
          <button v-else type="button" class="botao min-w-[150px] gap-2" @click="janelaEntregar?.abrir()"><Send :size="16" :stroke-width="2.2" aria-hidden="true" />Entregar a prova</button>
        </div>
      </div>

      <aside class="sticky top-[84px] hidden max-h-[calc(100dvh-104px)] flex-col lg:flex" aria-labelledby="titulo-cartao">
        <div class="flex items-baseline justify-between gap-2 pb-2.5">
          <h2 id="titulo-cartao" class="m-0 text-[14px] font-semibold">Cartão-resposta</h2>
          <span class="text-[12.5px] text-texto-2"><Fracao :valor="respondidas" :total="itens.length" sem-animacao /></span>
        </div>
        <div class="min-h-0 flex-1 overflow-y-auto rounded-[12px] border border-borda">
          <ProvaCartaoResposta :itens="itens" :respostas="respostas" :marcadas="marcadas" :atual="atual" @ir="ir" />
        </div>
        <p class="m-0 mt-2.5 text-[12.5px] leading-snug text-texto-2">
          {{ emBranco.length ? `${emBranco.length} em branco` : 'Nenhuma em branco' }}<template v-if="nMarcadas">, {{ nMarcadas }} {{ nMarcadas === 1 ? 'marcada' : 'marcadas' }} para voltar</template>. Dá para mudar qualquer resposta até entregar.
        </p>
      </aside>
    </div>

    <!-- Celular: ações presas embaixo -->
    <div class="fixed inset-x-0 bottom-0 z-10 flex items-center gap-2 border-t border-borda bg-folha px-3 pt-2.5 pb-[calc(10px+env(safe-area-inset-bottom))] lg:hidden">
      <button type="button" class="acao-celular" :disabled="atual === 0" @click="ir(atual - 1)"><ArrowLeft :size="18" :stroke-width="2" aria-hidden="true" />Anterior</button>
      <button type="button" class="acao-celular" :class="marcadas[item.id] && 'marcada'" :aria-pressed="marcadas[item.id]" @click="alternarMarca"><Flag :size="18" :stroke-width="2" aria-hidden="true" />Marcar</button>
      <button type="button" class="acao-celular" aria-haspopup="dialog" @click="celularCartao?.abrir()"><LayoutList :size="18" :stroke-width="2" aria-hidden="true" />Cartão</button>
      <button v-if="atual < itens.length - 1" type="button" class="botao h-12 flex-1 px-3" @click="ir(atual + 1)">Próxima</button>
      <button v-else type="button" class="botao h-12 flex-1 px-3" @click="janelaEntregar?.abrir()">Entregar</button>
    </div>

    <JanelaBase ref="celularCartao" titulo="Cartão-resposta" :descricao="`${respondidas} de ${itens.length} respondidas. Toque numa linha para ir até a questão.`">
      <div class="rounded-[12px] border border-borda">
        <ProvaCartaoResposta :itens="itens" :respostas="respostas" :marcadas="marcadas" :atual="atual" @ir="ir" />
      </div>
    </JanelaBase>

    <JanelaBase ref="janelaEntregar" titulo="Entregar a prova?" :descricao="`Você respondeu ${respondidas} de ${itens.length}. Depois de entregar, as respostas não mudam mais.`">
      <p class="m-0 text-[14.5px]">{{ textoBranco }}</p>
      <p v-if="nMarcadas" class="m-0 mt-2 text-[14.5px]">{{ nMarcadas === 1 ? 'Uma questão está marcada' : `${nMarcadas} questões estão marcadas` }} para voltar.</p>
      <p class="m-0 mt-2 text-[14.5px] text-texto-2">Ainda faltam {{ relogio(restante) }} de prova.</p>
      <template #rodape>
        <button type="button" class="botao-secundario" @click="janelaEntregar?.fechar()">Voltar à prova</button>
        <button type="button" class="botao gap-2" :aria-busy="entregando" :disabled="entregando" @click="entregar()"><span v-if="entregando" class="rodando" aria-hidden="true" />Entregar e ver a nota</button>
      </template>
    </JanelaBase>

    <JanelaBase ref="janelaSair" titulo="Sair da prova?" descricao="Suas respostas ficam guardadas, mas o relógio continua correndo. Se o tempo acabar, a prova é entregue com o que estiver marcado.">
      <template #rodape>
        <button type="button" class="botao-secundario" @click="sairDepois">Sair e voltar depois</button>
        <button type="button" class="botao" @click="janelaSair?.fechar()">Continuar a prova</button>
      </template>
    </JanelaBase>
  </div>
</template>

<style scoped>
.botao-secundario.marcada {
  border-color: var(--acento);
  color: var(--acento);
}
.acao-celular {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  width: 64px;
  height: 48px;
  border: 1px solid var(--borda-campo);
  border-radius: 12px;
  background: var(--folha);
  color: var(--tinta);
  font-size: 11.5px;
  font-weight: 600;
  cursor: pointer;
}
.acao-celular:disabled {
  opacity: 0.4;
}
.acao-celular.marcada {
  border-color: var(--acento);
  color: var(--acento);
}
</style>
