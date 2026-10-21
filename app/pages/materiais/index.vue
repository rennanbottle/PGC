<script setup>
// Biblioteca: a caixa única de adicionar (arquivo, texto colado ou tema) e os textos em pastas, uma por matéria.
// Textos são opcionais: sem eles, as questões saem do assunto. "Para conferir" abre o "Confira rapidinho".
// "?adicionar=1" (ou o antigo "?enviar=1") põe o cursor na caixa; "&materia=" escolhe a matéria; "&tema=" já busca.
import { Archive, ChevronDown, Folder, FolderOpen, Globe, Search } from '@lucide/vue'
import { agruparPorMateria, lendo } from '#shared/regras/materiais.js'

useHead({ title: 'Biblioteca | PGC' })

const route = useRoute()
const router = useRouter()
const api = useMateriais()
const { data: textos, error, pending } = api
const { data: materias } = useMaterias()
const { data: numeros } = useNumerosMaterias()

const texto = (v) => (typeof v === 'string' ? v : '')
const materiaInicial = texto(route.query.materia)
const temaInicial = texto(route.query.tema).slice(0, 100)
const caixa = ref(null)
onMounted(() => {
  if (route.query.adicionar === '1' || route.query.enviar === '1' || temaInicial) {
    nextTick(() => caixa.value?.focar())
    router.replace({ query: {} })
  }
})

const ativos = computed(() => (textos.value ?? []).filter((t) => !t.arquivado_em))
const arquivados = computed(() => (textos.value ?? []).filter((t) => t.arquivado_em))
const paraConferir = computed(() => ativos.value.filter((t) => t.status === 'aguardando_conferencia').length)
const plural = (n, um, varios) => `${n} ${n === 1 ? um : varios}`
const resumo = computed(() => {
  if (!ativos.value.length) return 'Textos da escola que viram questões. São opcionais: sem texto, as questões saem do assunto.'
  const mats = new Set(ativos.value.map((t) => t.materia_id)).size
  const base = `${plural(ativos.value.length, 'texto', 'textos')} em ${plural(mats, 'matéria', 'matérias')}.`
  return paraConferir.value ? `${base} ${plural(paraConferir.value, 'espera', 'esperam')} você conferir.` : base
})

// Enquanto algum texto estiver sendo lido, a lista se atualiza sozinha.
let relogio = null
watch(() => ativos.value.some(lendo), (sim) => {
  clearInterval(relogio)
  if (sim && import.meta.client) relogio = setInterval(() => api.recarregar(), 3000)
}, { immediate: true })
onBeforeUnmount(() => clearInterval(relogio))

