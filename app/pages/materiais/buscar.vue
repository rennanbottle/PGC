<script setup>
// Textos abertos e Enem, para quem ainda não tem o próprio texto.
// Wikilivros, Wikiversidade e Wikipédia viram textos da Biblioteca com a fonte e a licença guardadas (já aprovados);
// o Enem vira questões no banco. Sites sem API aberta ficam em "Mais fontes", com o passo a passo.
// "?materia=" escolhe a matéria; "?fonte=" abre uma fonte; "?tema=" já busca.
import { BookOpen, ChevronDown, ClipboardCheck, Code, ExternalLink, Globe, GraduationCap, Landmark, Library, Plus, Search, ShieldCheck, TriangleAlert } from '@lucide/vue'
import { FONTES_WIKI } from '#shared/regras/wikipedia.js'

useHead({ title: 'Textos abertos e Enem | PGC' })
const route = useRoute()
const apiMaterias = useMaterias()
await apiMaterias.pronto
const ativas = computed(() => (apiMaterias.data.value ?? []).filter((m) => !m.arquivada_em))
const id = useId()

const WIKI = (fonte, icone, resumo) => ({ id: fonte, nome: FONTES_WIKI[fonte].nome, icone, tipo: 'wiki', resumo, descricao: FONTES_WIKI[fonte].descricao, grupo: 'Textos para ler' })
const PRINCIPAIS = [
  WIKI('wikilivros', BookOpen, 'Livros didáticos, por capítulo'),
  WIKI('wikiversidade', GraduationCap, 'Aulas e cursos abertos'),
  WIKI('wikipedia', Globe, 'Enciclopédia, boa para conceitos'),
  { id: 'enem', nome: 'Enem 2009 a 2023', icone: ClipboardCheck, tipo: 'enem', resumo: 'Questões oficiais com gabarito', descricao: 'Provas do Enem com o gabarito oficial. As questões entram direto no seu banco.', grupo: 'Questões de provas' },
]
const PASSOS_PDF = ['Abra a página e use Imprimir e Salvar como PDF.', 'Adicione o PDF na Biblioteca. O arquivo fica só na sua conta.']
const OUTRAS = [
  { id: 'obmep', nome: 'OBMEP', icone: ClipboardCheck, resumo: 'Provas de matemática com soluções', descricao: 'Provas da Olimpíada Brasileira de Matemática das Escolas Públicas, com soluções.', url: 'https://www.obmep.org.br/provas.htm', passos: ['Baixe a prova e o gabarito em PDF no site da OBMEP.', 'Em Questões, use Importar prova e envie o PDF.'], destino: { para: '/questoes?importar=1', nome: 'Importar prova' } },
  { id: 'leis', nome: 'Planalto', icone: Landmark, resumo: 'Constituição, códigos e leis', descricao: 'Leis federais no texto oficial. Texto de lei não tem direito autoral.', url: 'https://www4.planalto.gov.br/legislacao', passos: ['Abra a lei no site do Planalto.', ...PASSOS_PDF] },
  { id: 'scielo', nome: 'SciELO', icone: Library, resumo: 'Artigos científicos brasileiros', descricao: 'Artigos de revistas brasileiras, a maioria com licença CC BY.', url: 'https://www.scielo.br', passos: ['Ache o artigo e baixe o PDF.', 'Adicione o PDF na Biblioteca.'] },
  { id: 'educapes', nome: 'eduCAPES', icone: Library, resumo: 'Apostilas de universidades', descricao: 'Apostilas, livros e aulas de universidades públicas. A licença vem em cada item.', url: 'https://educapes.capes.gov.br', passos: ['Confira a licença do item e baixe o PDF.', 'Adicione o PDF na Biblioteca.'] },
  { id: 'dominio', nome: 'Domínio Público', icone: Library, resumo: 'Livros liberados', descricao: 'Biblioteca do governo com obras em domínio público ou liberadas pelos autores.', url: 'http://www.dominiopublico.gov.br', passos: ['Baixe a obra em PDF.', 'Adicione o PDF na Biblioteca.'] },
  { id: 'mdn', nome: 'MDN em português', icone: Code, resumo: 'HTML, CSS e JavaScript', descricao: 'Documentação da web mantida pela Mozilla, com licença CC BY-SA.', url: 'https://developer.mozilla.org/pt-BR/', passos: ['Abra a página do assunto.', ...PASSOS_PDF] },
  { id: 'python', nome: 'Tutorial do Python', icone: Code, resumo: 'O tutorial oficial traduzido', descricao: 'O tutorial oficial do Python, traduzido pela comunidade brasileira.', url: 'https://docs.python.org/pt-br/3/tutorial/', passos: ['Abra o capítulo.', ...PASSOS_PDF] },
].map((f) => ({ ...f, tipo: 'link', grupo: 'Outros sites' }))
const TODAS = [...PRINCIPAIS, ...OUTRAS]
const CONFIANCA = {
  wiki: { selo: 'CC BY-SA 4.0', texto: 'Licença livre: pode usar para estudar, citando a fonte. O PGC guarda o link e a licença junto do texto.', cuidado: 'Qualquer pessoa pode editar estas páginas. Leia com atenção antes de estudar.' },
  enem: { selo: 'Prova oficial', texto: 'Provas públicas do INEP, trazidas pela API aberta enem.dev com o gabarito oficial.', cuidado: 'Questão com alternativas em imagem fica de fora.' },
  link: { selo: 'Site externo', texto: 'Este site não tem uma forma aberta de o PGC buscar sozinho. Traga o arquivo assim:', cuidado: '' },
}

