<script setup>
// Página da matéria: cabeçalho na cor da matéria com o caminho (assuntos, textos, questões, estudar),
// assuntos (sugestões do catálogo com um toque, adicionar, renomear, reordenar, mover, arquivar, excluir)
// e os textos da matéria. "#novo-assunto" já põe o cursor no campo de novo assunto.
import { Archive, ArchiveRestore, ArrowLeft, ChevronDown, CircleAlert, ClipboardType, FileText, Globe, Library, ListTree, Pencil, Plus } from '@lucide/vue'
import { assuntosSugeridos, normalizar } from '#shared/regras/catalogo.js'
import { SITUACOES } from '#shared/regras/materiais.js'
import { LIMITES, assuntosArquivados, assuntosAtivos, contarGrupos, nomeDaArea, passosDaMateria, validarNome } from '#shared/regras/materias.js'

const route = useRoute()
const api = useMaterias()
await api.pronto
const { data: materias } = api
const { data: numerosTudo } = useNumerosMaterias()
const { data: materiais } = useMateriais()
const { avisar } = useAvisos()

const materia = computed(() => (materias.value ?? []).find((m) => m.id === route.params.id) ?? null)
if (!materia.value) {
  throw createError({ statusCode: 404, statusMessage: 'Matéria não encontrada', fatal: true })
}
useHead({ title: () => `${materia.value?.nome ?? 'Matéria'} | PGC` })

const ativos = computed(() => assuntosAtivos(materia.value))
const arquivados = computed(() => assuntosArquivados(materia.value))
const outras = computed(() => (materias.value ?? []).filter((m) => !m.arquivada_em && m.id !== materia.value?.id))
const textos = computed(() => (materiais.value ?? []).filter((t) => t.materia_id === route.params.id && !t.arquivado_em))
const numeros = computed(() => {
  const n = numerosTudo.value.porMateria[route.params.id] ?? {}
  return { assuntos: ativos.value.length, textos: textos.value.length, questoes: n.questoes ?? 0, noBanco: n.noBanco ?? 0, vencidas: n.vencidas ?? 0 }
})
const passos = computed(() => passosDaMateria(numeros.value))
const grupos = computed(() => contarGrupos(ativos.value, numerosTudo.value.estados))
const comEstados = computed(() => grupos.value.bem + grupos.value.estudando + grupos.value.atencao > 0)
const iconeArea = computed(() => ICONES_AREA[materia.value?.area] ?? ICONES_AREA.outra)
const plural = (n, um, varios) => `${n} ${n === 1 ? um : varios}`

// ---------- Sugestões do catálogo ----------
const ocupados = ref([])
const todosCarregando = ref(false)
const sugestoes = computed(() => assuntosSugeridos(materia.value?.nome, (materia.value?.assuntos ?? []).map((a) => a.nome)))
async function adicionarSugestao(nome) {
  ocupados.value = [...ocupados.value, nome]
  try {
    await api.criarAssunto(materia.value.id, nome)
  }
  catch (e) {
    avisar({ texto: e.message, tipo: 'erro' })
  }
  ocupados.value = ocupados.value.filter((n) => n !== nome)
}
async function adicionarTodas() {
  const lista = sugestoes.value.filter((n) => !ocupados.value.includes(n))
  if (!lista.length) return
  todosCarregando.value = true
  try {
    await api.criarAssuntos(materia.value.id, lista)
    avisar({ texto: `${plural(lista.length, 'assunto adicionado', 'assuntos adicionados')}.`, tipo: 'ok' })
  }
  catch (e) {
    avisar({ texto: e.message, tipo: 'erro' })
  }
  todosCarregando.value = false
}

// ---------- Novo assunto ----------
const novoNome = ref('')
const erroNovo = ref('')
const adicionando = ref(false)
const campoNovo = ref(null)
async function adicionar() {
  if (adicionando.value) return
  erroNovo.value = validarNome(novoNome.value, LIMITES.nomeAssunto)
  if (!erroNovo.value && (materia.value.assuntos ?? []).some((a) => normalizar(a.nome) === normalizar(novoNome.value))) {
    erroNovo.value = 'Esse assunto já está nesta matéria.'
  }
  if (erroNovo.value) return campoNovo.value?.focus()
  adicionando.value = true
  try {
    await api.criarAssunto(materia.value.id, novoNome.value)
    novoNome.value = ''
  }
  catch (e) {
    erroNovo.value = e.message
  }
  adicionando.value = false
  nextTick(() => campoNovo.value?.focus())
}
function focarNovo() {
  campoNovo.value?.scrollIntoView({ block: 'center', behavior: 'smooth' })
  campoNovo.value?.focus({ preventScroll: true })
}
onMounted(() => {
  if (route.hash === '#novo-assunto') focarNovo()
})

