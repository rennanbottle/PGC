<script setup>
// Conferir importação: cada questão reconhecida ao lado do trecho original do arquivo (lado a lado no computador,
// um embaixo do outro no celular). A pessoa confere o texto, marca a resposta certa (ou pede uma sugestão à IA, ou
// deixa para "resolver e comparar"), o assunto sugerido e a imagem. Aprova uma por uma ou todas as prontas de uma vez;
// só então elas entram no banco de questões.
import { Check, FileCheck, Pencil, Trash2, TriangleAlert, Undo2 } from '@lucide/vue'
import { LETRAS, conferirQuestao, nomeDoTipo } from '#shared/regras/questoes.js'
import { sugerirAssunto } from '#shared/regras/importarBanco.js'
import { assuntosAtivos } from '#shared/regras/materias.js'
import { mensagemErroBanco } from '#shared/regras/bancos.js'

const route = useRoute()
const supabase = useSupabaseClient()
const id = String(route.params.id)
const bancosApi = useBancos()
const questoesApi = useQuestoes()
const { avisar } = useAvisos()
const { data: materias } = useMaterias()

const { data: banco, refresh: recarregarBanco } = await useAsyncData(`banco-${id}`, async () => {
  const { data, error } = await supabase.from('bancos_importados').select('*').eq('id', id).maybeSingle()
  if (error) throw error
  return data
})
if (!banco.value) throw createError({ statusCode: 404, statusMessage: 'Importação não encontrada', fatal: true })
useHead({ title: 'Conferir importação | PGC' })

const { data: questoes, refresh: recarregarQuestoes } = await useAsyncData(`banco-questoes-${id}`, async () => {
  const linhas = []
  for (let de = 0; de < 4000; de += 1000) {
    const { data, error } = await supabase.from('questoes').select(COLUNAS_QUESTAO).eq('banco_id', id).eq('status', 'rascunho').order('numero_original').range(de, de + 999)
    if (error) throw error
    linhas.push(...data)
    if (data.length < 1000) break
  }
  return linhas
}, { default: () => [] })

const materia = computed(() => (materias.value ?? []).find((m) => m.id === banco.value?.materia_id))
const assuntos = computed(() => assuntosAtivos(materia.value))
const opcoesAssunto = computed(() => [{ valor: '', texto: 'Sem assunto' }, ...assuntos.value.map((a) => ({ valor: a.id, texto: a.nome }))])

// Termos aprovados dos textos, por assunto: explicam a sugestão ("sugerido por abandonada e queda").
const { data: termos } = useAsyncData(`banco-termos-${id}`, async () => {
  const ids = assuntos.value.map((a) => a.id)
  if (!ids.length) return []
  const { data } = await supabase.from('conceitos').select('termo, assunto_id').in('assunto_id', ids).eq('status', 'aprovado').limit(2000)
  return data ?? []
}, { default: () => [], watch: [() => assuntos.value.length] })
const comPalavras = computed(() => assuntos.value.map((a) => ({ ...a, palavras: termos.value.filter((t) => t.assunto_id === a.id).map((t) => t.termo) })))
function sugestao(q) {
  const s = sugerirAssunto(`${q.enunciado} ${(q.conteudo.alternativas ?? []).map((a) => a.texto).join(' ')}`, comPalavras.value)
  return s && s.id === q.assunto_id ? s : null
}

// Enquanto o servidor lê o arquivo, a tela se atualiza sozinha.
let relogio = null
watch(() => banco.value?.status, (s) => {
  clearInterval(relogio)
  if (import.meta.client && (s === 'enviando' || s === 'lendo')) {
    relogio = setInterval(async () => {
      await recarregarBanco()
      if (banco.value?.status !== 'lendo') recarregarQuestoes()
    }, 3000)
  }
}, { immediate: true })
onBeforeUnmount(() => clearInterval(relogio))

