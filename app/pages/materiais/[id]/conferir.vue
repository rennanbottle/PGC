<script setup>
// Conferir o texto, página por página. Cada trecho pode ser editado (linha em branco divide em dois),
// juntado com o próximo, mudado de tipo, ligado a um assunto ou tirado das questões.
// À direita, as definições e fórmulas da página para aprovar, editar ou recusar.
// "Aprovar esta página" aprova também os conceitos que não foram recusados.
import { Check, ChevronLeft, ChevronRight, Merge, Pencil, RotateCcw } from '@lucide/vue'
import { assuntosAtivos } from '#shared/regras/materias.js'

const route = useRoute()
const router = useRouter()
const supabase = useSupabaseClient()
const id = route.params.id
const consulta = useMaterial(id)
await consulta
const { data: dados, refresh } = consulta
if (!dados.value?.versao) throw createError({ statusCode: 404, statusMessage: 'Material não encontrado', fatal: true })

const api = useMateriais()
const { data: materias } = useMaterias()
const material = computed(() => dados.value?.material)
const versao = computed(() => dados.value?.versao)
const paginas = computed(() => versao.value?.material_paginas ?? [])
const assuntos = computed(() => assuntosAtivos((materias.value ?? []).find((m) => m.id === material.value?.materia_id)))
const opcoesAssunto = computed(() => [{ valor: '', texto: 'Nenhum' }, ...assuntos.value.map((a) => ({ valor: a.id, texto: a.nome }))])
const opcoesTipo = computed(() => Object.entries(TIPOS).map(([valor, texto]) => ({ valor, texto })))
const unidade = computed(() => (material.value?.formato === 'pdf' && material.value?.origem === 'arquivo' ? 'Página' : 'Parte'))
useHead({ title: () => `Conferir ${material.value?.titulo ?? ''} | PGC` })

const primeiraPendente = () => paginas.value.find((p) => !p.conferida_em)?.numero ?? 1
const pagina = ref(Math.min(Math.max(1, Number(route.query.pagina) || primeiraPendente()), Math.max(1, paginas.value.length)))
watch(pagina, (n) => router.replace({ query: { pagina: n } }))
const atual = computed(() => paginas.value.find((p) => p.numero === pagina.value))
const conferidas = computed(() => paginas.value.filter((p) => p.conferida_em).length)

const { data: conteudo, refresh: recarregarPagina } = useAsyncData(`conferir-${id}`, async () => {
  const [t, c] = await Promise.all([
    supabase.from('material_trechos').select('id, ordem, pagina, tipo, texto, usar_em_questoes, assunto_id').eq('versao_id', versao.value.id).eq('pagina', pagina.value).order('ordem'),
    supabase.from('conceitos').select('id, tipo, termo, definicao, status, trecho_id').eq('versao_id', versao.value.id).eq('pagina', pagina.value).order('criado_em'),
  ])
  if (t.error) throw t.error
  return { trechos: t.data, conceitos: c.data ?? [] }
}, { watch: [pagina], default: () => ({ trechos: [], conceitos: [] }) })
const trechos = computed(() => conteudo.value?.trechos ?? [])

const erro = ref('')
const ocupado = ref(false)
async function executar(fn) {
  erro.value = ''
  ocupado.value = true
  try {
    await fn()
    await recarregarPagina()
  }
  catch (e) {
    erro.value = e?.message?.startsWith('Não') ? e.message : 'Não deu para salvar agora. Confira a internet e tente de novo.'
  }
  ocupado.value = false
}
async function gravar(pedido) {
  const { error } = await pedido
  if (error) throw error
}

