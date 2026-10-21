<script setup>
// Importar prova: prova antiga, lista de exercícios ou planilha. Um arquivo por vez.
// A caixa aceita arrastar ou escolher; ao arrastar por cima, ela acende. Depois de lido, abre a tela de conferência,
// onde a pessoa confere cada questão antes de ela entrar no banco.
import { ChevronDown, FileSpreadsheet, FileText, FileUp, Upload } from '@lucide/vue'
import { conferirArquivoBanco, mensagemErroBanco } from '#shared/regras/bancos.js'
import { formatarTamanho } from '#shared/regras/materiais.js'

const props = defineProps({ materiaInicial: { type: String, default: '' } })
const emit = defineEmits(['fechar'])
const id = useId()
const api = useBancos()
const { data: materias } = useMaterias()
const ativas = computed(() => (materias.value ?? []).filter((m) => !m.arquivada_em))
const opcoesMateria = computed(() => ativas.value.map((m) => ({ valor: m.id, texto: m.nome, cor: `${corMateria(m.cor ?? 'cinza')}` })))
// Matéria: a do filtro da tela ou, com uma matéria só, ela. Com várias, a pessoa escolhe (evita importar na errada).
const materiaId = ref(props.materiaInicial || '')
watch(ativas, (l) => {
  if (!materiaId.value && l.length === 1) materiaId.value = l[0].id
}, { immediate: true })

const escolhido = ref(null)
const erro = ref('')
const tremer = ref(0)
const estado = ref('esperando')
const progresso = ref(0)
const arrastando = ref(false)
const seletor = ref(null)
const verExemplo = ref(false)
let controle = null

function falhar(texto) {
  erro.value = texto
  tremer.value++
}
function usar(arquivo) {
  erro.value = ''
  estado.value = 'esperando'
  if (!arquivo) return
  const r = conferirArquivoBanco(arquivo)
  if (r.erro) {
    escolhido.value = null
    return falhar(r.erro)
  }
  escolhido.value = { arquivo, ...r }
}
const soltar = (e) => {
  arrastando.value = false
  usar(e.dataTransfer?.files?.[0])
}
const escolher = (e) => {
  usar(e.target.files?.[0])
  e.target.value = ''
}

async function importar() {
  erro.value = ''
  if (!escolhido.value) return falhar('Escolha o arquivo da prova.')
  if (!materiaId.value) return falhar('Escolha a matéria das questões.')
  estado.value = 'enviando'
  progresso.value = 0
  controle = new AbortController()
  try {
    const r = await api.importar(
      { arquivo: escolhido.value.arquivo, formato: escolhido.value.formato, titulo: escolhido.value.titulo, materiaId: materiaId.value },
      (p) => {
        progresso.value = p
        if (p >= 100) estado.value = 'lendo'
      },
      controle.signal,
    )
    if (r.status === 'erro') {
      estado.value = 'erro'
      return falhar(r.mensagem || mensagemErroBanco(r.erro))
    }
    emit('fechar')
    await navigateTo(`/questoes/importar/${r.id}`)
  }
  catch (e) {
    estado.value = e.cancelado ? 'esperando' : 'erro'
    if (!e.cancelado) falhar(e.message)
  }
}
const ocupado = computed(() => estado.value === 'enviando' || estado.value === 'lendo')
const planilha = computed(() => ['csv', 'xlsx'].includes(escolhido.value?.formato))
</script>

