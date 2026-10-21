<script setup>
// Lista de matérias: uma linha por matéria (cor, nome, área, assuntos, questões, domínio e o que vence hoje).
// Busca e filtros só aparecem quando a lista cresce. Arquivadas ficam num botão no fim da lista.
// "?nova=1" abre a janela de nova matéria (busca geral e primeiros passos); "&nome=" já preenche o nome.
import { Archive, ArchiveRestore, ArrowDown, ArrowLeft, ArrowUp, Pencil, Plus, Search } from '@lucide/vue'
import { materiasParaComecar, normalizar } from '#shared/regras/catalogo.js'
import { OPCOES_ORDEM, assuntosAtivos, filtrarMaterias, moverNaLista, nomeDaArea, proximaCor } from '#shared/regras/materias.js'

useHead({ title: 'Matérias | PGC' })

const route = useRoute()
const router = useRouter()
const api = useMaterias()
const { data: materias, error, pending } = api
const { data: numeros } = useNumerosMaterias()
const { data: perfil } = usePerfil()
const { avisar } = useAvisos()

const filtros = reactive({ busca: '', area: '', arquivadas: false, ordem: 'manual' })
const ativas = computed(() => (materias.value ?? []).filter((m) => !m.arquivada_em))
const arquivadas = computed(() => (materias.value ?? []).filter((m) => m.arquivada_em))
const lista = computed(() => filtrarMaterias(materias.value, filtros, numeros.value.estados, numeros.value.porMateria))
const mostrarFiltros = computed(() => ativas.value.length >= 6)
const temFiltro = computed(() => !!(filtros.busca.trim() || filtros.area))
const carregando = computed(() => pending.value && !(materias.value ?? []).length)
const vazio = computed(() => !carregando.value && !error.value && !(materias.value ?? []).length)

const plural = (n, um, varios) => `${n} ${n === 1 ? um : varios}`
const resumo = computed(() => {
  if (!ativas.value.length) return 'Cada matéria guarda os assuntos, os textos e as questões de uma disciplina.'
  const assuntos = ativas.value.reduce((s, m) => s + assuntosAtivos(m).length, 0)
  const vencidas = ativas.value.reduce((s, m) => s + (numeros.value.porMateria[m.id]?.vencidas ?? 0), 0)
  const base = `${plural(ativas.value.length, 'matéria', 'matérias')} e ${plural(assuntos, 'assunto', 'assuntos')}.`
  return vencidas ? `${base} ${plural(vencidas, 'questão vence', 'questões vencem')} hoje.` : base
})

const opcoesArea = computed(() => [
  { valor: '', texto: 'Todas' },
  ...[...new Set(ativas.value.map((m) => m.area))].map((id) => ({ valor: id, texto: nomeDaArea(id), icone: ICONES_AREA[id] })),
])
const opcoesOrdem = OPCOES_ORDEM.map((o) => ({ valor: o.id, texto: o.nome }))
const ordemLigada = (v) => v !== 'manual'
function limparFiltros() {
  filtros.busca = ''
  filtros.area = ''
}

// Atalhos do catálogo para a primeira matéria (criam na hora e abrem a página).
const atalhos = computed(() => materiasParaComecar(perfil.value?.areas_interesse ?? [], (materias.value ?? []).map((m) => m.nome), 6))
const criandoAtalho = ref('')
async function criarDoCatalogo(m) {
  if (criandoAtalho.value) return
  criandoAtalho.value = m.id
  try {
    const usadas = new Set(ativas.value.map((x) => x.cor))
    const id = await api.criarMateria({ nome: m.nome, area: m.area, cor: usadas.has(m.cor) ? proximaCor(ativas.value) : m.cor })
    avisar({ texto: 'Matéria criada.', tipo: 'ok' })
    await navigateTo(`/materias/${id}`)
  }
  catch (e) {
    avisar({ texto: e.message, tipo: 'erro' })
  }
  criandoAtalho.value = ''
}

const janela = ref(null)
function abrirSePedido() {
  if (route.query.nova !== '1') return
  janela.value?.abrirNova(typeof route.query.nome === 'string' ? route.query.nome : '')
  router.replace({ query: {} })
}
onMounted(() => watch(() => route.query.nova, abrirSePedido, { immediate: true }))

async function tentar(acao, texto) {
  try {
    await acao()
    if (texto) avisar({ texto, tipo: 'ok' })
  }
  catch (e) {
    avisar({ texto: e.message, tipo: 'erro' })
  }
}

// Excluir com confirmação que diz o que sai junto.
const confirmar = ref(null)
const alvo = ref(null)
const excluindo = ref(false)
const textoExclusao = computed(() => {
  const n = alvo.value?.assuntos?.length ?? 0
  const q = numeros.value.porMateria[alvo.value?.id]?.questoes ?? 0
  const partes = [n ? plural(n, 'assunto', 'assuntos') : '', q ? plural(q, 'questão', 'questões') : ''].filter(Boolean)
  return `Isso apaga a matéria${partes.length ? `, com ${partes.join(' e ')}` : ''}. Os textos dela também saem. Não dá para desfazer.`
})
async function confirmarExclusao() {
  excluindo.value = true
  await tentar(() => api.excluirMateria(alvo.value.id), 'Matéria excluída.')
  excluindo.value = false
  confirmar.value?.fechar()
}

