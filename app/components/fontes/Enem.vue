<script setup>
// Questões do Enem (2009 a 2023) pela API enem.dev. Escolhe ano e área, carrega a prova, marca as questões e
// importa para o banco com o gabarito oficial e a figura. Questão com alternativas em imagem fica de fora.
import { AREAS_ENEM, ANOS_ENEM, LINGUAS_ENEM, MAX_IMPORTAR_ENEM } from '#shared/regras/enem.js'
import { assuntosAtivos } from '#shared/regras/materias.js'

const props = defineProps({
  materia: { type: Object, default: null },
})
const id = useId()
const ano = ref(ANOS_ENEM[0])
const area = ref('matematica')
const lingua = ref('ingles')
const questoes = ref([])
const carregando = ref(false)
const carregou = ref(false)
const erro = ref('')
const marcadas = ref(new Set())
const assuntoId = ref('')
const importando = ref(false)
const resultado = ref(null)

const assuntos = computed(() => assuntosAtivos(props.materia))
const opcoesAno = ANOS_ENEM.map((a) => ({ valor: a, texto: String(a) }))
const opcoesAssunto = computed(() => [{ valor: '', texto: 'Sugerir pelo texto de cada questão' }, ...assuntos.value.map((a) => ({ valor: a.id, texto: a.nome }))])
const MOTIVO = { 'alternativas em imagem': 'alternativas em imagem, fica de fora', 'mais de uma figura': 'mais de uma figura, fica de fora', 'gabarito ausente': 'sem gabarito na API, fica de fora', 'sem enunciado': 'sem texto, fica de fora', 'sem alternativas': 'sem alternativas, fica de fora', 'figura fora do enem.dev': 'figura de outro site, fica de fora' }
const nomeArea = (a) => AREAS_ENEM.find((x) => x.id === a)?.nome ?? 'Outra'
const importaveis = computed(() => questoes.value.filter((q) => !q.motivo && !q.importada))

async function carregar() {
  erro.value = ''
  resultado.value = null
  carregando.value = true
  try {
    const r = await $fetch('/api/fontes/enem', { query: { ano: ano.value, area: area.value || undefined, lingua: lingua.value } })
    questoes.value = r.questoes
    marcadas.value = new Set()
    carregou.value = true
  }
  catch (e) {
    erro.value = e?.data?.statusMessage ?? 'A API do Enem não respondeu agora. Tente de novo.'
  }
  carregando.value = false
}
function alternar(q) {
  const s = new Set(marcadas.value)
  if (s.has(q.chave)) s.delete(q.chave)
  else if (s.size < MAX_IMPORTAR_ENEM) s.add(q.chave)
  marcadas.value = s
}
const todasMarcadas = computed(() => importaveis.value.length > 0 && importaveis.value.slice(0, MAX_IMPORTAR_ENEM).every((q) => marcadas.value.has(q.chave)))
function marcarTodas() {
  marcadas.value = todasMarcadas.value ? new Set() : new Set(importaveis.value.slice(0, MAX_IMPORTAR_ENEM).map((q) => q.chave))
}

async function importar() {
  erro.value = ''
  if (!props.materia) {
    erro.value = 'Escolha a matéria das questões.'
    return
  }
  importando.value = true
  try {
    resultado.value = await $fetch('/api/fontes/enem', { method: 'POST', body: { ano: ano.value, chaves: [...marcadas.value], materiaId: props.materia.id, assuntoId: assuntoId.value || null } })
    for (const q of questoes.value) if (marcadas.value.has(q.chave)) q.importada = true
    marcadas.value = new Set()
    refreshNuxtData(['questoes-resumo', 'questoes-lista'])
  }
  catch (e) {
    erro.value = e?.data?.statusMessage ?? 'Não deu para importar agora. Tente de novo.'
  }
  importando.value = false
}
</script>