const fonteId = ref(TODAS.some((f) => f.id === route.query.fonte) ? String(route.query.fonte) : 'wikilivros')
const fonte = computed(() => TODAS.find((f) => f.id === fonteId.value))
const confianca = computed(() => CONFIANCA[fonte.value.tipo])
const maisAberto = ref(OUTRAS.some((f) => f.id === fonteId.value))
const opcoesFonte = TODAS.map((f) => ({ valor: f.id, texto: f.nome, descricao: f.resumo, icone: f.icone, grupo: f.grupo }))

const materiaId = ref(typeof route.query.materia === 'string' && ativas.value.some((m) => m.id === route.query.materia) ? route.query.materia : ativas.value[0]?.id ?? '')
const materia = computed(() => ativas.value.find((m) => m.id === materiaId.value) ?? null)
const opcoesMateria = computed(() => ativas.value.map((m) => ({ valor: m.id, texto: m.nome, cor: `${corMateria(m.cor)}` })))

const tema = ref(typeof route.query.tema === 'string' ? route.query.tema.slice(0, 120) : '')
const temaBuscado = ref(tema.value.trim())
const buscar = () => { temaBuscado.value = tema.value.trim() }
const destino = (f) => f.destino?.para ?? `/materiais?adicionar=1${materiaId.value ? `&materia=${materiaId.value}` : ''}`
const aoImportar = (novo) => { if (novo) navigateTo(`/materiais/${novo}`) }
</script>