const manual = computed(() => filtros.ordem === 'manual' && !filtros.arquivadas && !temFiltro.value)
function acoesDe(m) {
  if (m.arquivada_em) {
    return [
      { id: 'restaurar', texto: 'Restaurar', icone: ArchiveRestore },
      { id: 'excluir', texto: 'Excluir', perigo: true, separar: true },
    ]
  }
  const ids = ativas.value.map((x) => x.id)
  const i = ids.indexOf(m.id)
  return [
    { id: 'editar', texto: 'Editar nome, área e cor', icone: Pencil },
    ...(manual.value ? [
      { id: 'subir', texto: 'Mover para cima', icone: ArrowUp, desativado: i <= 0 },
      { id: 'descer', texto: 'Mover para baixo', icone: ArrowDown, desativado: i >= ids.length - 1 },
    ] : []),
    { id: 'arquivar', texto: 'Arquivar', icone: Archive },
    { id: 'excluir', texto: 'Excluir', perigo: true, separar: true },
  ]
}
function acao(m, id) {
  if (id === 'editar') return janela.value?.abrirEditar(m)
  if (id === 'subir' || id === 'descer') {
    const ids = moverNaLista(ativas.value.map((x) => x.id), m.id, id === 'subir' ? -1 : 1)
    return tentar(() => api.reordenarMaterias(ids))
  }
  if (id === 'arquivar') return tentar(() => api.arquivarMateria(m.id, true), 'Matéria arquivada.')
  if (id === 'restaurar') return tentar(() => api.arquivarMateria(m.id, false), 'Matéria restaurada.')
  if (id === 'excluir') {
    alvo.value = m
    confirmar.value?.abrir()
  }
}
watch(() => arquivadas.value.length, (n) => {
  if (!n) filtros.arquivadas = false
})
</script>