// Filtros (só quando a lista cresce)
const filtros = reactive({ busca: '', materia: '', situacao: '' })
const mostrarFiltros = computed(() => ativos.value.length >= 6)
const temFiltro = computed(() => !!(filtros.busca.trim() || filtros.materia || filtros.situacao))
const semAcento = (t) => String(t ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
const filtrados = computed(() => ativos.value.filter((t) => {
  if (filtros.materia && t.materia_id !== filtros.materia) return false
  if (filtros.situacao === 'lendo' ? !lendo(t) : filtros.situacao && t.status !== filtros.situacao) return false
  return !filtros.busca.trim() || semAcento(t.titulo).includes(semAcento(filtros.busca.trim()))
}))
const grupos = computed(() => agruparPorMateria(filtrados.value, materias.value ?? []))
const opcoesMateria = computed(() => [
  { valor: '', texto: 'Todas' },
  ...(materias.value ?? []).filter((m) => ativos.value.some((t) => t.materia_id === m.id)).map((m) => ({ valor: m.id, texto: m.nome, cor: `${corMateria(m.cor)}` })),
])
const opcoesSituacao = [
  { valor: '', texto: 'Todas' },
  { valor: 'pronto', texto: 'Prontos' },
  { valor: 'aguardando_conferencia', texto: 'Para conferir' },
  { valor: 'lendo', texto: 'Lendo' },
  { valor: 'erro', texto: 'Com erro' },
]
function limparFiltros() {
  Object.assign(filtros, { busca: '', materia: '', situacao: '' })
}

// Pastas abertas e fechadas
const fechadas = ref(new Set())
function alternar(id) {
  const s = new Set(fechadas.value)
  if (s.has(id)) s.delete(id)
  else s.add(id)
  fechadas.value = s
}
const verArquivados = ref(false)

// Conferir pela lista
const janelaConferir = ref(null)
const conferindo = ref(null)
function conferir(t) {
  conferindo.value = t
  nextTick(() => janelaConferir.value?.abrir())
}

const acoes = ref(null)
const questoesDe = (t) => numeros.value.porTexto[t.id]?.questoes ?? 0
</script>

<template>
  <div>
    <CabecalhoPagina titulo="Biblioteca" :descricao="resumo">
      <template #acoes>
        <NuxtLink to="/materiais/buscar" class="botao-secundario h-11">
          <Globe :size="17" :stroke-width="2" aria-hidden="true" />Textos abertos e Enem
        </NuxtLink>
      </template>
    </CabecalhoPagina>

    <MateriaisCaixaAdicionar ref="caixa" class="entra max-w-[1000px]" style="--i: 1" :materia-inicial="materiaInicial" :tema-inicial="temaInicial" />

    <p v-if="error" class="erro-campo mt-6" role="alert">Não deu para carregar os textos. Confira a internet e recarregue a página.</p>

    <div v-else-if="pending && !(textos ?? []).length" class="mt-8 grid max-w-[1000px] gap-2" aria-busy="true" aria-label="Carregando os textos">
      <span v-for="i in 3" :key="i" class="esqueleto h-16 rounded-[14px]" />
    </div>

    <div v-else-if="!ativos.length && !arquivados.length" class="entra mt-8 max-w-[1000px]" style="--i: 2">
      <Vazio titulo="Nenhum texto ainda" humor="acenando" texto="Textos são opcionais. Com o texto do professor, as questões seguem o que ele passou. Sem texto, o PGC cria questões só pelo assunto.">
        <template #acoes>
          <button type="button" class="botao-secundario h-11" @click="caixa?.focar()">Adicionar um texto</button>
          <BotaoIa @click="navigateTo('/questoes/gerar')">Gerar questões</BotaoIa>
        </template>
      </Vazio>
    </div>

    <section v-else data-guia="biblioteca-lista" class="entra mt-8 max-w-[1000px]" style="--i: 2" aria-labelledby="titulo-textos">
      <div class="mb-3 flex flex-wrap items-center justify-between gap-3">
        <h2 id="titulo-textos" class="titulo-secao">Seus textos</h2>
      </div>

      <div v-if="mostrarFiltros" class="mb-4 flex flex-wrap items-center gap-2" role="search">
        <label class="campo-icone w-full sm:w-[260px]">
          <span class="so-leitor">Buscar pelo nome do texto</span>
          <Search :size="17" :stroke-width="2" aria-hidden="true" />
          <input v-model="filtros.busca" class="campo campo-p" type="search" autocomplete="off">
        </label>
        <Selecao v-model="filtros.materia" variante="filtro" prefixo="Matéria" :opcoes="opcoesMateria" />
        <Selecao v-model="filtros.situacao" variante="filtro" prefixo="Situação" :opcoes="opcoesSituacao" :busca="false" />
        <button v-if="temFiltro" type="button" class="link ml-1 text-[14px]" @click="limparFiltros">Limpar</button>
      </div>

      <div class="cartao overflow-hidden p-0">
        <p v-if="!grupos.length" class="m-0 px-5 py-6 text-[15px] text-texto-2" role="status">
          Nenhum texto encontrado. <button type="button" class="link" @click="limparFiltros">Limpar a busca</button>
        </p>
        <div v-for="g in grupos" :key="g.materia?.id ?? 'sem'" class="pasta" :style="{ '--cor': `${corMateria(g.materia?.cor ?? 'cinza')}` }">
          <h3 class="m-0">
            <button type="button" class="cabeca-pasta" :aria-expanded="!fechadas.has(g.materia?.id)" @click="alternar(g.materia?.id)">
              <ChevronDown :size="17" :stroke-width="2.2" aria-hidden="true" class="seta" />
              <component :is="fechadas.has(g.materia?.id) ? Folder : FolderOpen" :size="19" :stroke-width="2" aria-hidden="true" class="text-texto-2" />
              <span class="ponto-cor" :style="{ background: 'var(--cor)' }" aria-hidden="true" />
              <span class="truncate font-titulo text-[16.5px] font-semibold">{{ g.materia?.nome ?? 'Sem matéria' }}</span>
              <span class="shrink-0 text-[13px] font-normal text-texto-3">{{ plural(g.textos.length, 'texto', 'textos') }}</span>
              <span v-if="g.textos.some((t) => t.status === 'aguardando_conferencia')" class="selo ml-1 hidden sm:inline-flex" data-tipo="aviso">
                {{ plural(g.textos.filter((t) => t.status === 'aguardando_conferencia').length, 'para conferir', 'para conferir') }}
              </span>
            </button>
          </h3>
          <Transition name="abre">
            <TransitionGroup v-if="!fechadas.has(g.materia?.id)" name="lista" tag="ul" class="galho m-0 list-none p-0">
              <li v-for="t in g.textos" :key="t.id">
                <MateriaisLinhaTexto :texto="t" :questoes="questoesDe(t)" :acoes="acoes?.itens(t) ?? []" @acao="acoes?.executar(t, $event)" @conferir="conferir(t)" />
              </li>
            </TransitionGroup>
          </Transition>
        </div>

        <div v-if="arquivados.length" class="pasta">
          <h3 class="m-0">
            <button type="button" class="cabeca-pasta text-texto-2" :aria-expanded="verArquivados" @click="verArquivados = !verArquivados">
              <ChevronDown :size="17" :stroke-width="2.2" aria-hidden="true" class="seta" />
              <Archive :size="18" :stroke-width="2" aria-hidden="true" />
              <span class="font-titulo text-[16px] font-semibold">Arquivados</span>
              <span class="text-[13px] font-normal text-texto-3">{{ plural(arquivados.length, 'texto', 'textos') }}</span>
            </button>
          </h3>
          <Transition name="abre">
            <ul v-if="verArquivados" class="galho m-0 list-none p-0">
              <li v-for="t in arquivados" :key="t.id">
                <MateriaisLinhaTexto :texto="t" :questoes="questoesDe(t)" :acoes="acoes?.itens(t) ?? []" @acao="acoes?.executar(t, $event)" />
              </li>
            </ul>
          </Transition>
        </div>
      </div>
    </section>

    <MateriaisAcoesTexto ref="acoes" />

    <JanelaBase ref="janelaConferir" larga :titulo="conferindo?.titulo ?? 'Conferir texto'">
      <MateriaisConfiraRapido
        v-if="conferindo"
        :key="conferindo.id"
        :material-id="conferindo.id"
        :versao-id="conferindo.versaoId ?? ''"
        :unidade="conferindo.formato === 'pdf' && conferindo.origem === 'arquivo' ? 'página' : 'parte'"
        @aprovado="janelaConferir?.fechar()"
      />
    </JanelaBase>
  </div>
</template>

<style scoped>
.pasta + .pasta {
  border-top: 1px solid var(--borda);
}
.cabeca-pasta {
  display: flex;
  align-items: center;
  gap: 9px;
  width: 100%;
  min-height: 52px;
  padding: 0 18px 0 14px;
  border: 0;
  background: transparent;
  color: var(--tinta);
  font: inherit;
  text-align: left;
  cursor: pointer;
  transition: background-color 0.18s;
}
.cabeca-pasta:hover {
  background: var(--folha-2);
}
.cabeca-pasta .seta {
  flex-shrink: 0;
  color: var(--texto-3);
  transition: transform 0.25s var(--ease-saida);
}
.cabeca-pasta[aria-expanded='false'] .seta {
  transform: rotate(-90deg);
}
/* Os textos ficam "pendurados" na pasta, como numa árvore de arquivos. */
.galho {
  position: relative;
  margin: 0 0 10px 30px;
}
.galho::before {
  content: '';
  position: absolute;
  top: 0;
  bottom: 14px;
  left: 0;
  width: 2px;
  border-radius: 2px;
  background: color-mix(in oklab, var(--cor, var(--borda-forte)) 40%, var(--borda));
}
.galho > li + li {
  border-top: 1px solid var(--borda);
}
@media (max-width: 639px) {
  .galho {
    margin-left: 18px;
  }
}
</style>