// ---------- Trechos ----------
const TIPOS = { texto: 'Texto', titulo: 'Título', lista: 'Lista', formula: 'Fórmula', tabela: 'Tabela', rodape: 'Rodapé' }
const editando = ref(null)
const rascunho = reactive({ texto: '', tipo: 'texto', assunto: '' })
function editar(t) {
  editando.value = t.id
  Object.assign(rascunho, { texto: t.texto, tipo: t.tipo, assunto: t.assunto_id ?? '' })
  nextTick(() => document.getElementById(`editor-${t.id}`)?.focus())
}
function salvarEdicao(t, i) {
  const partes = rascunho.texto.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean)
  if (!partes.length) {
    erro.value = 'O trecho não pode ficar vazio. Para tirar das questões, use "Não usar".'
    return
  }
  const proximo = trechos.value[i + 1]
  const passo = ((proximo?.ordem ?? t.ordem + 1) - t.ordem) / partes.length
  executar(async () => {
    await gravar(supabase.from('material_trechos').update({ texto: partes[0].slice(0, 20000), tipo: rascunho.tipo, assunto_id: rascunho.assunto || null }).eq('id', t.id))
    if (partes.length > 1) {
      await gravar(supabase.from('material_trechos').insert(partes.slice(1).map((texto, k) => ({
        versao_id: versao.value.id,
        ordem: t.ordem + passo * (k + 1),
        pagina: t.pagina,
        tipo: rascunho.tipo,
        texto: texto.slice(0, 20000),
        usar_em_questoes: t.usar_em_questoes,
        assunto_id: rascunho.assunto || null,
      }))))
    }
    editando.value = null
  })
}
function juntar(t, i) {
  const proximo = trechos.value[i + 1]
  if (!proximo) return
  const sep = t.tipo === 'lista' ? '\n' : ' '
  executar(async () => {
    await gravar(supabase.from('material_trechos').update({ texto: `${t.texto}${sep}${proximo.texto}`.slice(0, 20000) }).eq('id', t.id))
    await gravar(supabase.from('material_trechos').delete().eq('id', proximo.id))
  })
}
function alternarUso(t) {
  const usar = !t.usar_em_questoes
  executar(() => gravar(supabase.from('material_trechos').update({ usar_em_questoes: usar, tipo: usar && t.tipo === 'rodape' ? 'texto' : t.tipo }).eq('id', t.id)))
}
const assuntoDaPagina = ref('')
function aplicarAssunto() {
  executar(() => gravar(supabase.from('material_trechos').update({ assunto_id: assuntoDaPagina.value || null }).eq('versao_id', versao.value.id).eq('pagina', pagina.value).eq('usar_em_questoes', true)))
}
const nomeAssunto = (aid) => assuntos.value.find((a) => a.id === aid)?.nome

// ---------- Conceitos ----------
const aba = ref('definicao')
const conceitosDaAba = computed(() => (conteudo.value?.conceitos ?? []).filter((c) => c.tipo === aba.value))
const contar = (tipo) => (conteudo.value?.conceitos ?? []).filter((c) => c.tipo === tipo && c.status !== 'recusado').length
const editandoConceito = ref(null)
const rascunhoConceito = reactive({ termo: '', definicao: '' })
function editarConceito(c) {
  editandoConceito.value = c.id
  Object.assign(rascunhoConceito, { termo: c.termo, definicao: c.definicao ?? '' })
}
function salvarConceito(c) {
  if (!rascunhoConceito.termo.trim()) return
  executar(async () => {
    await gravar(supabase.from('conceitos').update({ termo: rascunhoConceito.termo.trim().slice(0, 200), definicao: rascunhoConceito.definicao.trim().slice(0, 2000) || null, status: 'aprovado' }).eq('id', c.id))
    editandoConceito.value = null
  })
}
const marcarConceito = (c, status) => executar(() => gravar(supabase.from('conceitos').update({ status }).eq('id', c.id)))