<template>
  <form class="flex flex-col gap-5" novalidate @submit.prevent="importar">
    <!-- Caixa de arrastar ou escolher -->
    <button
      :key="`caixa-${tremer}`"
      type="button"
      class="caixa-arquivo"
      :class="[arrastando && 'arrastando', tremer && erro && 'treme']"
      :disabled="ocupado"
      :aria-describedby="`${id}-formatos`"
      @click="seletor?.click()"
      @dragover.prevent="arrastando = true"
      @dragleave="arrastando = false"
      @drop.prevent="soltar"
    >
      <Upload :size="26" :stroke-width="1.9" class="icone-subir" aria-hidden="true" />
      <b class="text-[16px]">{{ arrastando ? 'Pode soltar' : 'Arraste a prova aqui' }}</b>
      <span class="text-[14px] text-texto-2">ou <span class="font-semibold text-acento">escolha o arquivo</span></span>
    </button>
    <p :id="`${id}-formatos`" class="ajuda -mt-3">PDF com texto, DOCX, TXT, CSV ou XLSX. Até 10 MB.</p>
    <input ref="seletor" type="file" accept=".pdf,.docx,.txt,.csv,.xlsx" hidden @change="escolher">

    <Transition name="abre">
      <div v-if="escolhido" class="flex items-center gap-3 rounded-[14px] border border-borda px-3.5 py-3">
        <component :is="planilha ? FileSpreadsheet : FileText" :size="22" :stroke-width="1.9" class="shrink-0 text-texto-2" aria-hidden="true" />
        <div class="min-w-0 flex-1">
          <div class="flex items-baseline justify-between gap-3 text-[14.5px]">
            <b class="truncate">{{ escolhido.arquivo.name }}</b>
            <span class="shrink-0 tabular-nums text-texto-2">{{ formatarTamanho(escolhido.arquivo.size) }}<template v-if="estado === 'enviando'">, {{ progresso }}%</template></span>
          </div>
          <div v-if="estado === 'enviando'" class="barra mt-2" role="progressbar" :aria-valuenow="progresso" aria-valuemin="0" aria-valuemax="100" aria-label="Envio do arquivo">
            <i :style="{ width: `${progresso}%` }" />
          </div>
          <p v-else-if="estado === 'lendo'" class="m-0 mt-1 flex items-center gap-2 text-[13.5px] text-texto-2" role="status">
            <span class="rodando" aria-hidden="true" />Procurando as questões e o gabarito
          </p>
        </div>
        <button v-if="estado === 'enviando'" type="button" class="botao-fantasma botao-p shrink-0" @click="controle?.abort()">Cancelar envio</button>
      </div>
    </Transition>

    <div class="max-w-[360px]">
      <label class="rotulo" :for="`${id}-materia`">Matéria das questões</label>
      <Selecao :id="`${id}-materia`" v-model="materiaId" :opcoes="opcoesMateria" :desativado="ocupado" texto-vazio="Escolha a matéria" :invalido="!!erro && !materiaId" />
      <p class="ajuda">O assunto de cada questão é sugerido pelas palavras dela. Você confere antes de aprovar.</p>
    </div>

    <div>
      <button type="button" class="botao-fantasma botao-p -ml-2.5" :aria-expanded="verExemplo" :aria-controls="`${id}-exemplo`" @click="verExemplo = !verExemplo">
        <ChevronDown :size="16" :stroke-width="2" class="transition-transform" :class="verExemplo && 'rotate-180'" aria-hidden="true" />Como o arquivo precisa estar
      </button>
      <Transition name="abre">
        <div v-if="verExemplo" :id="`${id}-exemplo`">
          <div class="painel mt-2 text-[14px] leading-[1.55]">
            <p class="m-0 text-texto-2">Cada questão começa com o número, as alternativas têm letra e o gabarito fica no fim. Assim:</p>
            <pre class="exemplo m-0 mt-2.5">1. Quanto é 3 × 4?
a) 7   b) 12   c) 34   d) 1

2) Qual é o plural de "pão"?
(A) pãos   (B) pães   (C) pãoes

Gabarito: 1-B, 2-B</pre>
            <p class="m-0 mt-2.5 text-texto-2">Planilha: uma coluna "enunciado", as alternativas nas colunas A a E e a resposta na coluna "gabarito".</p>
          </div>
        </div>
      </Transition>
    </div>

    <p v-if="erro" class="erro-campo m-0" role="alert">{{ erro }}</p>

    <div class="flex flex-wrap items-center justify-end gap-2.5 border-t border-borda pt-4">
      <button type="button" class="botao-fantasma" @click="emit('fechar')">Cancelar</button>
      <button type="submit" class="botao" :aria-busy="ocupado" :disabled="ocupado">
        <span v-if="ocupado" class="rodando" aria-hidden="true" />
        <FileUp v-else :size="18" :stroke-width="2" aria-hidden="true" />
        {{ estado === 'lendo' ? 'Lendo a prova' : estado === 'enviando' ? 'Enviando' : 'Importar prova' }}
      </button>
    </div>
  </form>
</template>

<style scoped>
.caixa-arquivo {
  display: grid;
  place-items: center;
  gap: 6px;
  width: 100%;
  padding: 30px 24px;
  border: 1.5px solid transparent;
  border-radius: 18px;
  background: var(--folha-2);
  color: var(--tinta);
  font: inherit;
  text-align: center;
  cursor: pointer;
  transition: background-color 0.18s, border-color 0.18s, transform 0.18s;
}
.caixa-arquivo:hover {
  background: var(--folha-3);
}
.caixa-arquivo:focus-visible {
  outline: 2px solid var(--acento);
  outline-offset: 2px;
}
.caixa-arquivo.arrastando {
  border-color: var(--acento);
  background: var(--acento-suave);
  transform: scale(1.01);
}
.caixa-arquivo:disabled {
  cursor: default;
  opacity: 0.6;
}
.icone-subir {
  color: var(--texto-2);
  transition: transform 0.25s cubic-bezier(0.2, 0.8, 0.2, 1), color 0.18s;
}
.caixa-arquivo:hover .icone-subir,
.caixa-arquivo.arrastando .icone-subir {
  color: var(--acento);
  transform: translateY(-3px);
}
.exemplo {
  padding: 12px 14px;
  border-radius: 12px;
  background: var(--folha);
  color: var(--tinta);
  font-family: var(--font-mono, monospace);
  font-size: 12.5px;
  line-height: 1.6;
  white-space: pre-wrap;
}
@media (prefers-reduced-motion: reduce) {
  .caixa-arquivo,
  .icone-subir { transition: none; }
  .caixa-arquivo.arrastando { transform: none; }
}
:global(:root.menos-movimento) .caixa-arquivo.arrastando {
  transform: none;
}
</style>