// ---------- Estado de cada questão ----------
const pronta = (q) => (q.gabarito_confirmado || q.resolver_comparar) && !q.precisa_imagem && q.qualidade_aprovada
function estadoDe(q) {
  if (!q.qualidade_aprovada) return { id: 'ajuste', texto: 'Precisa de ajuste', tipo: 'erro', falta: 'Ajuste o texto antes de aprovar.' }
  if (q.precisa_imagem) return { id: 'imagem', texto: 'Precisa da imagem', tipo: 'erro', falta: 'Anexe a imagem antes de aprovar.' }
  if (!q.gabarito_confirmado && !q.resolver_comparar) return { id: 'gabarito', texto: q.conteudo?.sugestaoIa ? 'Sugestão da IA para confirmar' : 'Sem resposta no arquivo', tipo: 'aviso', falta: 'Marque a resposta certa para aprovar.' }
  return { id: 'pronta', texto: 'Pronta', tipo: 'ok', falta: '' }
}
const contagem = computed(() => {
  const c = { pronta: 0, gabarito: 0, imagem: 0, ajuste: 0 }
  for (const q of questoes.value) c[estadoDe(q).id]++
  return c
})
const partes = computed(() => [
  { id: 'pronta', nome: 'prontas', n: contagem.value.pronta, cor: 'var(--ok)' },
  { id: 'gabarito', nome: 'sem resposta', n: contagem.value.gabarito, cor: 'var(--aviso)' },
  { id: 'outras', nome: 'precisam de imagem ou ajuste', n: contagem.value.imagem + contagem.value.ajuste, cor: 'var(--erro)' },
].filter((p) => p.n))
const aba = ref('')
const opcoesAba = computed(() => [
  { valor: '', texto: `Todas (${questoes.value.length})` },
  { valor: 'pronta', texto: `Prontas (${contagem.value.pronta})` },
  { valor: 'gabarito', texto: `Sem resposta (${contagem.value.gabarito})` },
  { valor: 'imagem', texto: `Precisam da imagem (${contagem.value.imagem})` },
  { valor: 'ajuste', texto: `Precisam de ajuste (${contagem.value.ajuste})` },
].filter((a) => !a.valor || contagem.value[a.valor]))
const visiveis = computed(() => questoes.value.filter((q) => !aba.value || estadoDe(q).id === aba.value))
// Páginas de 20 cartões. Conferir uma questão tira ela da aba; se a última página esvaziar, volta uma.
const POR_PAGINA = 20
const pagina = ref(1)
watch(aba, () => (pagina.value = 1))
const nasPagina = computed(() => visiveis.value.slice((pagina.value - 1) * POR_PAGINA, pagina.value * POR_PAGINA))
watch(() => visiveis.value.length, (n) => {
  const ultima = Math.max(1, Math.ceil(n / POR_PAGINA))
  if (pagina.value > ultima) pagina.value = ultima
})
watch(pagina, () => document.getElementById('lista-conferir')?.scrollIntoView({ block: 'start', behavior: 'smooth' }))
const assuntosSugeridos = computed(() => {
  const conta = new Map()
  for (const q of questoes.value) if (q.assunto_id) conta.set(q.assunto_id, (conta.get(q.assunto_id) ?? 0) + 1)
  return [...conta].sort((a, b) => b[1] - a[1]).slice(0, 2).map(([aid, n]) => `${assuntos.value.find((a) => a.id === aid)?.nome ?? 'Outro'} (${n})`).join(', ')
})

