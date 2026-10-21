<script setup>
// Resultados de um tema no Wikilivros, na Wikiversidade e na Wikipédia, já ordenados pensando na matéria.
// "Ver e escolher partes" abre a prévia: as seções da página, para marcar só o que interessa.
// Trazer cria o texto na Biblioteca (já aprovado), com o link e a licença guardados.
// Uso: <FontesWiki :tema="tema" :materia-id="id" :assunto-id="aid" @importou="(id) => ..." />
import { BookOpen, CircleAlert, Download, ExternalLink, Eye, Globe, GraduationCap, SearchX } from '@lucide/vue'
import { FONTES_WIKI } from '#shared/regras/wikipedia.js'
import { nomeDaArea } from '#shared/regras/materias.js'

const props = defineProps({
  tema: { type: String, required: true },
  materiaId: { type: String, default: '' },
  assuntoId: { type: String, default: '' },
  // Limita a um projeto ('' = os três).
  fonte: { type: String, default: '' },
})
const emit = defineEmits(['importou', 'precisa-materia'])

const { data: materias } = useMaterias()
const api = useMateriais()
const { avisar } = useAvisos()
const ICONE = { wikilivros: BookOpen, wikiversidade: GraduationCap, wikipedia: Globe }

const materia = computed(() => (materias.value ?? []).find((m) => m.id === props.materiaId) ?? null)
const assunto = computed(() => materia.value?.assuntos?.find((a) => a.id === props.assuntoId) ?? null)

const resultados = ref([])
const consulta = ref('')
const carregando = ref(false)
const erro = ref('')
let pedido = 0
async function buscar() {
  const tema = props.tema.trim()
  if (!tema) return
  const meu = ++pedido
  carregando.value = true
  erro.value = ''
  try {
    const r = await $fetch('/api/fontes/tema', {
      query: { q: tema, materia: materia.value?.nome, assunto: assunto.value?.nome, area: materia.value?.area, fonte: props.fonte || undefined },
    })
    if (meu !== pedido) return
    resultados.value = r?.resultados ?? []
    consulta.value = r?.consulta ?? tema
  }
  catch (e) {
    if (meu !== pedido) return
    erro.value = e?.data?.statusMessage ?? 'As fontes abertas não responderam agora. Tente de novo em instantes.'
    resultados.value = []
  }
  if (meu === pedido) carregando.value = false
}
watch(() => [props.tema, props.materiaId, props.assuntoId, props.fonte], buscar, { immediate: true })

const minutos = (palavras) => Math.max(1, Math.round((palavras ?? 0) / 200))
const tamanho = (palavras) => `${new Intl.NumberFormat('pt-BR').format(palavras ?? 0)} palavras, leitura de ${minutos(palavras)} min`

// ---------- Prévia ----------
const janela = ref(null)
const previa = ref(null)
const escolhido = ref(null)
const carregandoPrevia = ref(false)
const erroPrevia = ref('')
const marcadas = ref([])
const trazendo = ref(false)
async function ver(r) {
  escolhido.value = r
  previa.value = null
  erroPrevia.value = ''
  marcadas.value = []
  carregandoPrevia.value = true
  janela.value?.abrir()
  try {
    previa.value = await $fetch('/api/fontes/pagina', { query: { fonte: r.fonte, titulo: r.titulo } })
    marcadas.value = previa.value.secoes.map((_, i) => i)
  }
  catch (e) {
    erroPrevia.value = e?.data?.statusMessage ?? 'Não deu para abrir a prévia agora. Tente de novo.'
  }
  carregandoPrevia.value = false
}
const palavrasMarcadas = computed(() => (previa.value?.secoes ?? []).reduce((s, x, i) => s + (marcadas.value.includes(i) ? x.palavras : 0), 0))
const todas = computed(() => previa.value && marcadas.value.length === previa.value.secoes.length)
function alternarTodas() {
  marcadas.value = todas.value ? [] : previa.value.secoes.map((_, i) => i)
}
async function trazer() {
  if (!props.materiaId) {
    erroPrevia.value = 'Escolha a matéria do texto antes de trazer.'
    emit('precisa-materia')
    return
  }
  trazendo.value = true
  erroPrevia.value = ''
  try {
    const todasMarcadas = marcadas.value.length === previa.value.secoes.length
    const r = await api.importarAberto({
      fonte: escolhido.value.fonte,
      titulo: previa.value.titulo,
      materiaId: props.materiaId,
      assuntoId: props.assuntoId || null,
      secoes: todasMarcadas ? null : [...marcadas.value].sort((a, b) => a - b),
    })
    janela.value?.fechar()
    if (r?.status === 'erro') avisar({ texto: 'O texto chegou, mas não deu para ler. Abra o texto na Biblioteca e tente de novo.', tipo: 'erro' })
    else avisar({ texto: 'Texto adicionado à Biblioteca.', tipo: 'ok' })
    emit('importou', r?.id)
  }
  catch (e) {
    erroPrevia.value = e.message
  }
  trazendo.value = false
}
</script>

