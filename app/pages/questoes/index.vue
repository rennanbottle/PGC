<script setup>
// Banco de questões. O que a pessoa veio fazer: encher o banco (Gerar questões, a ação principal) e achar uma questão.
// O número principal é quantas estão prontas para estudar, com as novas da semana comparadas à anterior (barras por dia).
// O que está fora dos estudos vira uma faixa curta: o motivo e o atalho para resolver.
// A lista pede ao banco só o que aparece: filtros no servidor e páginas de 50 questões.
// "?importar=1" abre a importação; "?gerar=" (link antigo) leva para a página de gerar; "?geradas=N" avisa quantas
// entraram; "?situacao=" filtra.
import { Archive, ArchiveRestore, BookOpenCheck, Copy, FileCheck, FileUp, FolderInput, Gauge, Pencil, Search, Shapes, Trash2, TriangleAlert, X } from '@lucide/vue'
import { NIVEIS, SITUACOES_QUESTAO, TIPOS, enunciadoCurto, nomeDoNivel, nomeDoTipo, situacaoDaQuestao, trechoParaLista } from '#shared/regras/questoes.js'
import { assuntosAtivos } from '#shared/regras/materias.js'

useHead({ title: 'Questões | PGC' })

const route = useRoute()
const router = useRouter()
const supabase = useSupabaseClient()
const api = useQuestoes()
const { avisar } = useAvisos()
const { data: resumo, error: erroResumo, pending: carregandoResumo } = useResumoQuestoes()
const { data: materias } = useMaterias()
const { data: bancos } = useBancos()
const ativas = computed(() => (materias.value ?? []).filter((m) => !m.arquivada_em))
const materiaPorId = computed(() => Object.fromEntries((materias.value ?? []).map((m) => [m.id, m])))
const nomeAssunto = (q) => (materiaPorId.value[q.materia_id]?.assuntos ?? []).find((a) => a.id === q.assunto_id)?.nome
const corDaQuestao = (id) => corMateria(materiaPorId.value[id]?.cor ?? 'cinza')