// ---------- Ações ----------
const ocupado = ref('')
async function tentar(chave, fn) {
  ocupado.value = chave
  try {
    await fn()
  }
  catch (e) {
    avisar({ texto: e.message, tipo: 'erro' })
  }
  ocupado.value = ''
}
async function gravar(q, campos) {
  await questoesApi.atualizar(q.id, campos)
  Object.assign(q, campos)
}
function marcarLetra(q, i) {
  return tentar(q.id, async () => {
    const conteudo = { ...q.conteudo, alternativas: q.conteudo.alternativas.map((a, k) => ({ ...a, correta: k === i })) }
    const r = conferirQuestao({ tipo: q.tipo, enunciado: q.enunciado, conteudo }, { importada: true })
    await gravar(q, { conteudo, gabarito_confirmado: true, resolver_comparar: false, qualidade_aprovada: r.aprovada, avisos_qualidade: r.problemas })
  })
}
const ia = useIa()
async function pedirSugestao(q) {
  await tentar(`ia-${q.id}`, async () => {
    const r = await ia.sugerirGabarito(q.id)
    if (r.status === 'falhou') throw new Error(`Não deu para pedir a sugestão. ${r.motivo}`)
    if (r.conteudo) Object.assign(q, { conteudo: r.conteudo, gabarito_confirmado: false, resolver_comparar: false })
  })
}
const comparar = (q, sim) => tentar(q.id, () => gravar(q, { resolver_comparar: sim }))
const mudarAssunto = (q, aid) => tentar(q.id, () => gravar(q, { assunto_id: aid || null }))
const semImagem = (q) => tentar(q.id, () => gravar(q, { precisa_imagem: false }))
const seletor = ref(null)
const alvoImagem = ref(null)
function pedirImagem(q) {
  alvoImagem.value = q
  seletor.value?.click()
}
async function escolherImagem(evento) {
  const arquivo = evento.target.files?.[0]
  evento.target.value = ''
  const q = alvoImagem.value
  if (!arquivo || !q) return
  await tentar(q.id, async () => {
    const caminhoImagem = await questoesApi.enviarImagem(q.id, await reduzirFigura(arquivo))
    Object.assign(q, { imagem_caminho: caminhoImagem, precisa_imagem: false })
  })
}
async function aprovar(lista) {
  const ids = lista.filter(pronta).map((q) => q.id)
  await tentar('aprovar', async () => {
    await bancosApi.aprovar(id, ids)
    avisar({ texto: `${ids.length === 1 ? 'Uma questão entrou' : `${ids.length} questões entraram`} no banco.`, tipo: 'ok' })
    await Promise.all([recarregarQuestoes(), recarregarBanco()])
  })
}
async function descartar(q) {
  await tentar(`descartar-${q.id}`, async () => {
    await bancosApi.descartar(id, [q.id])
    avisar({ texto: `Questão ${q.numero_original} descartada.`, tipo: 'ok' })
    await Promise.all([recarregarQuestoes(), recarregarBanco()])
  })
}
const tentarDeNovo = () => tentar('ler', async () => {
  await bancosApi.ler(id)
  await Promise.all([recarregarBanco(), recarregarQuestoes()])
})
const janelaExcluir = ref(null)
async function excluirImportacao() {
  await tentar('excluir', async () => {
    await bancosApi.excluir(banco.value)
    avisar({ texto: 'Importação excluída.', tipo: 'ok' })
    await navigateTo('/questoes')
  })
}
const enviadoEm = computed(() => new Intl.DateTimeFormat('pt-BR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' }).format(new Date(banco.value.criado_em)))
</script>