<template>
  <div>
    <p class="m-0 text-[13.5px] text-texto-2" role="status" aria-live="polite">
      <template v-if="carregando">Procurando "{{ tema }}" em textos abertos...</template>
      <template v-else-if="resultados.length">
        Textos abertos sobre "{{ consulta }}"<template v-if="materia">, escolhidos para {{ materia.nome }} ({{ nomeDaArea(materia.area).toLowerCase() }})</template>.
      </template>
    </p>

    <div v-if="carregando" class="mt-3 grid gap-2" aria-hidden="true">
      <div v-for="i in 3" :key="i" class="flex items-center gap-4 rounded-[14px] border border-borda p-4">
        <span class="esqueleto h-4 w-24 rounded-md" />
        <span class="esqueleto h-4 flex-1 rounded-md" />
        <span class="esqueleto h-9 w-28 rounded-[10px]" />
      </div>
    </div>
    <p v-else-if="erro" class="erro-campo" role="alert"><CircleAlert :size="16" :stroke-width="2" aria-hidden="true" class="mt-px shrink-0" />{{ erro }}</p>
    <div v-else-if="!resultados.length" class="mt-3 flex items-start gap-3 rounded-[14px] bg-folha-2 p-4 text-[14.5px] text-texto-2">
      <SearchX :size="18" :stroke-width="2" aria-hidden="true" class="mt-0.5 shrink-0" />
      <span>Nada encontrado para "{{ tema }}". Tente outra palavra, como o nome de um assunto.</span>
    </div>

    <TransitionGroup v-else name="lista" tag="ul" class="m-0 mt-3 list-none overflow-hidden rounded-[16px] border border-borda p-0">
      <li v-for="(r, i) in resultados" :key="`${r.fonte}:${r.titulo}`" class="resultado">
        <div class="min-w-0 flex-1">
          <p class="m-0 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12.5px] font-semibold text-texto-3">
            <component :is="ICONE[r.fonte]" :size="14" :stroke-width="2.1" aria-hidden="true" />
            {{ FONTES_WIKI[r.fonte].nome }}
            <span v-if="i === 0" class="selo h-[21px] px-[7px] text-[11.5px]" data-tipo="acento">Mais indicado</span>
          </p>
          <h3 class="m-0 mt-1 text-[15.5px] font-bold leading-snug">{{ r.titulo }}</h3>
          <p class="m-0 mt-1 line-clamp-2 text-[14px] leading-snug text-texto-2">{{ r.trecho }}...</p>
          <p class="m-0 mt-1.5 text-[12.5px] text-texto-3">{{ tamanho(r.palavras) }}</p>
        </div>
        <button type="button" class="botao-secundario botao-p shrink-0" :aria-label="`Ver ${r.titulo} e escolher as partes`" @click="ver(r)">
          <Eye :size="16" :stroke-width="2" aria-hidden="true" />Ver e escolher
        </button>
      </li>
    </TransitionGroup>

    <JanelaBase ref="janela" larga :titulo="previa?.titulo ?? escolhido?.titulo ?? 'Prévia'">
      <div v-if="escolhido" class="flex flex-wrap items-center gap-x-3 gap-y-1 text-[13.5px] text-texto-2">
        <span class="inline-flex items-center gap-1.5 font-semibold text-tinta">
          <component :is="ICONE[escolhido.fonte]" :size="15" :stroke-width="2.1" aria-hidden="true" />{{ FONTES_WIKI[escolhido.fonte].nome }}
        </span>
        <span>{{ FONTES_WIKI[escolhido.fonte].descricao }}</span>
        <a :href="previa?.endereco ?? escolhido.endereco" target="_blank" rel="noopener" class="link inline-flex items-center gap-1">
          Abrir no site<ExternalLink :size="13" :stroke-width="2" aria-hidden="true" />
        </a>
      </div>

      <div v-if="carregandoPrevia" class="grid gap-2" aria-busy="true" aria-label="Carregando a prévia">
        <span v-for="i in 4" :key="i" class="esqueleto h-[62px] rounded-[12px]" />
      </div>
      <template v-else-if="previa">
        <div class="flex flex-wrap items-center justify-between gap-2">
          <p class="m-0 text-[14px] text-texto-2"><Fracao :valor="marcadas.length" :total="previa.secoes.length" sem-animacao /> partes, {{ new Intl.NumberFormat('pt-BR').format(palavrasMarcadas) }} palavras</p>
          <button type="button" class="link text-[14px]" @click="alternarTodas">{{ todas ? 'Desmarcar todas' : 'Marcar todas' }}</button>
        </div>
        <ul class="m-0 grid max-h-[46vh] list-none gap-1.5 overflow-auto p-0 pr-1">
          <li v-for="(s, i) in previa.secoes" :key="i">
            <label class="linha-opcao items-start">
              <input v-model="marcadas" type="checkbox" class="marcar mt-0.5" :value="i">
              <span class="min-w-0 flex-1">
                <span class="flex flex-wrap items-baseline justify-between gap-x-3">
                  <b class="text-[14.5px]">{{ s.titulo }}</b>
                  <span class="text-[12.5px] text-texto-3">{{ s.palavras }} palavras</span>
                </span>
                <span class="mt-0.5 line-clamp-2 block text-[13.5px] leading-snug text-texto-2">{{ s.resumo }}</span>
              </span>
            </label>
          </li>
        </ul>
        <p class="m-0 text-[13px] leading-normal text-texto-3">
          Texto aberto, licença {{ previa.licenca }}: dá para usar citando a fonte. O PGC guarda o link junto do texto.
        </p>
      </template>
      <p v-if="erroPrevia" class="erro-campo m-0" role="alert"><CircleAlert :size="16" :stroke-width="2" aria-hidden="true" class="mt-px shrink-0" />{{ erroPrevia }}</p>

      <template #rodape>
        <button type="button" class="botao-fantasma botao-p h-10" @click="janela?.fechar()">Cancelar</button>
        <button type="button" class="botao h-10" :aria-busy="trazendo" :disabled="trazendo || !previa || !marcadas.length" @click="trazer">
          <span v-if="trazendo" class="rodando" aria-hidden="true" />
          <Download v-else :size="17" :stroke-width="2.1" aria-hidden="true" />
          {{ !previa || todas ? 'Trazer o texto' : marcadas.length === 1 ? 'Trazer 1 parte' : `Trazer ${marcadas.length} partes` }}
        </button>
      </template>
    </JanelaBase>
  </div>
</template>

<style scoped>
.resultado {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 14px 16px;
  border-top: 1px solid var(--borda);
  background: var(--folha);
  transition: background-color 0.18s;
}
.resultado:first-child {
  border-top: 0;
}
.resultado:hover {
  background: var(--folha-2);
}
@media (max-width: 559px) {
  .resultado {
    flex-direction: column;
    align-items: stretch;
  }
  .resultado > button {
    align-self: flex-start;
  }
}
</style>