<template>
  <div>
    <CabecalhoPagina titulo="Matérias" :descricao="resumo">
      <template #acoes>
        <BotaoAdicionar data-guia="materias-nova" aria-haspopup="dialog" @click="janela?.abrirNova()">Nova matéria</BotaoAdicionar>
      </template>
    </CabecalhoPagina>

    <p v-if="error" class="erro-campo m-0" role="alert">Não deu para carregar as matérias. Confira a internet e recarregue a página.</p>

    <!-- Nenhuma matéria ainda -->
    <div v-else-if="vazio" class="entra max-w-[780px]" style="--i: 1">
      <Vazio titulo="Nenhuma matéria ainda" texto="Comece pelas matérias da escola. Escolha uma aqui e eu já trago os assuntos dela, na ordem das aulas." humor="acenando">
        <template #acoes>
          <div class="flex flex-wrap gap-2" role="group" aria-label="Criar uma matéria do catálogo">
            <button
              v-for="m in atalhos"
              :key="m.id"
              type="button"
              class="atalho"
              :aria-label="`Criar a matéria ${m.nome}`"
              :aria-busy="criandoAtalho === m.id"
              :disabled="!!criandoAtalho"
              @click="criarDoCatalogo(m)"
            >
              <span v-if="criandoAtalho === m.id" class="rodando" aria-hidden="true" />
              <span v-else class="ponto-cor" :style="{ background: `${corMateria(m.cor)}` }" aria-hidden="true" />
              {{ m.nome }}
            </button>
          </div>
          <button type="button" class="link mt-1 text-[14.5px]" @click="janela?.abrirNova()">Outra matéria</button>
        </template>
      </Vazio>
    </div>

    <template v-else>
      <!-- Busca e filtros: só quando a lista cresce -->
      <div v-if="mostrarFiltros && !filtros.arquivadas" data-guia="materias-filtros" class="entra mb-4 flex flex-wrap items-center gap-2" style="--i: 1" role="search">
        <label class="campo-icone w-full sm:w-[280px]">
          <span class="so-leitor">Buscar matéria ou assunto</span>
          <Search :size="17" :stroke-width="2" aria-hidden="true" />
          <input v-model="filtros.busca" class="campo campo-p" type="search" autocomplete="off">
        </label>
        <Selecao v-model="filtros.area" variante="filtro" prefixo="Área" :opcoes="opcoesArea" :busca="false" />
        <Selecao v-model="filtros.ordem" variante="filtro" prefixo="Ordem" :opcoes="opcoesOrdem" :ativo-quando="ordemLigada" />
        <button v-if="temFiltro" type="button" class="link ml-1 text-[14px]" @click="limparFiltros">Limpar</button>
      </div>

      <section data-guia="materias-lista" class="cartao entra max-w-[1080px] overflow-hidden p-0" style="--i: 2" :aria-label="filtros.arquivadas ? 'Matérias arquivadas' : 'Suas matérias'">
        <div v-if="filtros.arquivadas" class="flex items-center justify-between gap-3 border-b border-borda px-4 py-3 sm:px-5">
          <h2 class="titulo-cartao inline-flex items-center gap-2"><Archive :size="18" :stroke-width="2" aria-hidden="true" />Arquivadas</h2>
          <button type="button" class="botao-fantasma botao-p" @click="filtros.arquivadas = false">
            <ArrowLeft :size="16" :stroke-width="2" aria-hidden="true" />Voltar para as matérias
          </button>
        </div>

        <div v-if="carregando" aria-busy="true" aria-label="Carregando matérias">
          <div v-for="i in 3" :key="i" class="flex items-center gap-4 border-b border-borda px-5 py-5 last:border-0">
            <span class="esqueleto h-10 w-1.5 rounded-full" />
            <span class="esqueleto h-5 w-48 rounded-md" />
            <span class="esqueleto ml-auto h-2 w-40 rounded-full" />
          </div>
        </div>
        <p v-else-if="!lista.length" class="m-0 px-5 py-6 text-[15px] text-texto-2" role="status">
          Nenhuma matéria encontrada. <button type="button" class="link" @click="limparFiltros">Limpar a busca</button>
        </p>
        <TransitionGroup v-else name="lista" tag="ul" class="m-0 list-none divide-y divide-borda p-0">
          <li v-for="m in lista" :key="m.id">
            <MateriasLinhaMateria
              :materia="m"
              :numeros="numeros.porMateria[m.id]"
              :estados="numeros.estados"
              :acoes="acoesDe(m)"
              @acao="acao(m, $event)"
            />
          </li>
        </TransitionGroup>

        <button v-if="arquivadas.length && !filtros.arquivadas" type="button" class="rodape-lista" @click="filtros.arquivadas = true">
          <Archive :size="16" :stroke-width="2" aria-hidden="true" />
          <span>Arquivadas ({{ arquivadas.length }})</span>
        </button>
      </section>

      <div v-if="!filtros.arquivadas && ativas.length && ativas.length < 4 && atalhos.length" class="entra mt-5 flex max-w-[1080px] flex-wrap items-center gap-2" style="--i: 3">
        <span class="mr-1 text-[14px] text-texto-2">Criar também:</span>
        <button
          v-for="m in atalhos.slice(0, 4)"
          :key="m.id"
          type="button"
          class="atalho atalho-p"
          :aria-label="`Criar a matéria ${m.nome}`"
          :aria-busy="criandoAtalho === m.id"
          :disabled="!!criandoAtalho"
          @click="criarDoCatalogo(m)"
        >
          <span v-if="criandoAtalho === m.id" class="rodando" aria-hidden="true" />
          <Plus v-else :size="15" :stroke-width="2.2" aria-hidden="true" />
          {{ m.nome }}
        </button>
      </div>
    </template>

    <MateriasJanelaMateria ref="janela" />

    <JanelaBase ref="confirmar" :titulo="`Excluir ${alvo?.nome ?? ''}?`">
      <p class="m-0 text-[15.5px] leading-[1.55]">{{ textoExclusao }}</p>
      <p class="m-0 text-[14.5px] text-texto-2">Para só tirar da lista, use Arquivar: nada se perde e dá para restaurar.</p>
      <template #rodape>
        <button type="button" class="botao-fantasma botao-p h-10" @click="confirmar?.fechar()">Cancelar</button>
        <button type="button" class="botao botao-perigo h-10" :aria-busy="excluindo" :disabled="excluindo" @click="confirmarExclusao">
          <span v-if="excluindo" class="rodando" aria-hidden="true" />Excluir matéria
        </button>
      </template>
    </JanelaBase>
  </div>
</template>

<style scoped>
.atalho {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  height: 40px;
  padding: 0 14px;
  border: 1px solid var(--borda-forte);
  border-radius: 12px;
  background: var(--folha);
  color: var(--tinta);
  font: inherit;
  font-size: 14.5px;
  font-weight: 600;
  cursor: pointer;
  transition: border-color 0.18s, background-color 0.18s, transform 0.25s var(--ease-mola);
}
.atalho:hover:not(:disabled) {
  border-color: var(--acento);
  background: var(--acento-suave);
  transform: translateY(-1px);
}
.atalho:disabled {
  cursor: default;
  opacity: 0.7;
}
.atalho-p {
  height: 36px;
  padding: 0 12px;
  border-radius: 10px;
  font-size: 14px;
  color: var(--texto-2);
}
.rodape-lista {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  min-height: 48px;
  padding: 0 20px;
  border: 0;
  border-top: 1px solid var(--borda);
  background: transparent;
  color: var(--texto-2);
  font: inherit;
  font-size: 14px;
  font-weight: 600;
  text-align: left;
  cursor: pointer;
  transition: background-color 0.18s, color 0.18s;
}
.rodape-lista:hover {
  background: var(--folha-2);
  color: var(--tinta);
}
@media (prefers-reduced-motion: reduce) {
  .atalho { transition: none; }
}
:global(:root.menos-movimento) .atalho {
  transition: none;
}
</style>