<template>
  <div>
    <CabecalhoPagina
      titulo="Textos abertos e Enem"
      descricao="Textos livres para estudar e questões de provas antigas, sempre com a fonte guardada."
      :voltar="{ para: '/materiais', texto: 'Biblioteca' }"
    />

    <Vazio v-if="!ativas.length" titulo="Crie uma matéria primeiro" texto="Todo texto e toda questão ficam numa matéria. Depois volte aqui." humor="acenando">
      <template #acoes>
        <NuxtLink to="/materias?nova=1" class="botao no-underline"><Plus :size="17" :stroke-width="2.2" aria-hidden="true" />Criar matéria</NuxtLink>
      </template>
    </Vazio>

    <div v-else class="grid items-start gap-6 lg:grid-cols-[280px_minmax(0,1fr)]">
      <div class="max-w-[420px] lg:hidden">
        <label class="rotulo" :for="`${id}-fonte`">Fonte</label>
        <Selecao :id="`${id}-fonte`" v-model="fonteId" :opcoes="opcoesFonte" />
      </div>

      <nav class="hidden flex-col gap-1 lg:flex" aria-label="Fontes">
        <template v-for="(grupo, i) in ['Textos para ler', 'Questões de provas']" :key="grupo">
          <h2 class="m-0 mb-1 px-3 text-[13px] font-semibold text-texto-3" :class="i && 'mt-4'">{{ grupo }}</h2>
          <button
            v-for="f in PRINCIPAIS.filter((x) => x.grupo === grupo)"
            :key="f.id"
            type="button"
            class="fonte"
            :aria-current="fonteId === f.id ? 'true' : undefined"
            @click="fonteId = f.id"
          >
            <component :is="f.icone" :size="18" :stroke-width="2" aria-hidden="true" class="mt-0.5 shrink-0" />
            <span class="min-w-0">
              <span class="block font-semibold">{{ f.nome }}</span>
              <span class="block text-[13px] text-texto-2">{{ f.resumo }}</span>
            </span>
          </button>
        </template>
        <button type="button" class="botao-fantasma botao-p mt-3 self-start" :aria-expanded="maisAberto" @click="maisAberto = !maisAberto">
          <ChevronDown :size="16" :stroke-width="2" aria-hidden="true" class="transition-transform" :class="maisAberto && 'rotate-180'" />Mais fontes
        </button>
        <Transition name="abre">
          <div v-if="maisAberto" class="flex flex-col gap-1">
            <button v-for="f in OUTRAS" :key="f.id" type="button" class="fonte" :aria-current="fonteId === f.id ? 'true' : undefined" @click="fonteId = f.id">
              <component :is="f.icone" :size="18" :stroke-width="2" aria-hidden="true" class="mt-0.5 shrink-0" />
              <span class="min-w-0">
                <span class="block font-semibold">{{ f.nome }}</span>
                <span class="block text-[13px] text-texto-2">{{ f.resumo }}</span>
              </span>
            </button>
          </div>
        </Transition>
      </nav>

      <section class="cartao min-w-0" :aria-labelledby="`${id}-titulo`">
        <div class="flex flex-wrap items-start justify-between gap-3">
          <div class="min-w-0">
            <h2 :id="`${id}-titulo`" class="titulo-secao m-0 flex items-center gap-2.5">
              <component :is="fonte.icone" :size="22" :stroke-width="2" aria-hidden="true" class="text-texto-2" />{{ fonte.nome }}
            </h2>
            <p class="m-0 mt-1 text-[15px] text-texto-2">{{ fonte.descricao }}</p>
          </div>
          <span class="selo" :data-tipo="fonte.tipo === 'link' ? undefined : 'ok'">
            <ShieldCheck :size="14" :stroke-width="2.2" aria-hidden="true" />{{ confianca.selo }}
          </span>
        </div>

        <div class="mt-4 flex flex-col gap-1.5 border-l-2 border-borda-forte pl-4 text-[14px] leading-snug">
          <p class="m-0">{{ confianca.texto }}</p>
          <p v-if="confianca.cuidado" class="m-0 flex items-start gap-1.5 text-texto-2">
            <TriangleAlert :size="15" :stroke-width="2" aria-hidden="true" class="mt-0.5 shrink-0 text-aviso" />{{ confianca.cuidado }}
          </p>
        </div>

        <hr class="divisoria my-6">

        <template v-if="fonte.tipo !== 'link'">
          <form class="flex flex-wrap items-end gap-4" @submit.prevent="buscar">
            <div class="w-full sm:w-[240px]">
              <label class="rotulo" :for="`${id}-materia`">Para a matéria</label>
              <Selecao :id="`${id}-materia`" v-model="materiaId" :opcoes="opcoesMateria" />
            </div>
            <template v-if="fonte.tipo === 'wiki'">
              <div class="min-w-0 flex-1 basis-[260px]">
                <label class="rotulo" :for="`${id}-tema`">Tema</label>
                <input :id="`${id}-tema`" v-model="tema" class="campo" type="search" maxlength="120" :aria-describedby="`${id}-tema-ajuda`">
              </div>
              <button type="submit" class="botao-secundario h-[50px]" :disabled="!tema.trim()">
                <Search :size="16" :stroke-width="2" aria-hidden="true" />Buscar
              </button>
              <p :id="`${id}-tema-ajuda`" class="ajuda m-0 w-full">Escreva como no caderno, por exemplo: funções do 2º grau, Era Vargas, listas em Python.</p>
            </template>
          </form>

          <FontesWiki v-if="fonte.tipo === 'wiki' && temaBuscado" :key="`${fonte.id}-${temaBuscado}`" class="mt-6" :tema="temaBuscado" :fonte="fonte.id" :materia-id="materiaId" @importou="aoImportar" />
          <FontesEnem v-else-if="fonte.tipo === 'enem'" class="mt-6" :materia="materia" />
        </template>

        <div v-else class="max-w-[620px]">
          <ol class="m-0 flex list-none flex-col gap-3 p-0">
            <li v-for="(p, i) in fonte.passos" :key="i" class="flex gap-3 text-[15px] leading-[1.5]">
              <b class="grid size-7 shrink-0 place-items-center rounded-full bg-folha-2 text-[13px]" aria-hidden="true">{{ i + 1 }}</b>
              <span class="pt-0.5">{{ p }}</span>
            </li>
          </ol>
          <div class="mt-6 flex flex-wrap items-center gap-3">
            <NuxtLink :to="destino(fonte)" class="botao no-underline">{{ fonte.destino?.nome ?? 'Adicionar na Biblioteca' }}</NuxtLink>
            <a :href="fonte.url" target="_blank" rel="noopener noreferrer" class="botao-secundario no-underline">
              Abrir o site<ExternalLink :size="15" :stroke-width="2" aria-hidden="true" /><span class="so-leitor"> (abre em outra aba)</span>
            </a>
          </div>
        </div>
      </section>
    </div>
  </div>
</template>

<style scoped>
.fonte {
  display: flex;
  gap: 12px;
  width: 100%;
  min-height: 44px;
  padding: 10px 12px;
  border: 0;
  border-radius: 14px;
  background: transparent;
  color: var(--color-tinta);
  font: inherit;
  font-size: 14.5px;
  text-align: left;
  cursor: pointer;
  transition: background-color 0.15s ease;
}
.fonte:hover { background: var(--color-folha-2); }
.fonte[aria-current='true'] { background: var(--color-acento-suave); color: var(--color-acento); }
.fonte[aria-current='true'] .text-texto-2 { color: var(--color-tinta); }
.fonte:focus-visible { outline: 2px solid var(--color-acento); outline-offset: 2px; }
</style>
