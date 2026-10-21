<script setup>
// Página de um texto da Biblioteca: o texto para ler, do jeito que o PGC entendeu, e a ação principal
// "Gerar questões deste texto". Renomear, mover, uso de IA, baixar, arquivar e excluir ficam no menu (AcoesTexto).
// Enquanto o PGC lê o arquivo, a tela se atualiza sozinha. Texto esperando conferência mostra "Está bom, usar tudo".
// Ao lado: glossário, linha do tempo e textos parecidos (/api/materiais/:id/extras, sem IA).
import { Archive, ArchiveRestore, BookA, Check, CircleAlert, CopyCheck, ExternalLink, History, ListTree, RotateCw, ShieldCheck, SlidersHorizontal } from '@lucide/vue'
import { formatarTamanho, mensagemErroMaterial, origemDoTexto } from '#shared/regras/materiais.js'
import { contarPalavras } from '#shared/regras/analise.js'
import { FONTES_WIKI } from '#shared/regras/wikipedia.js'
import { IA_PERMITIDA } from '#shared/regras/perfil.js'

const route = useRoute()
const supabase = useSupabaseClient()
const id = String(route.params.id)
const consulta = useMaterial(id)
await consulta
const { data: dados, refresh } = consulta
if (!dados.value) throw createError({ statusCode: 404, statusMessage: 'Texto não encontrado', fatal: true })

const api = useMateriais()
const { data: materias } = useMaterias()
const { data: numeros } = useNumerosMaterias()
const { avisar } = useAvisos()
const acoes = ref(null)
const ocupado = ref(false)

const material = computed(() => dados.value?.material)
const versao = computed(() => dados.value?.versao)
const materia = computed(() => (materias.value ?? []).find((m) => m.id === material.value?.materia_id) ?? null)
const origem = computed(() => origemDoTexto(material.value))
const fonte = computed(() => FONTES_WIKI[origem.value] ?? null)
const porPagina = computed(() => material.value?.formato === 'pdf' && material.value?.origem === 'arquivo')
const ia = computed(() => IA_PERMITIDA.find((o) => o.valor === material.value?.ia_permitida) ?? IA_PERMITIDA[0])
useHead({ title: () => `${material.value?.titulo ?? 'Texto'} | PGC` })

const lendo = computed(() => ['enviando', 'extraindo'].includes(material.value?.status))
let relogio = null
watch(lendo, (sim) => {
  clearInterval(relogio)
  if (sim && import.meta.client) relogio = setInterval(() => refresh(), 3000)
}, { immediate: true })
onBeforeUnmount(() => clearInterval(relogio))

// O texto: os trechos da versão mais recente, na ordem, agrupados por página (ou parte).
const { data: trechos, pending: carregandoTexto } = useAsyncData(`material-trechos-${id}`, async () => {
  if (!versao.value?.id) return []
  const { data, error } = await supabase
    .from('material_trechos')
    .select('id, ordem, pagina, tipo, texto, usar_em_questoes')
    .eq('versao_id', versao.value.id)
    .order('ordem')
  if (error) throw error
  return data ?? []
}, { watch: [() => versao.value?.id], default: () => [] })

const paginas = computed(() => {
  const grupos = []
  for (const t of trechos.value ?? []) {
    let g = grupos.at(-1)
    if (!g || g.numero !== t.pagina) {
      g = { numero: t.pagina, trechos: [] }
      grupos.push(g)
    }
    g.trechos.push(t)
  }
  return grupos
})
const titulos = computed(() => (trechos.value ?? []).filter((t) => t.tipo === 'titulo').slice(0, 40))
const temFora = computed(() => (trechos.value ?? []).some((t) => !t.usar_em_questoes))
const palavras = computed(() => (trechos.value ?? []).reduce((soma, t) => soma + contarPalavras(t.texto), 0))
const minutos = computed(() => Math.max(1, Math.round(palavras.value / 200)))
const questoes = computed(() => numeros.value?.porTexto?.[id]?.questoes ?? 0)