async function tentar(acao, texto) {
  try {
    await acao()
    if (texto) avisar({ texto, tipo: 'ok' })
    return true
  }
  catch (e) {
    avisar({ texto: e.message, tipo: 'erro' })
    return false
  }
}

// ---------- Matéria ----------
const janelaMateria = ref(null)
const acoesMateria = computed(() => [
  { id: 'editar', texto: 'Editar nome, área e cor', icone: Pencil },
  materia.value?.arquivada_em
    ? { id: 'restaurar', texto: 'Restaurar', icone: ArchiveRestore }
    : { id: 'arquivar', texto: 'Arquivar', icone: Archive },
  { id: 'excluir', texto: 'Excluir matéria', perigo: true, separar: true },
])
function acaoMateria(id) {
  if (id === 'editar') return janelaMateria.value?.abrirEditar(materia.value)
  if (id === 'arquivar') return tentar(() => api.arquivarMateria(materia.value.id, true), 'Matéria arquivada.')
  if (id === 'restaurar') return tentar(() => api.arquivarMateria(materia.value.id, false), 'Matéria restaurada.')
  if (id === 'excluir') {
    alvoExclusao.value = { tipo: 'materia', nome: materia.value.nome }
    janelaExcluir.value?.abrir()
  }
}

// ---------- Assuntos ----------
const assuntoAlvo = ref(null)
const janelaMover = ref(null)
const destino = ref('')
const erroMover = ref('')
const ocupado = ref(false)
const opcoesDestino = computed(() => outras.value.map((m) => ({ valor: m.id, texto: m.nome, cor: `${corMateria(m.cor)}` })))

function acaoAssunto({ assunto, id }) {
  assuntoAlvo.value = assunto
  if (id === 'mover') {
    destino.value = outras.value[0]?.id ?? ''
    erroMover.value = ''
    return janelaMover.value?.abrir()
  }
  if (id === 'arquivar') {
    return tentar(() => api.arquivarAssunto(assunto.id, true)).then((ok) => {
      if (ok) avisar({ texto: 'Assunto arquivado.', acao: { texto: 'Desfazer', fazer: () => tentar(() => api.arquivarAssunto(assunto.id, false)) } })
    })
  }
  if (id === 'excluir') {
    alvoExclusao.value = { tipo: 'assunto', nome: assunto.nome, id: assunto.id }
    janelaExcluir.value?.abrir()
  }
}
const reordenar = (ids) => tentar(() => api.reordenarAssuntos(materia.value.id, ids))
const renomear = ({ assunto, nome }) => tentar(() => api.atualizarAssunto(assunto.id, { nome }), 'Assunto renomeado.')
async function moverAssunto() {
  if (!destino.value) return
  ocupado.value = true
  erroMover.value = ''
  try {
    await api.atualizarAssunto(assuntoAlvo.value.id, { materia_id: destino.value })
    janelaMover.value?.fechar()
    avisar({ texto: `Assunto movido para ${outras.value.find((m) => m.id === destino.value)?.nome ?? 'a outra matéria'}.`, tipo: 'ok' })
  }
  catch (e) {
    erroMover.value = e.message
  }
  ocupado.value = false
}
const verArquivados = ref(false)

// ---------- Excluir (matéria ou assunto), sempre com confirmação ----------
const janelaExcluir = ref(null)
const alvoExclusao = ref(null)
const textoExclusao = computed(() => {
  if (alvoExclusao.value?.tipo === 'assunto') {
    const q = numerosTudo.value.porAssunto[alvoExclusao.value.id]?.questoes ?? 0
    return `O assunto sai desta matéria.${q ? ` As ${plural(q, 'questão', 'questões')} dele continuam na matéria, sem assunto.` : ''} Não dá para desfazer.`
  }
  const partes = [
    materia.value?.assuntos?.length ? plural(materia.value.assuntos.length, 'assunto', 'assuntos') : '',
    textos.value.length ? plural(textos.value.length, 'texto', 'textos') : '',
    numeros.value.questoes ? plural(numeros.value.questoes, 'questão', 'questões') : '',
  ].filter(Boolean)
  return `Isso apaga a matéria${partes.length ? `, com ${partes.join(', ').replace(/, ([^,]*)$/, ' e $1')}` : ''}. Não dá para desfazer.`
})
async function confirmarExclusao() {
  ocupado.value = true
  if (alvoExclusao.value?.tipo === 'materia') {
    const ok = await tentar(() => api.excluirMateria(materia.value.id))
    ocupado.value = false
    janelaExcluir.value?.fechar()
    if (ok) {
      avisar({ texto: 'Matéria excluída.', tipo: 'ok' })
      await navigateTo('/materias')
    }
    return
  }
  await tentar(() => api.excluirAssunto(alvoExclusao.value.id), 'Assunto excluído.')
  ocupado.value = false
  janelaExcluir.value?.fechar()
}

