<script setup>
// "Do que estudar": a matéria, os assuntos (vários; nenhum = a matéria toda) e, se quiser, os textos da Biblioteca.
// Sem texto, a IA escreve a partir do assunto. "Buscar um texto" leva à Biblioteca já com a matéria e o tema
// (lá a pessoa busca em fontes abertas ou envia um arquivo) e depois volta para cá.
import { Clock3, FileText, Library, Plus, Search } from '@lucide/vue'
import { MAX_TEXTOS } from '#shared/regras/gerar.js'

const props = defineProps({
  estado: { type: Object, required: true },
  materias: { type: Array, required: true },
  materiais: { type: Array, required: true },
})
const id = useId()

const materia = computed(() => props.materias.find((m) => m.id === props.estado.materiaId) ?? null)
const opcoesMateria = computed(() => props.materias.map((m) => ({ valor: m.id, texto: m.nome, cor: `${corMateria(m.cor ?? 'cinza')}` })))
const assuntos = computed(() => (materia.value?.assuntos ?? []).filter((a) => !a.arquivado_em))
const opcoesAssuntos = computed(() => assuntos.value.map((a) => ({ valor: a.id, texto: a.nome })))

const daMateria = computed(() => props.materiais.filter((m) => m.materia_id === props.estado.materiaId && !m.arquivado_em))
const prontos = computed(() => daMateria.value.filter((m) => m.paginasConferidas > 0))
const emConferencia = computed(() => daMateria.value.filter((m) => !m.paginasConferidas && ['enviando', 'extraindo', 'aguardando_conferencia'].includes(m.status)))

const linkBuscar = computed(() => {
  const a = assuntos.value.find((x) => x.id === props.estado.assuntoIds[0])
  return { path: '/materiais', query: { adicionar: '1', materia: props.estado.materiaId, ...(a ? { tema: a.nome } : {}) } }
})

function alternarTexto(tid) {
  const lista = props.estado.textos
  const i = lista.indexOf(tid)
  if (i >= 0) lista.splice(i, 1)
  else if (lista.length < MAX_TEXTOS) lista.push(tid)
}
const paginas = (n) => `${n} ${n === 1 ? 'página conferida' : 'páginas conferidas'}`
const ajudaAssuntos = computed(() => {
  if (!opcoesAssuntos.value.length) return 'Esta matéria ainda não tem assuntos. As questões cobrem a matéria toda.'
  if (!props.estado.assuntoIds.length) return 'Nenhum marcado: as questões cobrem a matéria toda.'
  return ''
})
</script>

<template>
  <div>
    <div class="grid gap-x-4 gap-y-4 sm:grid-cols-[minmax(0,240px)_minmax(0,1fr)]">
      <div>
        <label class="rotulo" :for="`${id}-materia`">Matéria</label>
        <Selecao :id="`${id}-materia`" v-model="estado.materiaId" :opcoes="opcoesMateria" />
      </div>
      <div class="min-w-0 max-w-[460px]">
        <label class="rotulo" :for="`${id}-assuntos`">Assuntos</label>
        <Selecao
          :id="`${id}-assuntos`"
          v-model="estado.assuntoIds"
          multiplo
          :opcoes="opcoesAssuntos"
          texto-vazio="A matéria toda"
          :desativado="!opcoesAssuntos.length"
          :descrito="ajudaAssuntos ? `${id}-assuntos-ajuda` : undefined"
        />
        <p v-if="ajudaAssuntos" :id="`${id}-assuntos-ajuda`" class="ajuda">{{ ajudaAssuntos }}</p>
      </div>
    </div>

    <div class="mt-6">
      <p :id="`${id}-textos`" class="rotulo">Textos de base <span class="font-medium text-texto-3">(opcional)</span></p>

      <template v-if="prontos.length">
        <ul class="m-0 flex max-w-[640px] list-none flex-col gap-1 p-0" :aria-labelledby="`${id}-textos`">
          <li v-for="t in prontos" :key="t.id">
            <label class="linha-opcao items-center">
              <input
                type="checkbox"
                class="marcar"
                :checked="estado.textos.includes(t.id)"
                :disabled="!estado.textos.includes(t.id) && estado.textos.length >= MAX_TEXTOS"
                @change="alternarTexto(t.id)"
              >
              <FileText :size="18" :stroke-width="2" class="shrink-0 text-texto-2" aria-hidden="true" />
              <span class="min-w-0 flex-1">
                <span class="block truncate text-[15px] font-semibold">{{ t.titulo }}</span>
                <span class="block text-[13px] text-texto-2">{{ paginas(t.paginasConferidas) }}</span>
              </span>
              <span v-if="t.ia_permitida === 'nenhuma'" class="selo" data-tipo="aviso">não vai para IA</span>
            </label>
          </li>
        </ul>
        <p class="ajuda flex flex-wrap items-center gap-x-3 gap-y-1">
          <span>{{ estado.textos.length ? 'As questões seguem o que está nos textos marcados.' : 'Sem texto marcado, a IA escreve a partir do assunto.' }}</span>
          <NuxtLink :to="linkBuscar" class="link inline-flex items-center gap-1"><Plus :size="15" :stroke-width="2.2" aria-hidden="true" />Adicionar outro texto</NuxtLink>
        </p>
      </template>

      <div v-else class="painel flex max-w-[640px] flex-col gap-3 sm:flex-row sm:items-center">
        <Library :size="22" :stroke-width="1.9" class="hidden shrink-0 text-texto-2 sm:block" aria-hidden="true" />
        <p class="m-0 flex-1 text-[14px] leading-[1.5] text-texto-2">
          <b class="font-semibold text-tinta">Sem texto, a IA escreve a partir do assunto,</b> com o que os livros do ensino médio trazem.
          Com um texto seu, as questões seguem o que você estudou.
        </p>
        <NuxtLink :to="linkBuscar" class="botao-secundario botao-p shrink-0 no-underline">
          <Search :size="16" :stroke-width="2.2" aria-hidden="true" />
          Buscar um texto
        </NuxtLink>
      </div>

      <p v-if="emConferencia.length" class="m-0 mt-2.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[13.5px] text-texto-2">
        <Clock3 :size="15" :stroke-width="2" class="shrink-0" aria-hidden="true" />
        <span>"{{ emConferencia[0].titulo }}" ainda está em conferência<template v-if="emConferencia.length > 1"> (e mais {{ emConferencia.length - 1 }})</template>.</span>
        <NuxtLink :to="`/materiais/${emConferencia[0].id}`" class="link">Conferir as páginas</NuxtLink>
      </p>
    </div>
  </div>
</template>