// ---------- Página ----------
const terminou = ref(false)
function aprovarPagina() {
  executar(async () => {
    await gravar(supabase.from('material_paginas').update({ conferida_em: new Date().toISOString() }).eq('versao_id', versao.value.id).eq('numero', pagina.value))
    await gravar(supabase.from('conceitos').update({ status: 'aprovado' }).eq('versao_id', versao.value.id).eq('pagina', pagina.value).eq('status', 'sugerido'))
    const { count } = await supabase.from('material_paginas').select('id', { count: 'exact', head: true }).eq('versao_id', versao.value.id).is('conferida_em', null)
    if (count === 0) {
      await gravar(supabase.from('material_versoes').update({ aprovada_em: new Date().toISOString() }).eq('id', versao.value.id))
      await gravar(supabase.from('materiais').update({ status: 'pronto' }).eq('id', id))
    }
    await refresh()
    api.recarregar()
    if (count === 0) terminou.value = true
    else pagina.value = paginas.value.find((p) => !p.conferida_em && p.numero > pagina.value)?.numero ?? primeiraPendente()
  })
}
function reabrirPagina() {
  executar(async () => {
    await gravar(supabase.from('material_paginas').update({ conferida_em: null }).eq('versao_id', versao.value.id).eq('numero', pagina.value))
    if (material.value.status === 'pronto') {
      await gravar(supabase.from('material_versoes').update({ aprovada_em: null }).eq('id', versao.value.id))
      await gravar(supabase.from('materiais').update({ status: 'aguardando_conferencia' }).eq('id', id))
    }
    terminou.value = false
    await refresh()
    api.recarregar()
  })
}
const ir = (n) => {
  if (n >= 1 && n <= paginas.value.length) pagina.value = n
}
</script>

