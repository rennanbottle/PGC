<script setup>
// Criar ou editar uma meta: o que contar (questões, minutos, estudos ou assuntos dominados), quanto, de qual matéria e
// quando (toda semana ou até uma data). "Dominar assuntos" é sempre até uma data. Embaixo, a frase de como a meta vai
// aparecer. Uso: janela.value.abrir() para criar, abrir(meta) para editar.
import { BookOpenCheck, CircleAlert, ListChecks, Timer, Trophy } from '@lucide/vue'
import { LIMITES_META, LISTA_TIPOS_META, TIPOS_META, tituloDaMeta } from '#shared/regras/metas.js'
import { somarDias } from '#shared/regras/agenda.js'

const props = defineProps({ hoje: { type: String, required: true } })
const api = useMetas()
const { data: materias } = useMaterias()
const { avisar } = useAvisos()
const id = useId()
const janela = ref(null)
const original = ref(null)
const f = reactive({ tipo: 'questoes', alvo: '100', materia: '', periodo: 'semana', prazo: '' })
const erros = ref({})
const ocupado = ref(false)

const ICONES = { questoes: ListChecks, minutos: Timer, estudos: BookOpenCheck, dominar: Trophy }
const DESCRICOES = {
  questoes: 'Conta cada questão respondida, nos estudos e nas provas.',
  minutos: 'Soma o tempo gasto respondendo questões.',
  estudos: 'Conta os estudos e provas concluídos.',
  dominar: 'Conta os assuntos que estão Dominados. Sempre com uma data.',
}
const ativas = computed(() => (materias.value ?? []).filter((m) => !m.arquivada_em))
const opcoesMateria = computed(() => [{ valor: '', texto: 'Todas as matérias' }, ...ativas.value.map((m) => ({ valor: m.id, texto: m.nome, cor: `${corMateria(m.cor)}` }))])
const tipo = computed(() => TIPOS_META[f.tipo])
const soComData = computed(() => !tipo.value.semana)
const nomeMateria = computed(() => ativas.value.find((m) => m.id === f.materia)?.nome ?? '')
const previa = computed(() => {
  const alvo = Number(f.alvo)
  if (!Number.isInteger(alvo) || alvo < 1) return ''
  const periodo = soComData.value ? 'data' : f.periodo
  if (periodo === 'data' && !f.prazo) return ''
  return tituloDaMeta({ tipo: f.tipo, alvo, periodo, prazo: f.prazo }, nomeMateria.value)
})

// Ao trocar de tipo numa meta nova, a quantidade sugerida acompanha (se a pessoa ainda não mudou).
let sugerido = '100'
watch(() => f.tipo, (t) => {
  if (!original.value && f.alvo === sugerido) f.alvo = String(TIPOS_META[t].sugestao)
  sugerido = String(TIPOS_META[t].sugestao)
  if (!TIPOS_META[t].semana) f.periodo = 'data'
  if (f.periodo === 'data' && !f.prazo) f.prazo = somarDias(props.hoje, 30)
  erros.value = {}
})
watch(() => f.periodo, (p) => {
  if (p === 'data' && !f.prazo) f.prazo = somarDias(props.hoje, 30)
})

function abrir(meta = null) {
  original.value = meta
  Object.assign(f, {
    tipo: meta?.tipo ?? 'questoes',
    alvo: String(meta?.alvo ?? TIPOS_META.questoes.sugestao),
    materia: meta?.materia_id ?? '',
    periodo: meta?.periodo ?? 'semana',
    prazo: meta?.prazo ?? '',
  })
  sugerido = String(TIPOS_META[f.tipo].sugestao)
  erros.value = {}
  janela.value?.abrir()
}

async function salvar() {
  if (ocupado.value) return
  ocupado.value = true
  try {
    const r = await api.salvar({ tipo: f.tipo, alvo: f.alvo, periodo: f.periodo, prazo: f.prazo, materia_id: f.materia || null }, original.value)
    if (r.erros) erros.value = r.erros
    else {
      avisar({ texto: original.value ? 'Meta atualizada.' : 'Meta criada.', tipo: 'ok' })
      janela.value?.fechar()
    }
  }
  catch (e) {
    erros.value = { geral: e.message }
  }
  ocupado.value = false
}

defineExpose({ abrir })
</script>

