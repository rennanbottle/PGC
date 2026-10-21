<script setup>
// Criar ou editar um item da agenda. Tipo numa fileira de ícones; título, data, hora e duração; matéria e assuntos;
// em "Mais opções", notas e "Repetir toda semana até". Item de uma série pergunta "Só este" ou "Este e os próximos"
// antes de salvar ou apagar. Uso: janela.value.abrir({ evento }) para editar, abrir({ dia, tipo }) para criar.
import { ChevronDown, CircleAlert } from '@lucide/vue'
import { DURACOES, LIMITES_EVENTO, NOME_TIPO, TIPOS_EVENTO, formatarDuracao, somarDias, validarEvento } from '#shared/regras/agenda.js'
import { assuntosAtivos } from '#shared/regras/materias.js'

const props = defineProps({ hoje: { type: String, required: true } })
const emit = defineEmits(['salvou', 'excluiu', 'criou-prova'])
const api = useAgenda()
const { data: materias } = useMaterias()
const { avisar } = useAvisos()
const id = useId()
const janela = ref(null)
const original = ref(null)
const f = reactive({ tipo: 'estudo', titulo: '', data: '', hora: '', duracao: '', materia: '', assuntos: [], notas: '', repetir: false, repetirAte: '' })
const erros = ref({})
const ocupado = ref(false)
const mais = ref(false)
const pergunta = ref(null)
const tremer = ref(0)
let tituloAutomatico = ''

const FEMININOS = new Set(['prova', 'tarefa'])
const ativas = computed(() => (materias.value ?? []).filter((m) => !m.arquivada_em))
const materia = computed(() => ativas.value.find((m) => m.id === f.materia) ?? null)
const opcoesMateria = computed(() => [{ valor: '', texto: 'Nenhuma' }, ...ativas.value.map((m) => ({ valor: m.id, texto: m.nome, cor: `${corMateria(m.cor)}` }))])
const opcoesAssunto = computed(() => assuntosAtivos(materia.value).map((a) => ({ valor: a.id, texto: a.nome })))
const opcoesDuracao = computed(() => {
  const lista = [...DURACOES]
  if (f.duracao && !lista.includes(Number(f.duracao))) lista.push(Number(f.duracao))
  return [{ valor: '', texto: 'Sem duração' }, ...lista.sort((a, b) => a - b).map((d) => ({ valor: String(d), texto: formatarDuracao(d) }))]
})
const tipoAtual = computed(() => TIPOS_EVENTO.find((t) => t.id === f.tipo))
const textoBotao = computed(() => (original.value ? 'Salvar alterações' : `Criar ${NOME_TIPO[f.tipo].toLowerCase()}`))

// Prova e trabalho ganham o título "Prova de Matemática" enquanto a pessoa não escreve outro.
watch(() => [f.tipo, f.materia], () => {
  const valido = new Set(opcoesAssunto.value.map((o) => o.valor))
  f.assuntos = f.assuntos.filter((a) => valido.has(a))
  const sugestao = materia.value && ['prova', 'trabalho'].includes(f.tipo) ? `${NOME_TIPO[f.tipo]} de ${materia.value.nome}` : ''
  // Só troca o título quando ele está vazio ou ainda é a sugestão anterior.
  if (!f.titulo.trim() || f.titulo === tituloAutomatico) f.titulo = sugestao
  tituloAutomatico = sugestao
})
watch(() => f.repetir, (sim) => {
  if (sim && !f.repetirAte) f.repetirAte = somarDias(f.data || props.hoje, 28)
})

function abrir({ evento = null, dia = null, tipo = null } = {}) {
  original.value = evento
  Object.assign(f, {
    tipo: evento?.tipo ?? (NOME_TIPO[tipo] ? tipo : 'estudo'),
    titulo: evento?.titulo ?? '',
    data: evento?.data ?? dia ?? props.hoje,
    hora: evento?.hora ? String(evento.hora).slice(0, 5) : '',
    duracao: evento?.duracao_min ? String(evento.duracao_min) : '',
    materia: evento?.materia_id ?? '',
    assuntos: [...(evento?.assuntos ?? [])],
    notas: evento?.notas ?? '',
    repetir: false,
    repetirAte: '',
  })
  tituloAutomatico = evento ? '' : f.titulo
  erros.value = {}
  pergunta.value = null
  mais.value = !!evento?.notas
  janela.value?.abrir()
}

function dados() {
  return {
    tipo: f.tipo,
    titulo: f.titulo.trim(),
    data: f.data,
    hora: f.hora || null,
    duracao_min: f.duracao ? Number(f.duracao) : null,
    materia_id: f.materia || null,
    assuntos: [...f.assuntos],
    notas: f.notas.trim() || null,
  }
}