// Glossário, linha do tempo e textos parecidos. Mostra os primeiros e abre o resto ao pedir.
const { data: extras } = useFetch(`/api/materiais/${id}/extras`, {
  key: `material-extras-${id}`,
  default: () => ({ glossario: [], linha: [], parecidos: [] }),
  watch: [() => versao.value?.id, () => material.value?.status],
  lazy: true,
})
const todoGlossario = ref(false)
const todaLinha = ref(false)
const glossarioVisivel = computed(() => (todoGlossario.value ? extras.value.glossario : extras.value.glossario.slice(0, 5)))
const linhaVisivel = computed(() => (todaLinha.value ? extras.value.linha : extras.value.linha.slice(0, 6)))

const resumoOrigem = computed(() => {
  const m = material.value
  if (fonte.value) return fonte.value.nome
  if (origem.value === 'colado') return 'Texto colado'
  const partes = [String(m?.formato ?? '').toUpperCase()]
  if (m?.paginas) partes.push(`${m.paginas} ${m.paginas === 1 ? 'página' : 'páginas'}`)
  if (m?.tamanho_bytes) partes.push(formatarTamanho(m.tamanho_bytes))
  return partes.filter(Boolean).join(', ')
})

// O menu da página é o mesmo da lista, sem "Gerar questões" (que já é o botão principal).
const itensMenu = computed(() => (acoes.value?.itens(material.value) ?? [])
  .filter((i) => i.id !== 'gerar')
  .map((i, n) => (n === 0 ? { ...i, separar: false } : i)))

const gerar = () => navigateTo(`/questoes/gerar?texto=${id}&materia=${material.value.materia_id}`)

async function usarTudo() {
  ocupado.value = true
  try {
    await api.aprovarTudo(id, versao.value.id)
    avisar({ texto: 'Texto aprovado inteiro. Já dá para gerar questões.', tipo: 'ok' })
  }
  catch (e) {
    avisar({ texto: e.message, tipo: 'erro' })
  }
  ocupado.value = false
}

async function lerDeNovo() {
  ocupado.value = true
  const r = await api.extrair(id)
  ocupado.value = false
  if (r?.status === 'erro') avisar({ texto: mensagemErroMaterial(r.erro), tipo: 'erro' })
  else avisar({ texto: 'Texto lido de novo.', tipo: 'ok' })
}
</script>