<template>
  <JanelaBase ref="janela" :titulo="original ? 'Editar meta' : 'Nova meta'" larga>
    <form :id="`${id}-form`" class="flex flex-col gap-5" novalidate @submit.prevent="salvar()">
      <fieldset class="m-0 min-w-0 border-0 p-0">
        <legend class="rotulo">O que contar</legend>
        <div class="ag-tipos">
          <label v-for="t in LISTA_TIPOS_META" :key="t.id" class="ag-tipo" :class="f.tipo === t.id && 'ag-tipo-ativo'">
            <input v-model="f.tipo" type="radio" :name="`${id}-tipo`" :value="t.id" class="so-leitor">
            <component :is="ICONES[t.id]" :size="20" :stroke-width="2" aria-hidden="true" />
            <span>{{ t.nome }}</span>
          </label>
        </div>
        <p class="ajuda m-0 mt-1.5">{{ DESCRICOES[f.tipo] }}</p>
      </fieldset>

      <div class="grid gap-4 sm:grid-cols-2">
        <div>
          <label class="rotulo" :for="`${id}-alvo`">{{ tipo.feminino ? 'Quantas' : 'Quantos' }} {{ tipo.varios }}</label>
          <input :id="`${id}-alvo`" v-model="f.alvo" class="campo tabular-nums" type="number" inputmode="numeric" min="1" :max="LIMITES_META.alvo" step="1" :aria-invalid="!!erros.alvo || undefined" :aria-describedby="erros.alvo ? `${id}-alvo-erro` : undefined" @input="erros.alvo = ''">
          <p v-if="erros.alvo" :id="`${id}-alvo-erro`" class="erro-campo m-0" role="alert"><CircleAlert :size="16" :stroke-width="2" aria-hidden="true" class="mt-px shrink-0" />{{ erros.alvo }}</p>
        </div>
        <div>
          <label class="rotulo" :for="`${id}-materia`">Matéria</label>
          <Selecao :id="`${id}-materia`" v-model="f.materia" :opcoes="opcoesMateria" />
        </div>
      </div>

      <fieldset class="m-0 min-w-0 border-0 p-0">
        <legend class="rotulo">Quando</legend>
        <div class="flex flex-wrap gap-2">
          <label v-if="!soComData" class="linha-opcao min-w-[200px] items-center border border-borda">
            <input v-model="f.periodo" type="radio" class="escolher" :name="`${id}-periodo`" value="semana"><span class="text-[15px]">Toda semana</span>
          </label>
          <label class="linha-opcao min-w-[200px] items-center border border-borda">
            <input v-model="f.periodo" type="radio" class="escolher" :name="`${id}-periodo`" value="data"><span class="text-[15px]">Até uma data</span>
          </label>
        </div>
        <p v-if="!soComData && f.periodo === 'semana'" class="ajuda m-0 mt-1.5">A semana vai de domingo a sábado. Toda semana a conta começa do zero.</p>
        <div v-if="soComData || f.periodo === 'data'" class="mt-3 max-w-[240px]">
          <label class="rotulo" :for="`${id}-prazo`">Até o dia</label>
          <input :id="`${id}-prazo`" v-model="f.prazo" class="campo ag-campo-data" type="date" :min="hoje" :aria-invalid="!!erros.prazo || undefined" :aria-describedby="erros.prazo ? `${id}-prazo-erro` : undefined" @input="erros.prazo = ''">
          <p v-if="erros.prazo" :id="`${id}-prazo-erro`" class="erro-campo m-0" role="alert"><CircleAlert :size="16" :stroke-width="2" aria-hidden="true" class="mt-px shrink-0" />{{ erros.prazo }}</p>
        </div>
      </fieldset>

      <p v-if="previa" class="m-0 rounded-[12px] bg-folha-2 px-4 py-3 text-[14.5px]" aria-live="polite">
        <span class="text-texto-2">A meta vai aparecer assim:</span> <b class="font-semibold">{{ previa }}</b>
      </p>
      <p v-if="erros.geral || erros.tipo" class="erro-campo m-0" role="alert"><CircleAlert :size="16" :stroke-width="2" aria-hidden="true" class="mt-px shrink-0" />{{ erros.geral || erros.tipo }}</p>
    </form>

    <template #rodape>
      <button type="button" class="botao-fantasma botao-p h-10" @click="janela?.fechar()">Cancelar</button>
      <button type="submit" :form="`${id}-form`" class="botao h-10" :aria-busy="ocupado" :disabled="ocupado">{{ original ? 'Salvar alterações' : 'Criar meta' }}</button>
    </template>
  </JanelaBase>
</template>