<template>
  <div v-if="material && versao">
    <CabecalhoPagina titulo="Ajustar páginas" descricao="Corrija o que a leitura errou. As questões só saem do que você aprovar." :voltar="{ para: `/materiais/${id}`, texto: material.titulo }">
      <template #acoes>
        <span class="text-[14px] text-texto-2"><Fracao :valor="conferidas" :total="paginas.length" /> aprovadas</span>
        <button v-if="!atual?.conferida_em" type="button" class="botao" :aria-busy="ocupado" :disabled="ocupado" @click="aprovarPagina"><Check :size="17" :stroke-width="2.4" aria-hidden="true" />Aprovar esta {{ unidade.toLowerCase() }}</button>
        <button v-else type="button" class="botao-secundario" :disabled="ocupado" @click="reabrirPagina"><RotateCcw :size="16" :stroke-width="2" aria-hidden="true" />Conferir de novo</button>
      </template>
    </CabecalhoPagina>

    <!-- Faixa das páginas: clicar leva à página -->
    <nav class="mt-4 flex flex-wrap gap-[2px]" :aria-label="`${unidade}s do texto`">
      <button
        v-for="p in paginas"
        :key="p.numero"
        type="button"
        class="h-2.5 min-w-[6px] flex-1 cursor-pointer rounded-[2px] border-0 p-0"
        :class="[p.conferida_em ? 'bg-ok' : 'bg-borda', p.numero === pagina && 'outline outline-2 outline-offset-1 outline-tinta']"
        :aria-label="`${unidade} ${p.numero}, ${p.conferida_em ? 'aprovada' : 'para conferir'}`"
        :aria-current="p.numero === pagina ? 'page' : undefined"
        @click="ir(p.numero)"
      />
    </nav>

    <EntradaAvisoSucesso v-if="terminou" class="mt-5" mensagem="Tudo conferido. O texto está pronto para virar questões." />
    <EntradaAvisoErro class="mt-5" :mensagem="erro" />

    <div class="mt-6 grid items-start gap-5 lg:grid-cols-[1.6fr_1fr]">
      <!-- Trechos -->
      <section :aria-label="`${unidade} ${pagina}`">
        <div class="mb-3 flex flex-wrap items-center justify-between gap-3">
          <span class="text-[15px] font-semibold">
            {{ unidade }} <Fracao :valor="pagina" :total="paginas.length" sem-animacao />
            <span v-if="atual?.conferida_em" class="ml-1.5 inline-flex items-center gap-1 text-[13.5px] font-semibold text-ok"><Check :size="14" :stroke-width="2.6" aria-hidden="true" />aprovada</span>
          </span>
          <span class="flex gap-2">
            <button type="button" class="botao-secundario h-9 px-3 text-[14px]" :disabled="pagina <= 1" @click="ir(pagina - 1)"><ChevronLeft :size="15" :stroke-width="2" aria-hidden="true" />Anterior</button>
            <button type="button" class="botao-secundario h-9 px-3 text-[14px]" :disabled="pagina >= paginas.length" @click="ir(pagina + 1)">Próxima<ChevronRight :size="15" :stroke-width="2" aria-hidden="true" /></button>
          </span>
        </div>

        <div v-if="assuntos.length" class="mb-3 flex flex-wrap items-center gap-2 text-[14px]">
          <label for="assunto-pagina" class="text-texto-2">Assunto de todos os trechos desta {{ unidade.toLowerCase() }}:</label>
          <div class="w-[230px]"><Selecao id="assunto-pagina" v-model="assuntoDaPagina" :opcoes="opcoesAssunto" /></div>
          <button type="button" class="link text-[14px]" :disabled="ocupado" @click="aplicarAssunto">Aplicar</button>
        </div>

        <p v-if="!trechos.length" class="m-0 rounded-[14px] bg-folha-2 p-4 text-[14.5px] text-texto-2">Nenhum trecho nesta {{ unidade.toLowerCase() }}.</p>
        <ol class="m-0 flex list-none flex-col gap-3 p-0">
          <li v-for="(t, i) in trechos" :key="t.id" class="trecho group rounded-[16px] border" :class="[editando === t.id ? 'border-acento' : 'border-borda', t.usar_em_questoes ? 'bg-folha' : 'bg-folha-2']">
            <!-- Editando -->
            <form v-if="editando === t.id" class="flex flex-col gap-3 p-3.5" @submit.prevent="salvarEdicao(t, i)">
              <label class="so-leitor" :for="`editor-${t.id}`">Texto do trecho</label>
              <textarea :id="`editor-${t.id}`" v-model="rascunho.texto" class="campo min-h-[120px] resize-y py-2.5 leading-normal" />
              <p class="ajuda m-0">Para dividir em dois, deixe uma linha em branco no ponto da divisão.</p>
              <div class="flex flex-wrap items-center gap-3 text-[14px]">
                <div class="w-[170px]"><Selecao v-model="rascunho.tipo" :opcoes="opcoesTipo" rotulo="Tipo do trecho" /></div>
                <div v-if="assuntos.length" class="w-[200px]"><Selecao v-model="rascunho.assunto" :opcoes="opcoesAssunto" rotulo="Assunto do trecho" /></div>
                <span class="ml-auto flex gap-2">
                  <button type="button" class="volta" @click="editando = null">Cancelar</button>
                  <button type="submit" class="botao h-9 px-4 text-[14px]" :disabled="ocupado">Salvar</button>
                </span>
              </div>
            </form>

            <!-- Lendo -->
            <template v-else>
              <div class="barra-trecho flex flex-wrap gap-1 border-b border-borda px-2 py-1.5 text-[13px] font-semibold">
                <button type="button" class="acao-trecho" @click="editar(t)"><Pencil :size="14" :stroke-width="2" aria-hidden="true" />Editar ou dividir</button>
                <button v-if="trechos[i + 1]" type="button" class="acao-trecho" :disabled="ocupado" @click="juntar(t, i)"><Merge :size="14" :stroke-width="2" aria-hidden="true" />Juntar com o próximo</button>
                <button type="button" class="acao-trecho" :disabled="ocupado" @click="alternarUso(t)">{{ t.usar_em_questoes ? 'Não usar em questões' : 'Usar em questões' }}</button>
              </div>
              <div class="px-3.5 py-3">
                <h3 v-if="t.tipo === 'titulo'" class="m-0 font-titulo text-[21px] font-medium" :class="!t.usar_em_questoes && 'text-texto-2 line-through'">{{ t.texto }}</h3>
                <p v-else-if="t.tipo === 'formula'" class="m-0 font-mono text-[15px]" :class="!t.usar_em_questoes && 'text-texto-2 line-through'">{{ t.texto }}</p>
                <p v-else class="m-0 whitespace-pre-line text-[15.5px] leading-[1.6]" :class="!t.usar_em_questoes && 'text-texto-2 line-through'">{{ t.texto }}</p>
                <p class="m-0 mt-2 flex flex-wrap gap-1.5">
                  <span v-if="t.tipo !== 'texto'" class="rounded-full bg-folha-3 px-2.5 py-0.5 text-[12.5px] font-semibold">{{ TIPOS[t.tipo] }}</span>
                  <span v-if="nomeAssunto(t.assunto_id)" class="rounded-full border border-borda px-2.5 py-0.5 text-[12.5px] font-semibold text-texto-2">{{ nomeAssunto(t.assunto_id) }}</span>
                  <span v-if="!t.usar_em_questoes" class="text-[12.5px] font-semibold text-texto-2">Fora das questões</span>
                </p>
              </div>
            </template>
          </li>
        </ol>
      </section>

      <!-- Conceitos -->
      <aside class="rounded-[20px] border border-borda bg-folha-2 p-4" aria-label="Conceitos desta página">
        <div class="grid grid-cols-2 gap-1 rounded-[10px] bg-folha-3 p-1 text-[13.5px] font-semibold" role="tablist">
          <button type="button" role="tab" class="cursor-pointer rounded-[8px] border-0 py-1.5" :class="aba === 'definicao' ? 'bg-folha text-tinta' : 'bg-transparent text-texto-2'" :aria-selected="aba === 'definicao'" @click="aba = 'definicao'">Definições {{ contar('definicao') }}</button>
          <button type="button" role="tab" class="cursor-pointer rounded-[8px] border-0 py-1.5" :class="aba === 'formula' ? 'bg-folha text-tinta' : 'bg-transparent text-texto-2'" :aria-selected="aba === 'formula'" @click="aba = 'formula'">Fórmulas {{ contar('formula') }}</button>
        </div>
        <p v-if="!conceitosDaAba.length" class="m-0 mt-3 text-[14px] text-texto-2">Nada encontrado nesta {{ unidade.toLowerCase() }}.</p>
        <ul class="m-0 mt-2 list-none p-0">
          <li v-for="c in conceitosDaAba" :key="c.id" class="border-t border-borda py-3 first:border-0">
            <form v-if="editandoConceito === c.id" class="flex flex-col gap-2" @submit.prevent="salvarConceito(c)">
              <label class="rotulo m-0" :for="`termo-${c.id}`">{{ c.tipo === 'formula' ? 'Fórmula' : 'Termo' }}</label>
              <input :id="`termo-${c.id}`" v-model="rascunhoConceito.termo" class="campo h-10 text-[15px]" maxlength="200">
              <label class="rotulo m-0" :for="`def-${c.id}`">{{ c.tipo === 'formula' ? 'O que calcula' : 'Definição' }}</label>
              <textarea :id="`def-${c.id}`" v-model="rascunhoConceito.definicao" class="campo h-20 resize-y py-2 text-[15px]" maxlength="2000" />
              <div class="flex justify-end gap-2">
                <button type="button" class="volta" @click="editandoConceito = null">Cancelar</button>
                <button type="submit" class="botao h-9 px-3 text-[14px]">Salvar</button>
              </div>
            </form>
            <template v-else>
              <b class="block text-[15px]" :class="[c.tipo === 'formula' && 'font-mono', c.status === 'recusado' && 'text-texto-2 line-through']">{{ c.termo }}</b>
              <span v-if="c.definicao" class="text-[13.5px] text-texto-2">{{ c.definicao }}</span>
              <div class="mt-2 flex flex-wrap items-center gap-2">
                <span v-if="c.status === 'aprovado'" class="flex items-center gap-1 text-[13px] font-semibold text-ok"><Check :size="14" :stroke-width="2.6" aria-hidden="true" />Aprovado</span>
                <button v-else-if="c.status === 'sugerido'" type="button" class="botao-secundario h-8 px-3 text-[13px]" :disabled="ocupado" @click="marcarConceito(c, 'aprovado')"><Check :size="14" :stroke-width="2.4" aria-hidden="true" />Aprovar</button>
                <button v-if="c.status !== 'recusado'" type="button" class="botao-secundario h-8 px-3 text-[13px]" @click="editarConceito(c)">Editar</button>
                <button v-if="c.status !== 'recusado'" type="button" class="link text-[13px]" :disabled="ocupado" @click="marcarConceito(c, 'recusado')">Recusar</button>
                <button v-else type="button" class="link text-[13px]" :disabled="ocupado" @click="marcarConceito(c, 'sugerido')">Desfazer a recusa</button>
              </div>
            </template>
          </li>
        </ul>
        <p class="ajuda">Aprovar a {{ unidade.toLowerCase() }} aprova também o que você não recusou.</p>
      </aside>
    </div>
  </div>
</template>