async function salvar(modo = null) {
  const novo = dados()
  erros.value = validarEvento({ ...novo, repetirAte: !original.value && f.repetir ? f.repetirAte : null })
  if (Object.keys(erros.value).length) {
    tremer.value++
    if (erros.value.notas || erros.value.repetirAte) mais.value = true
    return
  }
  if (original.value?.serie && !modo) {
    pergunta.value = 'salvar'
    return
  }
  ocupado.value = true
  try {
    if (original.value) {
      await api.atualizar(original.value, novo, modo ?? 'so')
      avisar({ texto: 'Alterações salvas.', tipo: 'ok' })
      emit('salvou', { ...original.value, ...novo })
    }
    else {
      const criados = await api.criar(novo, f.repetir ? f.repetirAte : null)
      const nome = NOME_TIPO[novo.tipo]
      const criado = FEMININOS.has(novo.tipo) ? 'criada' : 'criado'
      if (novo.tipo === 'prova' && criados[0]) emit('criou-prova', criados[0])
      else avisar({ texto: criados.length > 1 ? `${nome} ${criado} em ${criados.length} semanas.` : `${nome} ${criado}.`, tipo: 'ok' })
      emit('salvou', criados[0] ?? null)
    }
    janela.value?.fechar()
  }
  catch (e) {
    erros.value = { geral: e.message }
  }
  ocupado.value = false
}

async function excluir(modo = null) {
  if (original.value?.serie && !modo) {
    pergunta.value = 'excluir'
    return
  }
  ocupado.value = true
  try {
    const linhas = await api.excluir(original.value, modo ?? 'so')
    janela.value?.fechar()
    emit('excluiu', linhas)
  }
  catch (e) {
    erros.value = { geral: e.message }
  }
  ocupado.value = false
}

const responder = (modo) => (pergunta.value === 'salvar' ? salvar(modo) : excluir(modo))
defineExpose({ abrir })
</script>