<template>
  <div v-if="material">
    <CabecalhoPagina :titulo="material.titulo" :voltar="{ para: '/materiais', texto: 'Biblioteca' }">
      <template #descricao>
        <span class="flex flex-wrap items-center gap-x-4 gap-y-1">
          <NuxtLink v-if="materia" :to="`/materias/${materia.id}`" class="inline-flex items-center gap-1.5 font-semibold text-tinta no-underline hover:underline">
            <span class="size-2.5 rounded-full" :style="{ background: `${corMateria(materia.cor)}` }" aria-hidden="true" />{{ materia.nome }}
          </NuxtLink>
          <span>{{ resumoOrigem }}</span>
          <span v-if="palavras">{{ palavras.toLocaleString('pt-BR') }} palavras, leitura de {{ minutos }} min</span>
        </span>
      </template>
      <template #acoes>
        <BotaoIa v-if="material.status === 'pronto' && !material.arquivado_em" @click="gerar">Gerar questões deste texto</BotaoIa>
        <MenuAcoes rotulo="Mais ações do texto" :itens="itensMenu" @escolher="acoes?.executar(material, $event)" />
      </template>
    </CabecalhoPagina>

    <div v-if="material.arquivado_em" class="painel mb-6 flex flex-wrap items-center gap-3 text-[14.5px]">
      <Archive :size="18" :stroke-width="2" aria-hidden="true" class="shrink-0 text-texto-2" />
      <span class="min-w-0 flex-1">Este texto está arquivado. Ele não aparece na lista nem na escolha de textos para gerar questões.</span>
      <button type="button" class="botao-secundario botao-p" @click="acoes?.executar(material, 'restaurar')">
        <ArchiveRestore :size="16" :stroke-width="2" aria-hidden="true" />Restaurar
      </button>
    </div>

    <Transition name="abre">
      <section v-if="material.status === 'aguardando_conferencia'" class="cartao-destaque mb-6 flex flex-col gap-4 sm:flex-row sm:items-center" aria-labelledby="titulo-conferir">
        <GuiaPersonagem humor="pensando" :tamanho="56" class="shrink-0 max-sm:hidden" />
        <div class="min-w-0 flex-1">
          <h2 id="titulo-conferir" class="titulo-cartao m-0">Confira se o texto saiu certo</h2>
          <p class="m-0 mt-1 text-[14.5px] text-texto-2">Passe o olho no texto abaixo. As questões só saem do que você aprovar.</p>
        </div>
        <div class="flex flex-wrap gap-2">
          <button type="button" class="botao" :aria-busy="ocupado" :disabled="ocupado" @click="usarTudo">
            <Check :size="17" :stroke-width="2.4" aria-hidden="true" />Está bom, usar tudo
          </button>
          <NuxtLink :to="`/materiais/${id}/conferir`" class="botao-fantasma no-underline">
            <SlidersHorizontal :size="16" :stroke-width="2" aria-hidden="true" />Ajustar páginas
          </NuxtLink>
        </div>
      </section>
    </Transition>

    <section v-if="material.status === 'erro'" class="cartao flex flex-col gap-4 sm:flex-row sm:items-center" role="alert">
      <CircleAlert :size="26" :stroke-width="2" aria-hidden="true" class="shrink-0 text-erro" />
      <div class="min-w-0 flex-1">
        <h2 class="titulo-cartao m-0">Não deu para ler este texto</h2>
        <p class="m-0 mt-1 text-[14.5px] text-texto-2">{{ mensagemErroMaterial(material.erro_codigo) }}</p>
      </div>
      <button v-if="material.arquivo_caminho" type="button" class="botao-secundario" :aria-busy="ocupado" :disabled="ocupado" @click="lerDeNovo">
        <RotateCw :size="16" :stroke-width="2" aria-hidden="true" />Ler de novo
      </button>
    </section>

    <section v-else-if="lendo" class="cartao flex items-center gap-5" role="status">
      <GuiaPersonagem humor="pensando" :tamanho="72" class="shrink-0" />
      <div>
        <h2 class="titulo-cartao m-0">Lendo o texto</h2>
        <p class="m-0 mt-1 text-[14.5px] text-texto-2">Arquivos grandes levam até um minuto. Esta página se atualiza sozinha.</p>
      </div>
    </section>

    <div v-else class="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_280px]">
      <article class="cartao min-w-0 px-5 py-7 sm:px-10" :aria-label="`Texto: ${material.titulo}`">
        <div class="max-w-[70ch]">
          <template v-if="carregandoTexto && !trechos.length">
            <div v-for="n in 6" :key="n" class="esqueleto mb-3 h-4 rounded-full" :style="{ width: `${96 - n * 8}%` }" />
          </template>
          <Vazio v-else-if="!trechos.length" compacto humor="pensando" titulo="Nada para mostrar" texto="A leitura não achou texto neste arquivo. Envie de novo ou cole o texto na Biblioteca." />
          <template v-else>
            <p v-if="temFora" class="m-0 mb-5 text-[13.5px] text-texto-3">As partes apagadas ficam fora das questões.</p>
            <section v-for="p in paginas" :key="p.numero" :aria-label="`${porPagina ? 'Página' : 'Parte'} ${p.numero}`">
              <div v-if="paginas.length > 1" class="mb-4 mt-8 flex items-center gap-3 text-[12.5px] font-semibold text-texto-3 first:mt-0" aria-hidden="true">
                <span>{{ porPagina ? 'Página' : 'Parte' }} {{ p.numero }}</span>
                <span class="h-px flex-1 bg-borda" />
              </div>
              <div v-for="t in p.trechos" :key="t.id" :class="!t.usar_em_questoes && 'opacity-55'">
                <h2 v-if="t.tipo === 'titulo'" :id="`trecho-${t.id}`" class="m-0 mb-3 mt-6 scroll-mt-6 font-titulo text-[22px] font-semibold leading-tight">{{ t.texto }}</h2>
                <p v-else-if="t.tipo === 'formula'" class="m-0 mb-4 overflow-x-auto rounded-[12px] bg-folha-2 px-4 py-3 font-mono text-[15px]">{{ t.texto }}</p>
                <div v-else-if="t.tipo === 'tabela'" class="mb-4 overflow-x-auto rounded-[12px] border border-borda" tabindex="0" aria-label="Tabela">
                  <pre class="m-0 p-4 font-mono text-[13.5px] leading-relaxed">{{ t.texto }}</pre>
                </div>
                <p v-else-if="t.tipo === 'rodape'" class="m-0 mb-3 text-[13px] text-texto-3">{{ t.texto }}</p>
                <TextoRico v-else :texto="t.texto" tag="div" class="mb-4 text-[16.5px] leading-[1.75]" />
                <span v-if="!t.usar_em_questoes" class="so-leitor">Fora das questões.</span>
              </div>
            </section>
          </template>
        </div>
      </article>

      <aside class="flex flex-col gap-5" aria-label="Sobre o texto">
        <nav v-if="titulos.length > 1" class="cartao-p hidden lg:block" aria-label="Partes do texto">
          <h2 class="m-0 mb-2 flex items-center gap-2 text-[14.5px] font-semibold">
            <ListTree :size="17" :stroke-width="2" aria-hidden="true" class="text-texto-2" />Neste texto
          </h2>
          <ol class="m-0 flex list-none flex-col p-0">
            <li v-for="t in titulos" :key="t.id">
              <a :href="`#trecho-${t.id}`" class="block truncate rounded-[10px] px-2 py-1.5 text-[14px] text-texto-2 no-underline hover:bg-folha-2 hover:text-tinta">{{ t.texto }}</a>
            </li>
          </ol>
        </nav>

        <div class="cartao-p">
          <p class="numero-medio m-0"><NumeroAnimado :valor="questoes" /></p>
          <p class="m-0 text-[14px] text-texto-2">{{ questoes === 1 ? 'questão saiu' : 'questões saíram' }} deste texto</p>
          <hr class="divisoria my-4">
          <template v-if="fonte">
            <p class="m-0 flex items-center gap-2 text-[14.5px] font-semibold">
              <ShieldCheck :size="17" :stroke-width="2" aria-hidden="true" class="text-ok" />{{ fonte.nome }}
            </p>
            <p class="m-0 mt-1 text-[13.5px] leading-snug text-texto-2">Licença {{ material.fonte_licenca || 'CC BY-SA 4.0' }}: pode usar para estudar, citando a fonte.</p>
            <a v-if="material.fonte_url" :href="material.fonte_url" target="_blank" rel="noopener noreferrer" class="link mt-2 inline-flex items-center gap-1.5 text-[14px]">
              Abrir a página original<ExternalLink :size="14" :stroke-width="2" aria-hidden="true" /><span class="so-leitor"> (abre em outra aba)</span>
            </a>
          </template>
          <template v-else>
            <p class="m-0 flex items-center gap-2 text-[14.5px] font-semibold">
              <ShieldCheck :size="17" :stroke-width="2" aria-hidden="true" class="text-texto-2" />Quem pode ler
            </p>
            <p class="m-0 mt-1 text-[13.5px] leading-snug text-texto-2">{{ ia.texto }}.</p>
            <button type="button" class="link mt-2 text-[14px]" @click="acoes?.executar(material, 'ia')">Mudar</button>
          </template>
        </div>

        <section v-if="extras.parecidos.length" class="cartao-p" aria-labelledby="titulo-parecidos">
          <h2 id="titulo-parecidos" class="m-0 flex items-center gap-2 text-[14.5px] font-semibold">
            <CopyCheck :size="17" :stroke-width="2" aria-hidden="true" class="text-texto-2" />Textos parecidos
          </h2>
          <ul class="m-0 mt-2 flex list-none flex-col gap-3 p-0">
            <li v-for="t in extras.parecidos" :key="t.id">
              <NuxtLink :to="`/materiais/${t.id}`" class="font-semibold text-tinta no-underline hover:underline">{{ t.titulo }}</NuxtLink>
              <p class="m-0 mt-0.5 flex flex-wrap items-center gap-2 text-[13px] text-texto-2">
                <span v-if="t.quaseIgual" class="selo" data-tipo="aviso">Quase igual</span>
                <span>{{ t.porcentagem }}% parecido</span>
              </p>
              <p v-if="t.quaseIgual" class="m-0 mt-1 text-[13px] text-texto-2">Pode ser o mesmo texto enviado duas vezes. Se for, arquive um deles.</p>
              <p v-else-if="t.comuns.length" class="m-0 mt-1 text-[13px] text-texto-2">Em comum: {{ t.comuns.join(', ') }}.</p>
            </li>
          </ul>
        </section>

        <section v-if="extras.glossario.length" class="cartao-p" aria-labelledby="titulo-glossario">
          <h2 id="titulo-glossario" class="m-0 flex items-center gap-2 text-[14.5px] font-semibold">
            <BookA :size="17" :stroke-width="2" aria-hidden="true" class="text-texto-2" />Glossário<span class="font-normal text-texto-2">{{ extras.glossario.length }}</span>
          </h2>
          <dl class="m-0 mt-2 flex flex-col gap-2.5">
            <div v-for="g in glossarioVisivel" :key="g.termo">
              <dt class="text-[14px] font-semibold">{{ g.termo }}</dt>
              <dd class="m-0 text-[13.5px] leading-snug text-texto-2">{{ g.definicao }}<template v-if="g.pagina && porPagina"> (página {{ g.pagina }})</template></dd>
            </div>
          </dl>
          <button v-if="extras.glossario.length > 5" type="button" class="link mt-2 text-[14px]" :aria-expanded="todoGlossario" @click="todoGlossario = !todoGlossario">{{ todoGlossario ? 'Mostrar menos' : `Ver os ${extras.glossario.length} termos` }}</button>
        </section>

        <section v-if="extras.linha.length >= 2" class="cartao-p" aria-labelledby="titulo-linha">
          <h2 id="titulo-linha" class="m-0 flex items-center gap-2 text-[14.5px] font-semibold">
            <History :size="17" :stroke-width="2" aria-hidden="true" class="text-texto-2" />Linha do tempo
          </h2>
          <ol class="mt-3 list-none p-0 ml-tempo">
            <li v-for="(e, i) in linhaVisivel" :key="i" class="relative pb-3 pl-5 last:pb-0">
              <span class="ml-tempo-ponto" aria-hidden="true" />
              <p class="m-0 text-[13.5px] font-semibold tabular-nums">{{ e.rotulo }}</p>
              <p class="m-0 text-[13.5px] leading-snug text-texto-2">{{ e.fato }}</p>
            </li>
          </ol>
          <button v-if="extras.linha.length > 6" type="button" class="link mt-2 text-[14px]" :aria-expanded="todaLinha" @click="todaLinha = !todaLinha">{{ todaLinha ? 'Mostrar menos' : `Ver as ${extras.linha.length} datas` }}</button>
        </section>
      </aside>
    </div>

    <MateriaisAcoesTexto ref="acoes" @excluido="navigateTo('/materiais')" />
  </div>
</template>

<style scoped>
.ml-tempo { position: relative; margin: 12px 0 0; }
.ml-tempo::before { content: ''; position: absolute; top: 6px; bottom: 6px; left: 4px; width: 2px; border-radius: 2px; background: var(--borda); }
.ml-tempo-ponto { position: absolute; top: 5px; left: 0; width: 10px; height: 10px; border: 2px solid var(--acento); border-radius: 50%; background: var(--folha); }
</style>