const ICONE_TEXTO = (t) => (t.fonte_url ? Globe : t.origem === 'texto_colado' ? ClipboardType : FileText)
const TIPO_SITUACAO = { ok: 'ok', erro: 'erro', forte: 'aviso' }
</script>

<template>
  <div v-if="materia" :style="{ '--cor': `${corMateria(materia.cor)}` }">
    <NuxtLink to="/materias" class="volta mb-3">
      <ArrowLeft :size="17" :stroke-width="2" aria-hidden="true" />
      <span>Matérias</span>
    </NuxtLink>

    <!-- Cabeçalho na cor da matéria, com o caminho -->
    <header class="cabeca entra" style="--i: 0">
      <div class="flex items-start gap-4">
        <span class="marcador" aria-hidden="true" />
        <div class="min-w-0 flex-1">
          <TituloPagina>{{ materia.nome }}</TituloPagina>
          <p class="m-0 mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[14.5px] text-texto-2">
            <span class="inline-flex items-center gap-1.5">
              <component :is="iconeArea" :size="16" :stroke-width="2" aria-hidden="true" />{{ nomeDaArea(materia.area) }}
            </span>
            <span v-if="numeros.assuntos">{{ plural(numeros.assuntos, 'assunto', 'assuntos') }}</span>
            <span v-if="numeros.textos">{{ plural(numeros.textos, 'texto', 'textos') }}</span>
            <span v-if="numeros.questoes">{{ plural(numeros.questoes, 'questão', 'questões') }}</span>
            <span v-if="!numeros.assuntos && !numeros.questoes" class="text-texto-3">Matéria nova</span>
          </p>
        </div>
        <MenuAcoes :rotulo="`Ações de ${materia.nome}`" :itens="acoesMateria" @escolher="acaoMateria" />
      </div>

      <p v-if="materia.arquivada_em" class="painel m-0 mt-5 flex flex-wrap items-center gap-3 text-[14.5px]" role="status">
        <Archive :size="17" :stroke-width="2" aria-hidden="true" class="text-texto-2" />
        <span class="flex-1">Esta matéria está arquivada. Ela não aparece na lista nem nos estudos.</span>
        <button type="button" class="botao-secundario botao-p" @click="acaoMateria('restaurar')">
          <ArchiveRestore :size="16" :stroke-width="2" aria-hidden="true" />Restaurar
        </button>
      </p>

      <hr class="divisoria divisoria-cor my-5">
      <MateriasCaminho :materia-id="materia.id" :passos="passos" :numeros="numeros" :com-sugestoes="!ativos.length && sugestoes.length > 0" @adicionar-assunto="focarNovo" />
    </header>

    <div class="mt-6 grid items-start gap-6 lg:grid-cols-[minmax(0,1.65fr)_minmax(0,1fr)]">
      <!-- Assuntos -->
      <section id="assuntos" data-guia="materia-assuntos" class="cartao entra overflow-hidden p-0" style="--i: 1" aria-labelledby="titulo-assuntos">
        <div class="flex items-center justify-between gap-3 px-5 pb-3 pt-5">
          <h2 id="titulo-assuntos" class="titulo-secao inline-flex items-center gap-2.5">
            <ListTree :size="20" :stroke-width="2" aria-hidden="true" class="text-texto-2" />Assuntos
            <span v-if="ativos.length" class="font-sans text-[15px] font-semibold text-texto-3">{{ ativos.length }}</span>
          </h2>
        </div>

        <div v-if="!ativos.length && sugestoes.length" class="px-5 pb-5">
          <MateriasSugestoes
            destaque
            :nomes="sugestoes"
            :materia="materia.nome"
            :ocupados="ocupados"
            :todos-carregando="todosCarregando"
            @adicionar="adicionarSugestao"
            @adicionar-todos="adicionarTodas"
          />
        </div>

        <MateriasListaAssuntos
          v-if="ativos.length"
          class="border-t border-borda"
          :materia-id="materia.id"
          :assuntos="ativos"
          :estados="numerosTudo.estados"
          :questoes="numerosTudo.porAssunto"
          :pode-mover="outras.length > 0"
          @reordenar="reordenar"
          @acao="acaoAssunto"
          @renomear="renomear"
        />

        <form class="border-t border-borda px-5 py-4" novalidate @submit.prevent="adicionar">
          <label for="novo-assunto" class="rotulo">Novo assunto</label>
          <div class="flex flex-wrap items-center gap-2.5">
            <input
              id="novo-assunto"
              ref="campoNovo"
              v-model="novoNome"
              class="campo campo-p min-w-0 max-w-[420px] flex-1 basis-[220px]"
              type="text"
              autocomplete="off"
              :maxlength="LIMITES.nomeAssunto"
              :aria-invalid="!!erroNovo || undefined"
              :aria-describedby="erroNovo ? 'erro-novo-assunto' : undefined"
              @input="erroNovo = ''"
            >
            <BotaoAdicionar secundario tamanho="p" tipo="submit" class="h-[38px]" :desativado="adicionando">Adicionar</BotaoAdicionar>
          </div>
          <p v-if="erroNovo" id="erro-novo-assunto" class="erro-campo" role="alert">
            <CircleAlert :size="16" :stroke-width="2" aria-hidden="true" class="mt-px shrink-0" />{{ erroNovo }}
          </p>
        </form>

        <MateriasSugestoes
          v-if="ativos.length && sugestoes.length"
          :nomes="sugestoes"
          :materia="materia.nome"
          :ocupados="ocupados"
          :todos-carregando="todosCarregando"
          @adicionar="adicionarSugestao"
          @adicionar-todos="adicionarTodas"
        />

        <div v-if="arquivados.length" class="border-t border-borda">
          <button type="button" class="arquivados" :aria-expanded="verArquivados" aria-controls="lista-arquivados" @click="verArquivados = !verArquivados">
            <Archive :size="16" :stroke-width="2" aria-hidden="true" />
            <span>Arquivados ({{ arquivados.length }})</span>
            <ChevronDown :size="16" :stroke-width="2" aria-hidden="true" class="seta" :class="verArquivados && 'rotate-180'" />
          </button>
          <Transition name="abre">
            <ul v-if="verArquivados" id="lista-arquivados" class="m-0 list-none px-5 pb-3 pt-0">
              <li v-for="a in arquivados" :key="a.id" class="flex min-h-[44px] items-center gap-3 border-t border-borda first:border-0">
                <span class="min-w-0 flex-1 truncate text-[15px] text-texto-2">{{ a.nome }}</span>
                <button type="button" class="botao-fantasma botao-p" @click="tentar(() => api.arquivarAssunto(a.id, false), 'Assunto restaurado.')">
                  <ArchiveRestore :size="16" :stroke-width="2" aria-hidden="true" />Restaurar
                </button>
                <BotaoLixeira :rotulo="`Excluir o assunto ${a.nome}`" @click="acaoAssunto({ assunto: a, id: 'excluir' })" />
              </li>
            </ul>
          </Transition>
        </div>
      </section>

      <div class="grid gap-6">
        <!-- Textos da matéria -->
        <section data-guia="materia-textos" class="cartao entra" style="--i: 2" aria-labelledby="titulo-textos">
          <h2 id="titulo-textos" class="titulo-cartao inline-flex items-center gap-2">
            <Library :size="18" :stroke-width="2" aria-hidden="true" class="text-texto-2" />Textos
          </h2>
          <p v-if="!textos.length" class="m-0 mt-2 text-[14.5px] leading-normal text-texto-2">
            Opcional. Com o texto do professor, as questões seguem o que ele passou. Sem texto, elas saem do assunto.
          </p>
          <ul v-else class="m-0 mt-3 list-none p-0">
            <li v-for="t in textos.slice(0, 6)" :key="t.id" class="flex items-center gap-3 border-t border-borda py-2.5 first:border-0">
              <component :is="ICONE_TEXTO(t)" :size="17" :stroke-width="2" aria-hidden="true" class="shrink-0 text-texto-3" />
              <div class="min-w-0 flex-1">
                <NuxtLink :to="`/materiais/${t.id}`" class="block truncate text-[14.5px] font-semibold text-tinta no-underline hover:text-acento">{{ t.titulo }}</NuxtLink>
                <p class="m-0 text-[12.5px] text-texto-3">
                  {{ numerosTudo.porTexto[t.id]?.questoes ? plural(numerosTudo.porTexto[t.id].questoes, 'questão', 'questões') : 'Sem questões ainda' }}
                </p>
              </div>
              <span class="selo" :data-tipo="TIPO_SITUACAO[SITUACOES[t.status]?.tom]">{{ SITUACOES[t.status]?.texto ?? t.status }}</span>
            </li>
          </ul>
          <div class="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2">
            <NuxtLink :to="`/materiais?adicionar=1&materia=${materia.id}`" class="botao-secundario botao-p">
              <Plus :size="16" :stroke-width="2.2" aria-hidden="true" />Adicionar texto
            </NuxtLink>
            <NuxtLink v-if="textos.length" to="/materiais" class="link text-[14px]">Abrir a Biblioteca</NuxtLink>
          </div>
        </section>

        <!-- Como estão os assuntos -->
        <section v-revelar v-if="comEstados" class="cartao entra" style="--i: 3" aria-labelledby="titulo-dominio">
          <h2 id="titulo-dominio" class="titulo-cartao">Como estão os assuntos</h2>
          <p class="m-0 mt-1 text-[14px] text-texto-2"><Fracao :valor="grupos.bem" :total="ativos.length" /> assuntos bem</p>
          <MateriasBarraEstados class="mt-3" :grupos="grupos" :altura="10" legenda />
        </section>
      </div>
    </div>

    <MateriasJanelaMateria ref="janelaMateria" />

    <JanelaBase ref="janelaMover" :titulo="`Mover ${assuntoAlvo?.nome ?? 'assunto'}`" descricao="As questões do assunto vão junto.">
      <div class="max-w-[360px]">
        <label class="rotulo" for="destino-assunto">Para a matéria</label>
        <Selecao id="destino-assunto" v-model="destino" :opcoes="opcoesDestino" />
      </div>
      <p v-if="erroMover" class="erro-campo m-0" role="alert">{{ erroMover }}</p>
      <template #rodape>
        <button type="button" class="botao-fantasma botao-p h-10" @click="janelaMover?.fechar()">Cancelar</button>
        <button type="button" class="botao h-10" :aria-busy="ocupado" :disabled="ocupado || !destino" @click="moverAssunto">Mover assunto</button>
      </template>
    </JanelaBase>

    <JanelaBase ref="janelaExcluir" :titulo="`Excluir ${alvoExclusao?.nome ?? ''}?`">
      <p class="m-0 text-[15.5px] leading-[1.55]">{{ textoExclusao }}</p>
      <p class="m-0 text-[14.5px] text-texto-2">Para só tirar da lista, use Arquivar: nada se perde e dá para restaurar.</p>
      <template #rodape>
        <button type="button" class="botao-fantasma botao-p h-10" @click="janelaExcluir?.fechar()">Cancelar</button>
        <button type="button" class="botao botao-perigo h-10" :aria-busy="ocupado" :disabled="ocupado" @click="confirmarExclusao">
          {{ alvoExclusao?.tipo === 'materia' ? 'Excluir matéria' : 'Excluir assunto' }}
        </button>
      </template>
    </JanelaBase>
  </div>
</template>

<style scoped>
.cabeca {
  padding: 24px 22px 22px;
  border: 1px solid color-mix(in oklab, var(--cor) 28%, var(--borda));
  border-radius: 24px;
  background: color-mix(in oklab, var(--cor) 7%, var(--folha));
}
@media (min-width: 640px) {
  .cabeca { padding: 28px 30px 26px; }
}
.marcador {
  flex-shrink: 0;
  width: 8px;
  height: 52px;
  margin-top: 2px;
  border-radius: 999px;
  background: var(--cor);
}
.divisoria-cor {
  background: color-mix(in oklab, var(--cor) 22%, var(--borda));
}
.arquivados {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  min-height: 48px;
  padding: 0 20px;
  border: 0;
  background: transparent;
  color: var(--texto-2);
  font: inherit;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
}
.arquivados:hover {
  color: var(--tinta);
}
.arquivados .seta {
  margin-left: auto;
  transition: transform 0.25s var(--ease-saida);
}
</style>