<template>
  <JanelaBase ref="janela" :titulo="original ? 'Editar item' : 'Novo item na agenda'" larga>
    <form :id="`${id}-form`" class="flex flex-col gap-5" novalidate @submit.prevent="salvar()">
      <fieldset class="m-0 min-w-0 border-0 p-0">
        <legend class="rotulo">Tipo</legend>
        <div class="ag-tipos">
          <label v-for="t in TIPOS_EVENTO" :key="t.id" class="ag-tipo" :class="f.tipo === t.id && 'ag-tipo-ativo'">
            <input v-model="f.tipo" type="radio" :name="`${id}-tipo`" :value="t.id" class="so-leitor">
            <AgendaIconeTipo :tipo="t.id" :tamanho="20" />
            <span>{{ t.nome }}</span>
          </label>
        </div>
        <p class="ajuda m-0 mt-1.5">{{ tipoAtual?.descricao }}</p>
      </fieldset>

      <div class="max-w-[520px]">
        <label class="rotulo" :for="`${id}-titulo`">Título</label>
        <input :id="`${id}-titulo`" :key="`t${tremer}`" v-model="f.titulo" class="campo" :class="erros.titulo && tremer && 'treme'" type="text" :maxlength="LIMITES_EVENTO.titulo" :aria-invalid="!!erros.titulo || undefined" :aria-describedby="erros.titulo ? `${id}-titulo-erro` : undefined" @input="erros.titulo = ''">
        <p v-if="erros.titulo" :id="`${id}-titulo-erro`" class="erro-campo m-0" role="alert"><CircleAlert :size="16" :stroke-width="2" aria-hidden="true" class="mt-px shrink-0" />{{ erros.titulo }}</p>
      </div>

      <div class="flex flex-wrap gap-x-3 gap-y-4">
        <div class="w-[172px]">
          <label class="rotulo" :for="`${id}-data`">Data</label>
          <input :id="`${id}-data`" v-model="f.data" class="campo ag-campo-data" type="date" required :aria-invalid="!!erros.data || undefined">
          <p v-if="erros.data" class="erro-campo m-0" role="alert">{{ erros.data }}</p>
        </div>
        <div class="w-[132px]">
          <label class="rotulo" :for="`${id}-hora`">Hora</label>
          <input :id="`${id}-hora`" v-model="f.hora" class="campo ag-campo-data" type="time" :aria-describedby="`${id}-hora-ajuda`">
          <p :id="`${id}-hora-ajuda`" class="ajuda m-0">Pode ficar vazia.</p>
        </div>
        <div class="w-[160px]">
          <label class="rotulo" :for="`${id}-duracao`">Duração</label>
          <Selecao :id="`${id}-duracao`" v-model="f.duracao" :opcoes="opcoesDuracao" />
        </div>
      </div>

      <div class="grid max-w-[600px] gap-4 sm:grid-cols-2">
        <div>
          <label class="rotulo" :for="`${id}-materia`">Matéria</label>
          <Selecao :id="`${id}-materia`" v-model="f.materia" :opcoes="opcoesMateria" />
        </div>
        <div v-if="opcoesAssunto.length">
          <label class="rotulo" :for="`${id}-assuntos`">Assuntos</label>
          <Selecao :id="`${id}-assuntos`" v-model="f.assuntos" multiplo :opcoes="opcoesAssunto" texto-vazio="Nenhum" />
        </div>
      </div>

      <div>
        <button type="button" class="botao-fantasma botao-p" :aria-expanded="mais" :aria-controls="`${id}-mais`" @click="mais = !mais">
          <ChevronDown :size="16" :stroke-width="2" aria-hidden="true" class="transition-transform" :class="mais && 'rotate-180'" />Mais opções
        </button>
        <Transition name="abre">
          <div v-if="mais" :id="`${id}-mais`" class="flex max-w-[600px] flex-col gap-4 pt-3">
            <div>
              <label class="rotulo" :for="`${id}-notas`">Notas</label>
              <textarea :id="`${id}-notas`" v-model="f.notas" class="campo min-h-[96px] resize-y py-2.5 leading-normal" :maxlength="LIMITES_EVENTO.notas" />
              <p v-if="erros.notas" class="erro-campo m-0" role="alert">{{ erros.notas }}</p>
            </div>
            <div v-if="!original">
              <label class="linha-opcao">
                <input v-model="f.repetir" type="checkbox" class="so-leitor">
                <span class="caixa" aria-hidden="true" />
                <span class="min-w-0 flex-1">
                  <span class="block text-[14.5px] font-semibold">Repetir toda semana</span>
                  <span class="block text-[13px] text-texto-2">Uma cópia por semana, no mesmo dia da semana.</span>
                </span>
              </label>
              <Transition name="abre">
                <div v-if="f.repetir" class="w-[172px] pl-1 pt-2">
                  <label class="rotulo" :for="`${id}-ate`">Até o dia</label>
                  <input :id="`${id}-ate`" v-model="f.repetirAte" class="campo ag-campo-data" type="date" :min="f.data" :aria-invalid="!!erros.repetirAte || undefined">
                  <p v-if="erros.repetirAte" class="erro-campo m-0" role="alert">{{ erros.repetirAte }}</p>
                </div>
              </Transition>
            </div>
          </div>
        </Transition>
      </div>
      <p v-if="erros.geral" class="erro-campo m-0" role="alert"><CircleAlert :size="16" :stroke-width="2" aria-hidden="true" class="mt-px shrink-0" />{{ erros.geral }}</p>
    </form>

    <template #rodape>
      <template v-if="pergunta">
        <p class="m-0 mr-auto text-[14.5px] font-semibold">{{ pergunta === 'salvar' ? 'Mudar só este ou este e os próximos?' : 'Apagar só este ou este e os próximos?' }}</p>
        <button type="button" class="botao-secundario h-10" :disabled="ocupado" @click="responder('so')">Só este</button>
        <button type="button" class="botao h-10" :class="pergunta === 'excluir' && 'botao-perigo'" :aria-busy="ocupado" :disabled="ocupado" @click="responder('proximos')">Este e os próximos</button>
      </template>
      <template v-else>
        <BotaoLixeira v-if="original" class="mr-auto" :rotulo="`Apagar ${original.titulo}`" :desativado="ocupado" @click="excluir()" />
        <button type="button" class="botao-fantasma botao-p h-10" @click="janela?.fechar()">Cancelar</button>
        <button type="submit" :form="`${id}-form`" class="botao h-10" :aria-busy="ocupado" :disabled="ocupado">{{ textoBotao }}</button>
      </template>
    </template>
  </JanelaBase>
</template>

<style>
/* Flex e não grid com fr: a janela mede o próprio conteúdo, e colunas fr cresceriam até a largura máxima do texto. */
.ag-tipos { display: flex; flex-wrap: wrap; gap: 6px; max-width: 600px; }
.ag-tipo { display: flex; flex: 1 1 86px; min-width: 0; min-height: 64px; flex-direction: column; align-items: center; justify-content: center; gap: 5px; padding: 8px 4px; border: 1px solid var(--color-borda); border-radius: 14px; background: var(--color-folha); color: var(--color-texto-2); font-size: 13px; font-weight: 600; cursor: pointer; transition: border-color 0.15s ease, background-color 0.15s ease, color 0.15s ease, transform 0.15s ease; }
.ag-tipo:hover { border-color: var(--color-borda-forte); color: var(--color-tinta); }
.ag-tipo:active { transform: scale(0.97); }
.ag-tipo:has(:focus-visible) { outline: 2px solid var(--color-acento); outline-offset: 2px; }
.ag-tipo-ativo { border-color: var(--color-acento); background: var(--color-acento-suave); color: var(--color-acento); }
.ag-campo-data { font-variant-numeric: tabular-nums; }
.ag-campo-data::-webkit-calendar-picker-indicator { opacity: 0.55; cursor: pointer; transition: opacity 0.15s ease; }
.ag-campo-data:hover::-webkit-calendar-picker-indicator { opacity: 1; }
@media (prefers-reduced-motion: reduce) { .ag-tipo { transition: none; } .ag-tipo:active { transform: none; } }
:root.menos-movimento .ag-tipo:active { transform: none; }
</style>