<template>
  <div class="flex flex-col gap-5">
    <div class="flex flex-wrap items-end gap-x-5 gap-y-4">
      <div class="w-[130px]">
        <label class="rotulo" :for="`${id}-ano`">Ano</label>
        <Selecao :id="`${id}-ano`" v-model="ano" :opcoes="opcoesAno" />
      </div>
      <fieldset class="m-0 min-w-0 border-0 p-0">
        <legend class="rotulo">Área</legend>
        <div class="flex flex-wrap gap-2">
          <label v-for="a in [{ id: '', nome: 'Todas' }, ...AREAS_ENEM]" :key="a.id" class="pilula">
            <input v-model="area" type="radio" :name="`${id}-area`" :value="a.id" class="so-leitor">{{ a.nome }}
          </label>
        </div>
      </fieldset>
      <fieldset v-if="!area || area === 'linguagens'" class="m-0 min-w-0 border-0 p-0">
        <legend class="rotulo">Língua estrangeira</legend>
        <div class="flex gap-2">
          <label v-for="l in LINGUAS_ENEM" :key="l.id" class="pilula">
            <input v-model="lingua" type="radio" :name="`${id}-lingua`" :value="l.id" class="so-leitor">{{ l.nome }}
          </label>
        </div>
      </fieldset>
      <button type="button" class="botao-secundario h-[50px] px-4" :aria-busy="carregando" :disabled="carregando" @click="carregar">{{ carregando ? 'Carregando' : 'Carregar a prova' }}</button>
    </div>
    <p v-if="carregando" class="m-0 text-[14px] text-texto-2" role="status">A API do Enem entrega uma parte por segundo. A primeira vez leva uns 5 segundos.</p>

    <EntradaAvisoErro :mensagem="erro" />
    <EntradaAvisoSucesso
      v-if="resultado"
      :mensagem="`${resultado.importadas} ${resultado.importadas === 1 ? 'questão entrou' : 'questões entraram'} no banco${resultado.repetidas ? `; ${resultado.repetidas} já estavam lá` : ''}${resultado.semFigura ? `; ${resultado.semFigura} sem a figura, fora das revisões até você anexar` : ''}.`"
    />

    <template v-if="carregou">
      <div class="flex flex-wrap items-baseline justify-between gap-3">
        <p class="m-0 text-[13.5px] text-texto-2" role="status">
          {{ questoes.length }} questões de {{ ano }}<template v-if="area"> em {{ nomeArea(area) }}</template>. {{ importaveis.length }} podem entrar.
        </p>
        <button v-if="importaveis.length" type="button" class="link text-[14px]" @click="marcarTodas">{{ todasMarcadas ? 'Desmarcar todas' : `Marcar ${Math.min(importaveis.length, MAX_IMPORTAR_ENEM)}` }}</button>
      </div>
      <ul class="m-0 flex max-h-[560px] list-none flex-col gap-0.5 overflow-auto rounded-[16px] border border-borda bg-folha p-2" aria-label="Questões da prova">
        <li v-for="q in questoes" :key="q.chave">
          <label class="linha-opcao">
            <input type="checkbox" class="so-leitor" :checked="marcadas.has(q.chave)" :disabled="!!q.motivo || q.importada" @change="alternar(q)">
            <span class="caixa" aria-hidden="true" />
            <span class="min-w-0 flex-1">
              <span class="flex flex-wrap items-baseline gap-x-2">
                <b class="text-[14.5px] tabular-nums">Questão {{ q.numero }}</b>
                <span class="text-[12.5px] text-texto-2">{{ nomeArea(q.area) }}<template v-if="q.lingua">, {{ q.lingua === 'ingles' ? 'inglês' : 'espanhol' }}</template><template v-if="q.figura">, com figura</template></span>
              </span>
              <span class="block text-[13.5px] leading-snug text-texto-2">{{ q.trecho }}</span>
              <span v-if="q.importada" class="mt-0.5 block text-[12.5px] font-semibold text-ok">já está no banco</span>
              <span v-else-if="q.motivo" class="mt-0.5 block text-[12.5px] font-semibold text-texto-2">{{ MOTIVO[q.motivo] ?? 'fica de fora' }}</span>
            </span>
          </label>
        </li>
      </ul>

      <div class="grid gap-4 rounded-[16px] bg-folha-2 p-4 sm:grid-cols-[1fr_auto] sm:items-end">
        <div>
          <label class="rotulo" :for="`${id}-assunto`">Assunto em {{ materia?.nome ?? 'nenhuma matéria' }}</label>
          <Selecao :id="`${id}-assunto`" v-model="assuntoId" :opcoes="opcoesAssunto" />
        </div>
        <button type="button" class="botao h-[50px]" :aria-busy="importando" :disabled="!marcadas.size || importando || !materia" @click="importar">
          {{ importando ? 'Importando' : marcadas.size ? `Importar ${marcadas.size} ${marcadas.size === 1 ? 'questão' : 'questões'}` : 'Importar' }}
        </button>
      </div>
      <p class="ajuda m-0">Entram com o gabarito oficial e a fonte ("Enem {{ ano }}, questão N"), no nível Normal até você responder. Até {{ MAX_IMPORTAR_ENEM }} por vez.</p>
    </template>
  </div>
</template>