// ---------- Número principal: prontas para estudar, novas por dia ----------
const semana = computed(() => {
  const d = resumo.value.dias ?? []
  const atual = d.slice(7).reduce((s, n) => s + n, 0)
  const anterior = d.slice(0, 7).reduce((s, n) => s + n, 0)
  return { atual, diferenca: atual - anterior }
})
const comparacao = computed(() => {
  const d = semana.value.diferenca
  if (d > 0) return `+${d} que na semana passada`
  if (d < 0) return `${d} que na semana passada`
  return 'igual à semana passada'
})
const fmtLetra = new Intl.DateTimeFormat('pt-BR', { weekday: 'narrow', timeZone: 'America/Sao_Paulo' })
const fmtDia = new Intl.DateTimeFormat('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'America/Sao_Paulo' })
const barrasDias = computed(() => {
  const d = resumo.value.dias ?? []
  const hoje = Date.now()
  return d.map((valor, i) => {
    const dia = new Date(hoje - (d.length - 1 - i) * 86400000)
    const nome = i === d.length - 1 ? 'Hoje' : fmtDia.format(dia)
    return { rotulo: fmtLetra.format(dia).toUpperCase(), valor, destaque: i === d.length - 1, dica: `${nome.charAt(0).toUpperCase()}${nome.slice(1)}: ${valor} ${valor === 1 ? 'nova' : 'novas'}` }
  })
})
const descricaoBarras = computed(() => `Questões novas por dia nos últimos 14 dias: ${semana.value.atual} nesta semana, ${comparacao.value}.`)

// Tipos no banco: barras horizontais (os 4 mais comuns e o resto junto). Clicar filtra a lista.
const tipos = computed(() => {
  const conhecidos = new Set(TIPOS.map((t) => t.id))
  const todos = Object.entries(resumo.value.por_tipo ?? {}).filter(([, n]) => n > 0)
  const lista = todos.filter(([id]) => conhecidos.has(id)).sort((a, b) => b[1] - a[1])
  const topo = lista.slice(0, 4).map(([id, n]) => ({ id, nome: nomeDoTipo(id), n }))
  const outros = todos.filter(([id]) => !topo.some((t) => t.id === id))
  const resto = outros.reduce((s, [, n]) => s + n, 0)
  if (resto) topo.push({ id: '', nome: `Outros ${outros.length} ${outros.length === 1 ? 'tipo' : 'tipos'}`, n: resto })
  return topo
})
const maiorTipo = computed(() => Math.max(1, ...tipos.value.map((t) => t.n)))

// Fora dos estudos: motivo e atalho.
const fora = computed(() => resumo.value.fora ?? {})
const motivos = computed(() => [
  { id: 'gabarito', n: fora.value.gabarito, texto: 'sem gabarito confirmado', acao: 'Marcar a resposta' },
  { id: 'qualidade', n: fora.value.qualidade, texto: 'com aviso de qualidade', acao: 'Ver o que ajustar' },
  { id: 'imagem', n: fora.value.imagem, texto: 'sem a imagem citada', acao: 'Anexar a imagem' },
  { id: 'material', n: fora.value.material, texto: 'com texto de origem mudado', acao: 'Conferir' },
].filter((m) => m.n))
const totalFora = computed(() => motivos.value.reduce((s, m) => s + m.n, 0))
const paraConferir = computed(() => (bancos.value ?? []).filter((b) => b.status === 'aguardando_conferencia'))
const vazio = computed(() => !carregandoResumo.value && !resumo.value.total && !resumo.value.arquivadas && !paraConferir.value.length)

// ---------- Filtros e lista ----------
const filtros = reactive({ texto: '', materia: typeof route.query.materia === 'string' ? route.query.materia : '', assunto: '', tipo: '', nivel: '', situacao: typeof route.query.situacao === 'string' ? route.query.situacao : '' })
const termo = ref('')
let espera = null
watch(() => filtros.texto, (t) => {
  clearTimeout(espera)
  espera = setTimeout(() => (termo.value = t.trim().length >= 3 ? t.trim() : ''), 300)
})
watch(() => filtros.materia, () => (filtros.assunto = ''))
const opcoesMateria = computed(() => [{ valor: '', texto: 'Todas' }, ...ativas.value.map((m) => ({ valor: m.id, texto: m.nome, cor: `${corMateria(m.cor ?? 'cinza')}` }))])
const opcoesAssunto = computed(() => [{ valor: '', texto: 'Todos' }, { valor: 'sem', texto: 'Sem assunto' }, ...assuntosAtivos(materiaPorId.value[filtros.materia]).map((a) => ({ valor: a.id, texto: a.nome }))])
const opcoesTipo = [{ valor: '', texto: 'Todos' }, ...TIPOS.map((t) => ({ valor: t.id, texto: t.nome, icone: ICONES_TIPO[t.id] }))]
const opcoesNivel = [{ valor: '', texto: 'Todos' }, ...NIVEIS.map((n) => ({ valor: String(n.valor), texto: n.nome }))]
const opcoesSituacao = [{ valor: '', texto: 'Todas' }, ...SITUACOES_QUESTAO.map((s) => ({ valor: s.id, texto: s.nome }))]
const POR_PAGINA = 50
const pagina = ref(1)
watch(() => JSON.stringify({ ...filtros, texto: undefined }) + termo.value, () => {
  pagina.value = 1
  selecionadas.value = new Set()
})
// Trocar de página volta ao começo da lista e desmarca as selecionadas (elas eram da outra página).
const topoLista = ref(null)
watch(pagina, () => {
  selecionadas.value = new Set()
  topoLista.value?.scrollIntoView({ block: 'start', behavior: 'smooth' })
})

const COLUNAS_LISTA = 'id, materia_id, assunto_id, tipo, nivel, origem, status, enunciado, gabarito_confirmado, resolver_comparar, qualidade_aprovada, precisa_imagem, material_mudou, em_revisao, criado_em'
const { data: lista, pending, error: erroLista } = useAsyncData('questoes-lista', async () => {
  let q = supabase.from('questoes').select(COLUNAS_LISTA, { count: 'exact' })
  q = filtros.situacao === 'arquivada' ? q.eq('status', 'arquivada') : q.eq('status', 'ativa')
  if (filtros.materia) q = q.eq('materia_id', filtros.materia)
  if (filtros.assunto === 'sem') q = q.is('assunto_id', null)
  else if (filtros.assunto) q = q.eq('assunto_id', filtros.assunto)
  if (filtros.tipo) q = q.eq('tipo', filtros.tipo)
  if (filtros.nivel) q = q.eq('nivel', Number(filtros.nivel))
  if (filtros.situacao === 'em_revisao') q = q.eq('em_revisao', true)
  if (filtros.situacao === 'gabarito') q = q.eq('gabarito_confirmado', false).eq('resolver_comparar', false)
  if (filtros.situacao === 'qualidade') q = q.eq('qualidade_aprovada', false)
  if (filtros.situacao === 'imagem') q = q.eq('precisa_imagem', true)
  if (filtros.situacao === 'material') q = q.eq('material_mudou', true)
  if (termo.value) q = q.textSearch('busca', termo.value, { config: 'portuguese', type: 'websearch' })
  const { data, count, error } = await q.order('criado_em', { ascending: false }).range((pagina.value - 1) * POR_PAGINA, pagina.value * POR_PAGINA - 1)
  if (error) throw error
  return { itens: data, total: count ?? data.length }
}, { watch: [() => JSON.stringify({ ...filtros, texto: undefined }), termo, pagina], default: () => ({ itens: [], total: 0 }) })
const itens = computed(() => lista.value?.itens ?? [])
const temFiltro = computed(() => !!(filtros.texto || filtros.materia || filtros.tipo || filtros.nivel || filtros.situacao))
function limparFiltros() {
  Object.assign(filtros, { texto: '', materia: '', assunto: '', tipo: '', nivel: '', situacao: '' })
}
function irParaLista() {
  nextTick(() => document.getElementById('lista-questoes')?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
}
function verSituacao(s) {
  limparFiltros()
  filtros.situacao = s
  irParaLista()
}
function verTipo(t) {
  limparFiltros()
  filtros.tipo = t
  irParaLista()
}
const TOM_SELO = { aviso: 'aviso', erro: 'erro', neutro: undefined }

// ---------- Seleção ----------
const selecionadas = ref(new Set())
const todasMarcadas = computed(() => itens.value.length > 0 && itens.value.every((q) => selecionadas.value.has(q.id)))
function alternar(qid) {
  const s = new Set(selecionadas.value)
  if (s.has(qid)) s.delete(qid)
  else s.add(qid)
  selecionadas.value = s
}
function alternarTodas() {
  selecionadas.value = todasMarcadas.value ? new Set() : new Set(itens.value.map((q) => q.id))
}

// ---------- Ações ----------
const ocupado = ref(false)
const alvo = ref([])
async function tentar(fn) {
  ocupado.value = true
  try {
    await fn()
    return true
  }
  catch (e) {
    avisar({ texto: e.message, tipo: 'erro' })
    return false
  }
  finally {
    ocupado.value = false
  }
}
const janelaNivel = ref(null)
const novoNivel = ref(2)
const janelaAssunto = ref(null)
const novoLugar = ref('')
const janelaExcluir = ref(null)
const opcoesLugar = computed(() => ativas.value.flatMap((m) => [
  { valor: `${m.id}|`, texto: 'Sem assunto', grupo: m.nome, cor: `${corMateria(m.cor ?? 'cinza')}` },
  ...assuntosAtivos(m).map((a) => ({ valor: `${m.id}|${a.id}`, texto: a.nome, grupo: m.nome, cor: `${corMateria(m.cor ?? 'cinza')}` })),
]))
const quantas = (n, uma, varias) => (n === 1 ? uma : `${n} ${varias}`)

function acoesDe(q) {
  return [
    { id: 'editar', texto: 'Ver e editar', icone: Pencil },
    { id: 'duplicar', texto: 'Duplicar', icone: Copy },
    { id: 'nivel', texto: 'Mudar o nível', icone: Gauge },
    { id: 'assunto', texto: 'Mudar o assunto', icone: FolderInput },
    q.status === 'arquivada' ? { id: 'restaurar', texto: 'Restaurar', icone: ArchiveRestore } : { id: 'arquivar', texto: 'Arquivar', icone: Archive, descricao: 'Sai dos estudos, mas fica guardada' },
    { id: 'excluir', texto: 'Excluir', perigo: true, separar: true },
  ]
}
function agir(ids, acao) {
  alvo.value = ids
  const primeira = itens.value.find((q) => q.id === ids[0])
  if (acao === 'editar') return navigateTo(`/questoes/${ids[0]}`)
  if (acao === 'duplicar') {
    return tentar(async () => {
      const nova = await api.duplicar(ids[0])
      avisar({ texto: 'Questão duplicada.', tipo: 'ok' })
      await navigateTo(`/questoes/${nova}`)
    })
  }
  if (acao === 'nivel') {
    novoNivel.value = primeira?.nivel ?? 2
    return janelaNivel.value?.abrir()
  }
  if (acao === 'assunto') {
    novoLugar.value = primeira ? `${primeira.materia_id}|${primeira.assunto_id ?? ''}` : ''
    return janelaAssunto.value?.abrir()
  }
  if (acao === 'arquivar' || acao === 'restaurar') {
    const sim = acao === 'arquivar'
    return tentar(async () => {
      await api.arquivar(ids, sim)
      selecionadas.value = new Set()
      const texto = `${quantas(ids.length, 'Questão', 'questões')} ${sim ? 'arquivada' : 'restaurada'}${ids.length === 1 ? '' : 's'}.`
      avisar({ texto, tipo: 'ok', acao: { texto: 'Desfazer', fazer: () => api.arquivar(ids, !sim) } })
    })
  }
  if (acao === 'excluir') return janelaExcluir.value?.abrir()
}
async function salvarNivel() {
  if (await tentar(() => api.atualizarVarias(alvo.value, { nivel: novoNivel.value }))) {
    janelaNivel.value?.fechar()
    avisar({ texto: 'Nível mudado.', tipo: 'ok' })
  }
}
async function salvarAssunto() {
  const [materia, assunto] = novoLugar.value.split('|')
  if (await tentar(() => api.atualizarVarias(alvo.value, { materia_id: materia, assunto_id: assunto || null }))) {
    janelaAssunto.value?.fechar()
    avisar({ texto: 'Assunto mudado.', tipo: 'ok' })
  }
}
async function excluir() {
  const n = alvo.value.length
  if (await tentar(() => api.excluir(alvo.value))) {
    selecionadas.value = new Set()
    janelaExcluir.value?.fechar()
    avisar({ texto: `${quantas(n, 'Questão excluída', 'questões excluídas')}.`, tipo: 'ok' })
  }
}

// ---------- Janela de importar ----------
const janelaImportar = ref(null)
const chaveJanela = ref(0)
function abrirImportar() {
  chaveJanela.value++
  nextTick(() => janelaImportar.value?.abrir())
}
onMounted(() => {
  watch(() => [route.query.importar, route.query.gerar, route.query.geradas], () => {
    if (route.query.gerar) {
      const material = route.query.gerar === '1' ? '' : String(route.query.gerar)
      return navigateTo({ path: '/questoes/gerar', query: material ? { texto: material } : {} }, { replace: true })
    }
    if (route.query.importar === '1') abrirImportar()
    else if (route.query.geradas !== undefined) {
      const n = Number(route.query.geradas) || 0
      avisar({ texto: n ? `${quantas(n, 'Uma questão entrou', 'questões entraram')} no banco.` : 'Nenhuma questão nova: as possíveis já tinham sido geradas.', tipo: n ? 'ok' : 'info' })
    }
    else return
    const { importar, gerar, aba, geradas, ...resto } = route.query
    router.replace({ query: resto })
  }, { immediate: true })
})
</script>

<template>
  <div>
    <CabecalhoPagina titulo="Questões" descricao="O que você responde quando estuda. Gere com a IA, importe uma prova antiga ou escreva a sua.">
      <template #acoes>
        <button type="button" class="botao-fantasma acao-leve" aria-haspopup="dialog" @click="abrirImportar">
          <FileUp :size="18" :stroke-width="2" aria-hidden="true" />Importar prova
        </button>
        <!-- "Escrever uma questão" fica escondido por enquanto (pedido do R): a rota /questoes/nova continua existindo. -->
        <BotaoIa data-guia="questoes-gerar" class="max-sm:order-first max-sm:w-full" @click="navigateTo('/questoes/gerar')">Gerar questões</BotaoIa>
      </template>
    </CabecalhoPagina>

    <p v-if="erroResumo" class="erro-campo m-0" role="alert">Não deu para carregar o banco de questões. Confira a internet e recarregue a página.</p>

    <!-- Banco vazio -->
    <div v-else-if="vazio" class="entra max-w-[780px]" style="--i: 1">
      <Vazio titulo="Nenhuma questão ainda" texto="Questões são o que você responde quando estuda. A IA escreve a partir de um texto da Biblioteca ou de um assunto, e o PGC confere cada uma. Com 10 questões, o Estudar abre." humor="acenando">
        <template #acoes>
          <BotaoIa @click="navigateTo('/questoes/gerar')">Gerar questões</BotaoIa>
          <button type="button" class="link text-[14.5px]" @click="abrirImportar">Importar uma prova antiga</button>
        </template>
      </Vazio>
    </div>

    <template v-else>
      <!-- Prontas para estudar (principal) e tipos no banco -->
      <div class="grid gap-4 lg:grid-cols-[1.55fr_1fr]">
        <section class="cartao entra flex min-w-0 flex-col" style="--i: 1" aria-labelledby="titulo-prontas">
          <h2 id="titulo-prontas" class="titulo-cartao flex items-center gap-2">
            <BookOpenCheck :size="19" :stroke-width="2" aria-hidden="true" />Prontas para estudar
          </h2>
          <div class="mt-4 flex flex-wrap items-end gap-x-10 gap-y-5">
            <p class="prontas numero-grande m-0 shrink-0">
              <span v-if="carregandoResumo" class="esqueleto inline-block h-10 w-28 rounded-lg" />
              <Fracao v-else :valor="resumo.em_revisao" :total="resumo.total" />
            </p>
            <div class="min-w-[230px] max-w-[420px] flex-1 pr-8">
              <GraficoBarras :dados="barrasDias" :altura="72" :descricao="descricaoBarras" />
            </div>
          </div>
          <p class="m-0 mb-5 mt-4 flex flex-wrap items-center gap-x-2.5 gap-y-1.5 text-[14.5px]">
            <span><b class="tabular-nums">{{ semana.atual }}</b> {{ semana.atual === 1 ? 'questão nova' : 'questões novas' }} nesta semana</span>
            <span class="selo" :data-tipo="semana.diferenca > 0 ? 'ok' : undefined">{{ comparacao }}</span>
          </p>
          <div class="mt-auto flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-t border-borda pt-3.5 text-[14px] text-texto-2">
            <span v-if="resumo.total - resumo.em_revisao > 0">As outras {{ resumo.total - resumo.em_revisao }} precisam de um ajuste antes.</span>
            <span v-else-if="resumo.total">Todas as questões do banco entram nos seus estudos.</span>
            <NuxtLink v-if="resumo.em_revisao" to="/revisar" class="link text-[14.5px]">Estudar agora</NuxtLink>
          </div>
        </section>

        <section v-if="tipos.length" class="cartao entra min-w-0" style="--i: 2" aria-labelledby="titulo-tipos">
          <h2 id="titulo-tipos" class="titulo-cartao flex items-center gap-2">
            <Shapes :size="18" :stroke-width="2" aria-hidden="true" />Tipos no banco
          </h2>
          <ul class="m-0 mt-2.5 list-none p-0">
            <li v-for="(t, i) in tipos" :key="t.id || 'outros'">
              <component
                :is="t.id ? 'button' : 'div'"
                :type="t.id ? 'button' : undefined"
                class="tipo-linha"
                :aria-label="t.id ? `${t.nome}: ${t.n}. Mostrar só este tipo na lista` : undefined"
                @click="t.id && verTipo(t.id)"
              >
                <span class="flex items-center gap-2 text-[14px]">
                  <QuestoesIconeTipo v-if="t.id" :tipo="t.id" :tamanho="16" class="shrink-0 text-texto-2" />
                  <span class="min-w-0 flex-1 truncate" :class="!t.id && 'text-texto-2'">{{ t.nome }}</span>
                  <b class="tabular-nums">{{ t.n }}</b>
                </span>
                <span class="trilho" aria-hidden="true"><i :style="{ width: `${(t.n / maiorTipo) * 100}%`, '--i': i }" /></span>
              </component>
            </li>
          </ul>
        </section>
      </div>

      <!-- O que espera por você: importações para conferir e questões fora dos estudos -->
      <section v-if="paraConferir.length || totalFora" class="painel entra mt-4 flex flex-col gap-3" style="--i: 3" aria-label="Precisa da sua atenção">
        <div v-for="b in paraConferir" :key="b.id" class="flex flex-wrap items-center gap-x-3 gap-y-2">
          <FileCheck :size="19" :stroke-width="2" class="shrink-0 text-acento" aria-hidden="true" />
          <p class="m-0 min-w-[min(100%,280px)] flex-1 text-[14.5px]">
            <b>Importação para conferir:</b> {{ b.titulo }}. {{ b.total_reconhecido }} questões, {{ b.total_com_gabarito }} com gabarito.
          </p>
          <NuxtLink :to="`/questoes/importar/${b.id}`" class="botao-secundario botao-p no-underline">Conferir a importação</NuxtLink>
        </div>
        <div v-if="totalFora" class="flex flex-wrap items-start gap-x-6 gap-y-2" :class="paraConferir.length && 'border-t border-borda-forte pt-3'">
          <h2 class="m-0 flex items-center gap-2 pt-1.5 text-[14.5px] font-semibold">
            <TriangleAlert :size="19" :stroke-width="2" class="shrink-0 text-aviso" aria-hidden="true" />{{ totalFora }} fora dos estudos
          </h2>
          <ul class="-ml-3 m-0 flex min-w-[min(100%,320px)] flex-1 list-none flex-wrap gap-1 p-0 sm:ml-0">
            <li v-for="m in motivos" :key="m.id">
              <button type="button" class="motivo" @click="verSituacao(m.id)">
                <span><b class="tabular-nums">{{ m.n }}</b> {{ m.texto }}</span>
                <span class="motivo-acao">{{ m.acao }}</span>
              </button>
            </li>
          </ul>
        </div>
      </section>

      <!-- Filtros -->
      <div id="lista-questoes" class="entra mt-8 flex scroll-mt-4 flex-wrap items-center gap-2" style="--i: 4" role="search" aria-label="Filtrar questões">
        <label class="campo-icone w-full sm:w-[250px]">
          <span class="so-leitor">Buscar no enunciado</span>
          <Search :size="17" :stroke-width="2" aria-hidden="true" />
          <input v-model="filtros.texto" class="campo campo-p" type="search" autocomplete="off">
        </label>
        <Selecao v-model="filtros.materia" variante="filtro" prefixo="Matéria" :opcoes="opcoesMateria" />
        <Selecao v-if="filtros.materia" v-model="filtros.assunto" variante="filtro" prefixo="Assunto" :opcoes="opcoesAssunto" />
        <Selecao v-model="filtros.tipo" variante="filtro" prefixo="Tipo" :opcoes="opcoesTipo" />
        <Selecao v-model="filtros.nivel" variante="filtro" prefixo="Nível" :opcoes="opcoesNivel" :busca="false" />
        <Selecao v-model="filtros.situacao" variante="filtro" prefixo="Situação" :opcoes="opcoesSituacao" :busca="false" />
        <button v-if="temFiltro" type="button" class="link ml-1 text-[14px]" @click="limparFiltros">Limpar</button>
      </div>

      <!-- Lista -->
      <section ref="topoLista" data-guia="questoes-lista" class="cartao entra mt-3 scroll-mt-24 overflow-clip p-0" style="--i: 5" aria-label="Suas questões">
        <div class="sticky top-0 z-[5] flex min-h-[54px] flex-wrap items-center gap-x-3.5 gap-y-1 border-b border-borda bg-folha px-4 py-2 sm:px-5">
          <input type="checkbox" class="marcar" :checked="todasMarcadas" :disabled="!itens.length" aria-label="Selecionar todas as questões da lista" @change="alternarTodas">
          <span v-if="!selecionadas.size" class="text-[14px] text-texto-2" role="status">
            <b class="tabular-nums text-tinta">{{ lista.total }}</b> {{ lista.total === 1 ? 'questão' : 'questões' }}{{ temFiltro ? ' com esses filtros' : (filtros.situacao === 'arquivada' ? ' arquivadas' : '') }}
          </span>
          <template v-else>
            <b class="text-[14px] tabular-nums" role="status">{{ selecionadas.size }} {{ selecionadas.size === 1 ? 'selecionada' : 'selecionadas' }}</b>
            <span class="flex flex-wrap items-center gap-0.5 sm:ml-auto" role="group" aria-label="Ações nas questões selecionadas">
              <button type="button" class="botao-fantasma botao-p" @click="agir([...selecionadas], 'nivel')"><Gauge :size="16" :stroke-width="2" aria-hidden="true" />Nível</button>
              <button type="button" class="botao-fantasma botao-p" @click="agir([...selecionadas], 'assunto')"><FolderInput :size="16" :stroke-width="2" aria-hidden="true" />Assunto</button>
              <button v-if="filtros.situacao === 'arquivada'" type="button" class="botao-fantasma botao-p" @click="agir([...selecionadas], 'restaurar')"><ArchiveRestore :size="16" :stroke-width="2" aria-hidden="true" />Restaurar</button>
              <button v-else type="button" class="botao-fantasma botao-p" @click="agir([...selecionadas], 'arquivar')"><Archive :size="16" :stroke-width="2" aria-hidden="true" />Arquivar</button>
              <button type="button" class="botao-fantasma botao-p text-erro" @click="agir([...selecionadas], 'excluir')"><Trash2 :size="16" :stroke-width="2" aria-hidden="true" />Excluir</button>
              <button type="button" class="botao-icone pequeno" aria-label="Desmarcar todas" data-dica="Desmarcar" @click="selecionadas = new Set()"><X :size="16" :stroke-width="2" aria-hidden="true" /></button>
            </span>
          </template>
        </div>

        <div v-if="pending && !itens.length" aria-busy="true" aria-label="Carregando questões">
          <div v-for="i in 4" :key="i" class="flex items-start gap-4 border-b border-borda px-5 py-4 last:border-0">
            <span class="esqueleto size-5 rounded-md" />
            <span class="flex-1"><span class="esqueleto block h-4 w-[70%] rounded-md" /><span class="esqueleto mt-2.5 block h-3 w-52 rounded-md" /></span>
          </div>
        </div>
        <p v-else-if="erroLista" class="erro-campo m-0 px-5 py-6" role="alert">Não deu para carregar a lista. Confira a internet e recarregue a página.</p>
        <p v-else-if="!itens.length" class="m-0 px-5 py-8 text-[15px] text-texto-2" role="status">
          Nenhuma questão com esses filtros. <button v-if="temFiltro" type="button" class="link" @click="limparFiltros">Limpar os filtros</button>
        </p>
        <TransitionGroup v-else name="lista" tag="ul" class="m-0 list-none divide-y divide-borda p-0" :aria-busy="pending">
          <li v-for="q in itens" :key="q.id" class="linha-questao grid grid-cols-[20px_minmax(0,1fr)_auto] items-start gap-x-3.5 px-4 py-3.5 sm:px-5" :class="selecionadas.has(q.id) && 'marcada'">
            <input type="checkbox" class="marcar mt-[3px]" :checked="selecionadas.has(q.id)" :aria-label="`Selecionar: ${enunciadoCurto(q.enunciado, 60)}`" @change="alternar(q.id)">
            <div class="min-w-0">
              <NuxtLink :to="`/questoes/${q.id}`" class="enunciado-link line-clamp-2 text-[15.5px] font-medium leading-[1.45] text-tinta no-underline">
                <TextoRico :texto="trechoParaLista(q.enunciado)" tag="span" />
              </NuxtLink>
              <p class="m-0 mt-1.5 flex flex-wrap items-center gap-x-3.5 gap-y-1.5 text-[13px] text-texto-2">
                <span class="inline-flex min-w-0 items-center gap-1.5">
                  <span class="size-2 shrink-0 rounded-full" :style="{ background: corDaQuestao(q.materia_id) }" aria-hidden="true" />
                  <span class="truncate"><span class="font-semibold text-tinta">{{ materiaPorId[q.materia_id]?.nome ?? 'Matéria' }}</span><template v-if="nomeAssunto(q)">, {{ nomeAssunto(q) }}</template></span>
                </span>
                <span class="inline-flex items-center gap-1.5"><QuestoesIconeTipo :tipo="q.tipo" :tamanho="15" class="shrink-0" />{{ nomeDoTipo(q.tipo) }}</span>
                <span>{{ nomeDoNivel(q.nivel) }}</span>
                <span v-if="situacaoDaQuestao(q)" class="selo" :data-tipo="TOM_SELO[situacaoDaQuestao(q).tom]">{{ situacaoDaQuestao(q).texto }}</span>
              </p>
            </div>
            <MenuAcoes :rotulo="`Ações da questão: ${enunciadoCurto(q.enunciado, 50)}`" :itens="acoesDe(q)" @escolher="agir([q.id], $event)" />
          </li>
        </TransitionGroup>

        <Paginacao v-if="itens.length" v-model="pagina" class="border-t border-borda px-4 py-3 sm:px-5" :total="lista.total" :por-pagina="POR_PAGINA" :carregando="pending" rotulo="Páginas do banco de questões" />
      </section>
    </template>

    <!-- Janelas -->
    <JanelaBase ref="janelaImportar" titulo="Importar prova" descricao="Uma prova antiga, lista de exercícios ou planilha. Você confere cada questão antes de ela entrar no banco.">
      <QuestoesImportarBanco :key="`i${chaveJanela}`" :materia-inicial="filtros.materia" @fechar="janelaImportar?.fechar()" />
    </JanelaBase>

    <JanelaBase ref="janelaNivel" :titulo="alvo.length > 1 ? `Mudar o nível de ${alvo.length} questões` : 'Mudar o nível'" descricao="O nível é só o começo. Depois ele se ajusta com as suas respostas.">
      <form id="form-nivel" novalidate @submit.prevent="salvarNivel">
        <fieldset class="m-0 flex min-w-0 flex-col gap-0.5 border-0 p-0">
          <legend class="so-leitor">Nível</legend>
          <label v-for="n in NIVEIS" :key="n.valor" class="linha-opcao items-center">
            <input v-model.number="novoNivel" type="radio" name="novo-nivel" :value="n.valor" class="escolher">
            <span class="text-[15px] font-semibold">{{ n.nome }}</span>
          </label>
        </fieldset>
      </form>
      <template #rodape>
        <button type="button" class="botao-fantasma" @click="janelaNivel?.fechar()">Cancelar</button>
        <button type="submit" form="form-nivel" class="botao" :aria-busy="ocupado" :disabled="ocupado"><span v-if="ocupado" class="rodando" aria-hidden="true" />Salvar o nível</button>
      </template>
    </JanelaBase>

    <JanelaBase ref="janelaAssunto" :titulo="alvo.length > 1 ? `Mudar o assunto de ${alvo.length} questões` : 'Mudar o assunto'" descricao="Um assunto de outra matéria leva a questão para essa matéria.">
      <form id="form-assunto" novalidate @submit.prevent="salvarAssunto">
        <label class="rotulo" for="campo-novo-assunto">Assunto</label>
        <Selecao id="campo-novo-assunto" v-model="novoLugar" :opcoes="opcoesLugar" />
      </form>
      <template #rodape>
        <button type="button" class="botao-fantasma" @click="janelaAssunto?.fechar()">Cancelar</button>
        <button type="submit" form="form-assunto" class="botao" :aria-busy="ocupado" :disabled="ocupado"><span v-if="ocupado" class="rodando" aria-hidden="true" />Salvar o assunto</button>
      </template>
    </JanelaBase>

    <JanelaBase ref="janelaExcluir" :titulo="alvo.length > 1 ? `Excluir ${alvo.length} questões?` : 'Excluir a questão?'" descricao="Não dá para desfazer. Para só tirar dos estudos, use Arquivar.">
      <template #rodape>
        <button type="button" class="botao-fantasma" @click="janelaExcluir?.fechar()">Cancelar</button>
        <button type="button" class="botao botao-perigo" :aria-busy="ocupado" :disabled="ocupado" @click="excluir"><Trash2 :size="17" :stroke-width="2" aria-hidden="true" />Excluir</button>
      </template>
    </JanelaBase>
  </div>
</template>

<style scoped>
@media (max-width: 639px) {
  .acao-leve {
    flex: 1 1 auto;
    justify-content: center;
    padding-inline: 8px;
    font-size: 14px;
  }
}
.prontas :deep(.fracao-total) {
  margin-left: 2px;
  font-size: 0.55em;
  font-weight: 600;
}
.tipo-linha {
  display: block;
  width: calc(100% + 16px);
  margin: 0 -8px;
  padding: 7px 8px;
  border: 0;
  border-radius: 10px;
  background: none;
  color: inherit;
  font: inherit;
  text-align: left;
}
button.tipo-linha {
  cursor: pointer;
  transition: background-color 0.15s;
}
button.tipo-linha:hover {
  background: var(--folha-2);
}
button.tipo-linha:focus-visible {
  outline: 2px solid var(--acento);
  outline-offset: 1px;
}
.trilho {
  display: block;
  height: 6px;
  margin-top: 6px;
  overflow: hidden;
  border-radius: 999px;
  background: var(--folha-3);
}
.trilho > i {
  display: block;
  height: 100%;
  border-radius: 999px;
  background: var(--acento);
  transform-origin: left;
  animation: cresce 0.7s cubic-bezier(0.2, 0.8, 0.2, 1) both;
  animation-delay: calc(var(--i) * 60ms + 150ms);
}
@keyframes cresce {
  from { transform: scaleX(0); }
}
.motivo {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 1px;
  min-height: 40px;
  padding: 6px 12px;
  border: 0;
  border-radius: 12px;
  background: none;
  color: var(--tinta);
  font: inherit;
  font-size: 14px;
  text-align: left;
  cursor: pointer;
  transition: background-color 0.15s;
}
.motivo:hover {
  background: var(--folha-3);
}
.motivo:focus-visible {
  outline: 2px solid var(--acento);
  outline-offset: 1px;
}
.motivo-acao {
  color: var(--acento);
  font-size: 13.5px;
  font-weight: 600;
}
.linha-questao {
  transition: background-color 0.15s;
}
.linha-questao:hover {
  background: var(--folha-2);
}
.linha-questao.marcada {
  background: var(--acento-suave);
}
.enunciado-link:hover {
  text-decoration: underline;
  text-decoration-thickness: 1px;
  text-underline-offset: 3px;
}
@media (prefers-reduced-motion: reduce) {
  .trilho > i { animation: none; }
}
:global(:root.menos-movimento) .trilho > i {
  animation: none;
}
</style>