<template>
  <div>
    <CabecalhoPagina titulo="Conferir importação" :voltar="{ para: '/questoes', texto: 'Questões' }">
      <template #descricao>
        <span class="inline-flex flex-wrap items-center gap-x-2 gap-y-1">
          <span>{{ banco.arquivo_nome || banco.titulo }}<template v-if="banco.paginas">, {{ banco.paginas }} {{ banco.paginas === 1 ? 'página' : 'páginas' }}</template>, enviado em {{ enviadoEm }}.</span>
          <span v-if="materia" class="inline-flex items-center gap-1.5 font-semibold text-tinta">
            <span class="size-2 rounded-full" :style="{ background: `${corMateria(materia.cor ?? 'cinza')}` }" aria-hidden="true" />{{ materia.nome }}
          </span>
        </span>
      </template>
      <template #acoes>
        <button type="button" class="botao-fantasma text-erro" aria-haspopup="dialog" @click="janelaExcluir?.abrir()">
          <Trash2 :size="17" :stroke-width="2" aria-hidden="true" />Excluir importação
        </button>
      </template>
    </CabecalhoPagina>

    <!-- Lendo, erro ou concluída -->
    <div v-if="banco.status === 'lendo' || banco.status === 'enviando'" class="cartao entra flex max-w-[640px] items-center gap-4" role="status">
      <GuiaPersonagem humor="pensando" :tamanho="64" />
      <p class="m-0 text-[15px] leading-[1.55]"><b>Procurando as questões e a resposta de cada uma.</b><br><span class="text-texto-2">Leva alguns segundos. A tela se atualiza sozinha.</span></p>
    </div>
    <div v-else-if="banco.status === 'erro'" class="entra max-w-[720px]" role="alert">
      <Vazio titulo="Não deu para ler o arquivo" :texto="mensagemErroBanco(banco.erro_codigo)" humor="surpreso">
        <template #acoes>
          <button type="button" class="botao" :aria-busy="ocupado === 'ler'" :disabled="!!ocupado" @click="tentarDeNovo">Tentar de novo</button>
          <NuxtLink to="/questoes?importar=1" class="botao-secundario no-underline">Importar outro arquivo</NuxtLink>
        </template>
      </Vazio>
    </div>
    <div v-else-if="!questoes.length" class="entra max-w-[720px]">
      <Vazio titulo="Importação conferida" texto="As questões que você aprovou já estão no banco e entram nos seus estudos." humor="comemorando">
        <template #acoes>
          <NuxtLink to="/questoes" class="botao no-underline">Ver o banco de questões</NuxtLink>
        </template>
      </Vazio>
    </div>

    <template v-else>
      <!-- Resumo: prontas (principal) e o que o PGC achou -->
      <div class="grid gap-4 lg:grid-cols-[1.55fr_1fr]">
        <section class="cartao entra min-w-0" style="--i: 1" aria-labelledby="titulo-prontas">
          <h2 id="titulo-prontas" class="titulo-cartao flex items-center gap-2">
            <FileCheck :size="19" :stroke-width="2" aria-hidden="true" />Prontas para entrar no banco
          </h2>
          <p class="prontas numero-grande m-0 mt-3"><Fracao :valor="contagem.pronta" :total="questoes.length" /></p>
          <div class="mt-4 flex h-2.5 gap-[3px]" role="img" :aria-label="partes.map((p) => `${p.n} ${p.nome}`).join(', ')">
            <span v-for="p in partes" :key="p.id" class="parte rounded-full" :style="{ flex: p.n, background: p.cor }" />
          </div>
          <ul class="m-0 mt-2.5 flex list-none flex-wrap gap-x-5 gap-y-1 p-0 text-[13px] text-texto-2" aria-hidden="true">
            <li v-for="p in partes" :key="p.id" class="flex items-center gap-1.5"><span class="size-2 rounded-full" :style="{ background: p.cor }" /><b class="tabular-nums text-tinta">{{ p.n }}</b> {{ p.nome }}</li>
          </ul>
          <div class="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-borda pt-4">
            <button type="button" class="botao" :aria-busy="ocupado === 'aprovar'" :disabled="!contagem.pronta || !!ocupado" @click="aprovar(questoes)">
              <span v-if="ocupado === 'aprovar'" class="rodando" aria-hidden="true" />
              <Check v-else :size="18" :stroke-width="2.2" aria-hidden="true" />{{ contagem.pronta === 1 ? 'Aprovar a pronta' : `Aprovar as ${contagem.pronta} prontas` }}
            </button>
            <span v-if="questoes.length > contagem.pronta" class="text-[13.5px] text-texto-2">As outras ficam aqui para você resolver depois.</span>
          </div>
        </section>
        <section class="cartao entra min-w-0" style="--i: 2" aria-labelledby="titulo-achou">
          <h2 id="titulo-achou" class="titulo-cartao">O que o PGC achou no arquivo</h2>
          <dl class="m-0 mt-2 text-[14px]">
            <div class="flex justify-between gap-3 border-b border-borda py-2.5"><dt>Questões numeradas</dt><dd class="m-0 font-semibold tabular-nums">{{ banco.total_reconhecido }}</dd></div>
            <div class="flex justify-between gap-3 border-b border-borda py-2.5"><dt>Com resposta no arquivo<template v-if="banco.gabarito_pagina"> (página {{ banco.gabarito_pagina }})</template></dt><dd class="m-0 font-semibold tabular-nums">{{ banco.total_com_gabarito }}</dd></div>
            <div class="flex justify-between gap-3 border-b border-borda py-2.5"><dt>Citam uma figura</dt><dd class="m-0 font-semibold tabular-nums">{{ banco.total_com_figura }}</dd></div>
            <div class="flex justify-between gap-3 py-2.5"><dt>Assuntos sugeridos</dt><dd class="m-0 text-right font-semibold">{{ assuntosSugeridos || 'nenhum' }}</dd></div>
          </dl>
        </section>
      </div>

      <div id="lista-conferir" class="entra mt-8 flex scroll-mt-24 flex-wrap items-center justify-between gap-3" style="--i: 3">
        <h2 class="titulo-secao">Uma por uma</h2>
        <Selecao v-model="aba" variante="filtro" prefixo="Mostrar" :opcoes="opcoesAba" :busca="false" />
      </div>

      <!-- Questões -->
      <TransitionGroup name="lista" tag="div" class="mt-3 flex flex-col gap-4">
        <article v-for="q in nasPagina" :key="q.id" class="cartao min-w-0" :aria-labelledby="`q-${q.id}`">
          <div class="mb-4 flex flex-wrap items-center gap-x-3 gap-y-2">
            <h3 :id="`q-${q.id}`" class="titulo-cartao">Questão {{ q.numero_original }}</h3>
            <span class="selo" :data-tipo="estadoDe(q).tipo">{{ estadoDe(q).texto }}</span>
            <span class="ml-auto inline-flex items-center gap-1.5 text-[13px] text-texto-2"><QuestoesIconeTipo :tipo="q.tipo" :tamanho="15" />{{ nomeDoTipo(q.tipo) }}<template v-if="q.fonte">, {{ q.fonte }}</template></span>
          </div>

          <div class="grid gap-4 lg:grid-cols-2">
            <div class="painel min-w-0">
              <p class="m-0 mb-2 text-[12.5px] font-semibold text-texto-2">No arquivo</p>
              <p class="m-0 whitespace-pre-line text-[14.5px] leading-[1.6]">{{ q.trecho_original }}</p>
            </div>
            <div class="min-w-0">
              <p class="m-0 text-[12.5px] font-semibold text-texto-2">Como o PGC entendeu</p>
              <QuestoesPrevia class="mt-1" :questao="q" mostrar-gabarito sem-nivel />
            </div>
          </div>

          <div class="mt-5 grid gap-5 border-t border-borda pt-4 lg:grid-cols-2">
            <!-- Resposta certa -->
            <div v-if="q.conteudo.alternativas?.length" class="min-w-0">
              <template v-if="q.resolver_comparar">
                <p class="rotulo">Resposta</p>
                <p class="m-0 text-[14px] text-texto-2">Vai entrar como "resolver e comparar": sem correção automática, você compara com a sua resolução. Não conta pontos.</p>
                <button type="button" class="botao-fantasma botao-p -ml-2.5 mt-1" :disabled="!!ocupado" @click="comparar(q, false)">
                  <Undo2 :size="16" :stroke-width="2" aria-hidden="true" />Marcar a resposta
                </button>
              </template>
              <template v-else>
                <p :id="`resp-${q.id}`" class="rotulo">{{ q.gabarito_confirmado ? 'Resposta certa (do arquivo ou sua)' : 'Qual é a resposta certa?' }}</p>
                <div class="flex flex-wrap gap-2" role="group" :aria-labelledby="`resp-${q.id}`">
                  <button
                    v-for="(a, i) in q.conteudo.alternativas"
                    :key="i"
                    type="button"
                    class="letra-resposta"
                    :aria-pressed="!!(a.correta && q.gabarito_confirmado)"
                    :aria-label="`A alternativa ${LETRAS[i]} é a certa`"
                    :disabled="ocupado === q.id"
                    @click="marcarLetra(q, i)"
                  >
                    {{ LETRAS[i] }}
                  </button>
                </div>
                <div v-if="!q.gabarito_confirmado" class="mt-3">
                  <div v-if="q.conteudo.sugestaoIa" class="painel text-[14px]">
                    <p class="m-0"><b>A IA sugere a {{ q.conteudo.sugestaoIa.letra }}.</b> <span class="text-texto-2">{{ q.conteudo.sugestaoIa.porque }}</span></p>
                    <button type="button" class="botao-secundario botao-p mt-2.5" :disabled="!!ocupado" @click="marcarLetra(q, LETRAS.indexOf(q.conteudo.sugestaoIa.letra))">
                      <Check :size="16" :stroke-width="2.2" aria-hidden="true" />Confirmar a {{ q.conteudo.sugestaoIa.letra }}
                    </button>
                  </div>
                  <div v-else class="flex flex-wrap items-center gap-x-3 gap-y-2">
                    <span class="text-[13.5px] text-texto-2">Não sabe?</span>
                    <BotaoIa tamanho="p" :carregando="ocupado === `ia-${q.id}`" :desativado="!!ocupado" @click="pedirSugestao(q)">Pedir uma sugestão</BotaoIa>
                    <button type="button" class="botao-fantasma botao-p" :disabled="!!ocupado" @click="comparar(q, true)">Resolver e comparar</button>
                  </div>
                </div>
              </template>
            </div>
            <div v-else class="min-w-0 text-[14px] text-texto-2">
              <p class="rotulo">Resposta</p>
              Questão aberta: entra como "resolver e comparar". Para escrever a resposta esperada, use Corrigir o texto.
            </div>

            <!-- Assunto e imagem -->
            <div class="min-w-0">
              <label class="rotulo" :for="`assunto-${q.id}`">Assunto</label>
              <div class="max-w-[360px]">
                <Selecao :id="`assunto-${q.id}`" :model-value="q.assunto_id ?? ''" :opcoes="opcoesAssunto" :desativado="ocupado === q.id" @update:model-value="mudarAssunto(q, $event)" />
              </div>
              <p class="ajuda">
                <template v-if="sugestao(q)">Sugerido pelas palavras {{ sugestao(q).motivo.map((m) => `"${m}"`).join(' e ') }}. </template>O nível começa em Normal e se ajusta com as respostas.
              </p>
              <template v-if="q.precisa_imagem">
                <p class="erro-campo m-0 mt-3">A questão cita uma figura que não veio no arquivo.</p>
                <div class="mt-2 flex flex-wrap items-center gap-2">
                  <button type="button" class="botao-secundario botao-p" :disabled="ocupado === q.id" @click="pedirImagem(q)">Anexar a imagem</button>
                  <button type="button" class="botao-fantasma botao-p" :disabled="ocupado === q.id" @click="semImagem(q)">Não precisa</button>
                </div>
              </template>
            </div>
          </div>

          <p v-if="!q.qualidade_aprovada" class="painel m-0 mt-4 flex items-start gap-2.5 text-[14px]">
            <TriangleAlert :size="18" :stroke-width="2" class="mt-0.5 shrink-0 text-erro" aria-hidden="true" />
            <span><b>O que ajustar:</b> {{ (q.avisos_qualidade ?? []).filter((p) => p.nivel === 'falha').map((p) => p.texto).join(' ') }}</span>
          </p>

          <div class="mt-4 flex flex-wrap items-center justify-end gap-x-2 gap-y-2 border-t border-borda pt-4">
            <span v-if="!pronta(q)" class="mr-auto text-[13.5px] text-texto-2">{{ estadoDe(q).falta }}</span>
            <NuxtLink :to="`/questoes/${q.id}?voltar=importar`" class="botao-fantasma botao-p no-underline"><Pencil :size="16" :stroke-width="2" aria-hidden="true" />Corrigir o texto</NuxtLink>
            <button type="button" class="botao-fantasma botao-p" :disabled="!!ocupado" @click="descartar(q)"><Trash2 :size="16" :stroke-width="2" aria-hidden="true" />Descartar</button>
            <button type="button" class="botao botao-p" :disabled="!pronta(q) || !!ocupado" @click="aprovar([q])"><Check :size="16" :stroke-width="2.2" aria-hidden="true" />Aprovar a questão {{ q.numero_original }}</button>
          </div>
        </article>
      </TransitionGroup>
      <Paginacao v-if="visiveis.length > POR_PAGINA" v-model="pagina" class="mt-4" :total="visiveis.length" :por-pagina="POR_PAGINA" rotulo="Páginas das questões para conferir" />
    </template>

    <input ref="seletor" type="file" accept="image/jpeg,image/png,image/webp" hidden @change="escolherImagem">

    <JanelaBase ref="janelaExcluir" titulo="Excluir esta importação?" :descricao="`As ${questoes.length} questões ainda não aprovadas e o arquivo enviado saem. As que você já aprovou continuam no banco.`">
      <template #rodape>
        <button type="button" class="botao-fantasma" @click="janelaExcluir?.fechar()">Cancelar</button>
        <button type="button" class="botao botao-perigo" :aria-busy="ocupado === 'excluir'" :disabled="!!ocupado" @click="excluirImportacao"><Trash2 :size="17" :stroke-width="2" aria-hidden="true" />Excluir</button>
      </template>
    </JanelaBase>
  </div>
</template>

<style scoped>
.prontas :deep(.fracao-total) {
  margin-left: 2px;
  font-size: 0.55em;
  font-weight: 600;
}
.parte {
  transform-origin: left;
  animation: cresce 0.7s cubic-bezier(0.2, 0.8, 0.2, 1) both 0.15s;
}
@keyframes cresce {
  from { transform: scaleX(0); }
}
.letra-resposta {
  display: grid;
  place-items: center;
  width: 44px;
  height: 44px;
  border: 1.5px solid var(--borda-campo);
  border-radius: 999px;
  background: var(--campo);
  color: var(--tinta);
  font: inherit;
  font-size: 15px;
  font-weight: 700;
  cursor: pointer;
  transition: background-color 0.15s, border-color 0.15s, color 0.15s, transform 0.15s;
}
.letra-resposta:hover:not(:disabled) {
  border-color: var(--ok);
}
.letra-resposta[aria-pressed='true'] {
  border-color: transparent;
  background: var(--ok-suave);
  color: var(--ok);
  transform: scale(1.06);
}
.letra-resposta:focus-visible {
  outline: 2px solid var(--acento);
  outline-offset: 2px;
}
@media (prefers-reduced-motion: reduce) {
  .parte { animation: none; }
  .letra-resposta[aria-pressed='true'] { transform: none; }
}
:global(:root.menos-movimento) .parte {
  animation: none;
}
</style>
