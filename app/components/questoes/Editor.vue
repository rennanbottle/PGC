<script setup>
// Escrever ou editar uma questão, do jeito mais simples: onde ela fica (matéria e assunto), o tipo, a pergunta e a
// resposta. O resto (nível, tipo de raciocínio, explicação, fonte, imagem e o erro de cada alternativa errada) fica em
// "Mais detalhes", fechado. A conferência de qualidade é uma linha que abre; a prévia ao lado mostra a questão como
// ela aparece no Estudar e pode ser escondida. Serve para criar ("nova", aceita ?materia= e ?assunto=), copiar
// (?copiar=id) e editar. Questão importada só tem a estrutura conferida. Questão sem gabarito confirmado: ao salvar,
// a resposta marcada vira o gabarito confirmado.
import { Check, ChevronDown, CircleAlert, Eye, EyeOff, ImagePlus, Info, Sparkles, TriangleAlert } from '@lucide/vue'
import { BLOOM, NIVEIS, TIPO, TIPOS, TIPOS_ESCOLHA, ajustarLacunas, conferirQuestao, conteudoVazio, contarLacunas, prepararParaGravar, trocarTipo } from '#shared/regras/questoes.js'
import { assuntosAtivos } from '#shared/regras/materias.js'

const props = defineProps({
  questaoId: { type: String, default: '' },
  copiarDe: { type: String, default: '' },
})
const route = useRoute()
const supabase = useSupabaseClient()
const api = useQuestoes()
const { avisar } = useAvisos()
const { data: materias, pending: carregandoMaterias } = useMaterias()
const id = useId()

const { data: original } = await useQuestao(props.questaoId || props.copiarDe)
if (props.questaoId && !original.value) throw createError({ statusCode: 404, statusMessage: 'Questão não encontrada', fatal: true })
const editando = !!props.questaoId
const importada = editando && original.value?.origem === 'importada'
// Questão escrita pela pessoa: o erro de cada alternativa errada é opcional (vira aviso, não falha).
const propria = !importada && (!editando || original.value?.origem === 'minha')
const opcoesConferir = { importada, propria }
useHead({ title: editando ? 'Editar questão | PGC' : 'Nova questão | PGC' })

function formInicial() {
  const q = original.value
  if (q) {
    return {
      tipo: q.tipo,
      materia_id: q.materia_id,
      assunto_id: q.assunto_id ?? '',
      nivel: q.nivel,
      bloom: q.bloom,
      enunciado: q.enunciado,
      conteudo: { ...conteudoVazio(q.tipo), ...structuredClone(q.conteudo ?? {}) },
      explicacao: q.explicacao ?? '',
      fonte: q.fonte ?? '',
      resolver_comparar: !!q.resolver_comparar,
      precisa_imagem: editando ? !!q.precisa_imagem : false,
    }
  }
  return {
    tipo: 'multipla_escolha',
    materia_id: '',
    assunto_id: typeof route.query.assunto === 'string' ? route.query.assunto : '',
    nivel: 2,
    bloom: 2,
    enunciado: '',
    conteudo: conteudoVazio('multipla_escolha'),
    explicacao: '',
    fonte: '',
    resolver_comparar: false,
    precisa_imagem: false,
  }
}
const form = reactive(formInicial())

// ---------- Onde ela fica ----------
const ativas = computed(() => (materias.value ?? []).filter((m) => !m.arquivada_em || m.id === original.value?.materia_id))
watch(ativas, (lista) => {
  if (form.materia_id || !lista.length) return
  const pedida = typeof route.query.materia === 'string' && lista.find((m) => m.id === route.query.materia)
  form.materia_id = pedida ? pedida.id : lista[0].id
}, { immediate: true })
watch(() => form.materia_id, (novo, antigo) => {
  if (antigo && novo !== antigo) form.assunto_id = ''
})
const materiaAtual = computed(() => (materias.value ?? []).find((m) => m.id === form.materia_id))
const opcoesMateria = computed(() => ativas.value.map((m) => ({ valor: m.id, texto: m.nome, cor: `${corMateria(m.cor ?? 'cinza')}` })))
const opcoesAssunto = computed(() => [{ valor: '', texto: 'Sem assunto' }, ...assuntosAtivos(materiaAtual.value).map((a) => ({ valor: a.id, texto: a.nome }))])
const contexto = computed(() => {
  const a = assuntosAtivos(materiaAtual.value).find((x) => x.id === form.assunto_id)
  return [materiaAtual.value?.nome, a?.nome].filter(Boolean).join(', ')
})
const linguagem = computed(() => (materiaAtual.value?.area === 'programacao' ? String(materiaAtual.value.nome).toLowerCase() : ''))
const linkIa = computed(() => ({ path: '/questoes/gerar', query: { ...(form.materia_id ? { materia: form.materia_id } : {}), ...(form.assunto_id ? { assunto: form.assunto_id } : {}) } }))

// ---------- Tipo ----------
const GRUPOS_TIPO = [['Escolher a resposta', ['escolher', 'marcar']], ['Escrever a resposta', ['escrever', 'cartao']], ['Ligar e ordenar', ['arrastar']]]
const opcoesTipo = GRUPOS_TIPO.flatMap(([grupo, comps]) => TIPOS.filter((t) => comps.includes(t.componente)).map((t) => ({ valor: t.id, texto: t.nome, descricao: t.resumo, icone: ICONES_TIPO[t.id], grupo })))
const opcoesNivel = NIVEIS.map((n) => ({ valor: n.valor, texto: n.nome }))
const opcoesBloom = BLOOM.map((b) => ({ valor: b.valor, texto: b.nome }))
watch(() => form.tipo, (para, de) => {
  form.conteudo = trocarTipo(form.conteudo, de, para)
  if (para.startsWith('lacuna')) form.conteudo = ajustarLacunas(form.enunciado, form.conteudo, para)
})
watch(() => form.enunciado, (t) => {
  if (form.tipo.startsWith('lacuna') && contarLacunas(t) !== (form.conteudo.lacunas ?? []).length) form.conteudo = ajustarLacunas(t, form.conteudo, form.tipo)
})

// ---------- Conferência, detalhes e prévia ----------
const resultado = computed(() => conferirQuestao(form, opcoesConferir))
const comecou = computed(() => form.enunciado.trim().length > 0)
const linhaQualidade = computed(() => {
  const r = resultado.value
  if (!comecou.value) return { tom: 'neutro', texto: 'A conferência aparece quando você escrever a pergunta.' }
  if (r.aprovada && !r.avisos) return { tom: 'ok', texto: 'Tudo certo: ela entra nos seus estudos.' }
  if (r.aprovada) return { tom: 'aviso', texto: `Entra nos seus estudos, com ${r.avisos === 1 ? 'um aviso' : `${r.avisos} avisos`}.` }
  const n = r.falhas + r.avisos
  return { tom: 'erro', texto: `Falta ajustar ${n === 1 ? 'uma coisa' : `${n} coisas`}. Sem isso, ela fica guardada fora dos estudos.` }
})
const verConferencia = ref(false)
const semGabarito = computed(() => editando && original.value && !original.value.gabarito_confirmado)
const detalhes = ref(!!(editando && original.value?.precisa_imagem))
const verPrevia = ref(true)

// ---------- Imagem ----------
const imagem = ref('')
const imagemNova = ref(null)
const tirarPedido = ref(false)
const seletor = ref(null)
onMounted(async () => {
  if (editando && original.value?.imagem_caminho) imagem.value = await api.imagemParaMostrar(original.value.imagem_caminho)
})
async function escolherImagem(evento) {
  const arquivo = evento.target.files?.[0]
  evento.target.value = ''
  if (!arquivo) return
  try {
    imagemNova.value = await reduzirFigura(arquivo)
    imagem.value = await blobParaDataUrl(imagemNova.value)
    tirarPedido.value = false
    form.precisa_imagem = false
  }
  catch (e) {
    erro.value = e.message
  }
}
function tirarImagem() {
  imagem.value = ''
  imagemNova.value = null
  tirarPedido.value = true
}

// ---------- Trecho do texto que mudou ----------
const trechoAtual = ref(null)
onMounted(async () => {
  if (editando && original.value?.material_mudou && original.value.trecho_id) {
    const { data } = await supabase.from('material_trechos').select('texto, pagina').eq('id', original.value.trecho_id).maybeSingle()
    trechoAtual.value = data
  }
})
async function continuaCerta() {
  try {
    await api.atualizar(props.questaoId, { material_mudou: false })
    original.value.material_mudou = false
    avisar({ texto: 'Questão conferida.', tipo: 'ok' })
  }
  catch (e) {
    avisar({ texto: e.message, tipo: 'erro' })
  }
}

// ---------- Salvar ----------
const erro = ref('')
const erroPergunta = ref(false)
const salvando = ref(false)
const voltarPara = computed(() => (route.query.voltar === 'importar' && original.value?.banco_id ? `/questoes/importar/${original.value.banco_id}` : '/questoes'))

async function salvar(criarOutra = false) {
  erro.value = ''
  erroPergunta.value = false
  if (!form.materia_id) {
    erro.value = 'Escolha a matéria da questão.'
    return
  }
  if (!form.enunciado.trim()) {
    erro.value = 'Escreva a pergunta.'
    erroPergunta.value = true
    nextTick(() => document.getElementById(`${id}-enunciado`)?.focus())
    return
  }
  const { campos, resultado: r } = prepararParaGravar(form, opcoesConferir)
  const dados = {
    ...campos,
    materia_id: form.materia_id,
    assunto_id: form.assunto_id || null,
    fonte: form.fonte.trim().slice(0, 200) || null,
    resolver_comparar: importada ? form.resolver_comparar : false,
    precisa_imagem: form.precisa_imagem,
    material_mudou: false,
  }
  // Quem conferiu e salvou a questão sem gabarito confirmado confirmou o gabarito.
  if (semGabarito.value && !form.resolver_comparar) dados.gabarito_confirmado = true
  salvando.value = true
  try {
    let qid = props.questaoId
    if (editando) await api.atualizar(qid, dados)
    else qid = await api.criar({ ...dados, origem: 'minha' })
    if (imagemNova.value) await api.enviarImagem(qid, imagemNova.value)
    else if (tirarPedido.value && editando && original.value?.imagem_caminho) await api.tirarImagem(qid, original.value.imagem_caminho)
    avisar(r.aprovada ? { texto: 'Questão salva.', tipo: 'ok' } : { texto: 'Questão salva, mas fora dos estudos. Ajuste o que falta quando puder.', tipo: 'info' })
    if (criarOutra) {
      const manter = { tipo: form.tipo, materia_id: form.materia_id, assunto_id: form.assunto_id, nivel: form.nivel, bloom: form.bloom }
      Object.assign(form, { ...manter, enunciado: '', conteudo: conteudoVazio(form.tipo), explicacao: '', fonte: '', precisa_imagem: false })
      imagem.value = ''
      imagemNova.value = null
      verConferencia.value = false
      nextTick(() => document.getElementById(`${id}-enunciado`)?.focus())
    }
    else {
      await navigateTo(voltarPara.value)
    }
  }
  catch (e) {
    erro.value = e.message
  }
  salvando.value = false
}
</script>

<template>
  <div>
    <CabecalhoPagina
      :titulo="editando ? 'Editar questão' : 'Nova questão'"
      :descricao="editando ? 'Mude o que precisar e salve.' : 'Escolha onde ela fica, escreva a pergunta e marque a resposta.'"
      :voltar="{ para: voltarPara, texto: voltarPara === '/questoes' ? 'Questões' : 'Conferir importação' }"
    >
      <template v-if="!editando" #acoes>
        <NuxtLink :to="linkIa" class="botao-fantasma no-underline">
          <Sparkles :size="18" :stroke-width="2" aria-hidden="true" />Pedir para a IA escrever
        </NuxtLink>
      </template>
    </CabecalhoPagina>

    <div v-if="!carregandoMaterias && !ativas.length" class="entra max-w-[680px]" style="--i: 1">
      <Vazio titulo="Primeiro, uma matéria" texto="Toda questão fica numa matéria. Crie a primeira e volte aqui." humor="pensando">
        <template #acoes>
          <NuxtLink to="/materias?nova=1" class="botao no-underline">Criar matéria</NuxtLink>
        </template>
      </Vazio>
    </div>

    <template v-else>
      <!-- Avisos que tiram a questão dos estudos -->
      <div v-if="(editando && original?.material_mudou) || (semGabarito && !form.resolver_comparar)" class="mb-5 flex max-w-[860px] flex-col gap-3">
        <section v-if="editando && original?.material_mudou" class="painel entra" aria-labelledby="titulo-mudou">
          <h2 id="titulo-mudou" class="m-0 flex items-center gap-2 text-[15px] font-semibold">
            <TriangleAlert :size="18" :stroke-width="2" class="shrink-0 text-aviso" aria-hidden="true" />O texto de onde ela saiu mudou
          </h2>
          <p class="m-0 mt-1 text-[14px] text-texto-2">Confira se a questão ainda está certa. Até lá, ela fica fora dos estudos.</p>
          <blockquote v-if="trechoAtual" class="m-0 mt-3 border-l-2 border-borda-forte pl-3 text-[15px] leading-[1.55]">
            {{ trechoAtual.texto }} <span class="text-[12.5px] text-texto-2">(página {{ trechoAtual.pagina }})</span>
          </blockquote>
          <p v-else class="m-0 mt-2 text-[14px] text-texto-2">O trecho foi juntado a outro ou apagado.</p>
          <button type="button" class="botao-secundario botao-p mt-3" @click="continuaCerta">
            <Check :size="16" :stroke-width="2.2" aria-hidden="true" />Ela continua certa
          </button>
        </section>
        <p v-if="semGabarito && !form.resolver_comparar" class="painel entra m-0 flex items-start gap-2.5 text-[14.5px]">
          <Info :size="18" :stroke-width="2" class="mt-0.5 shrink-0 text-acento" aria-hidden="true" />
          <span><b>{{ importada ? 'O arquivo não trouxe a resposta desta questão.' : 'A resposta desta questão ainda não foi confirmada.' }}</b> Marque a certa e salve para confirmar.</span>
        </p>
      </div>

      <div class="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <form :id="`${id}-form`" class="cartao entra flex min-w-0 flex-col gap-6" style="--i: 1" novalidate aria-label="Questão" @submit.prevent="salvar()">
          <!-- Onde ela fica e o tipo -->
          <div class="grid max-w-[620px] gap-4 sm:grid-cols-2">
            <div>
              <label class="rotulo" :for="`${id}-materia`">Matéria</label>
              <Selecao :id="`${id}-materia`" v-model="form.materia_id" :opcoes="opcoesMateria" texto-vazio="Escolha a matéria" />
            </div>
            <div>
              <label class="rotulo" :for="`${id}-assunto`">Assunto</label>
              <Selecao :id="`${id}-assunto`" v-model="form.assunto_id" :opcoes="opcoesAssunto" :desativado="!form.materia_id" />
            </div>
            <div class="sm:col-span-2 sm:max-w-[300px]">
              <label class="rotulo" :for="`${id}-tipo`">Tipo</label>
              <Selecao :id="`${id}-tipo`" v-model="form.tipo" :opcoes="opcoesTipo" :largura-lista="380" />
              <p class="ajuda">{{ TIPO[form.tipo]?.resumo }}</p>
            </div>
          </div>

          <!-- Pergunta -->
          <div v-if="form.tipo === 'texto_base'">
            <label class="rotulo" :for="`${id}-base`">Texto para ler</label>
            <textarea :id="`${id}-base`" v-model="form.conteudo.textoBase" class="campo min-h-[130px] resize-y py-3 leading-[1.55]" maxlength="6000" />
          </div>
          <div>
            <label class="rotulo" :for="`${id}-enunciado`">{{ form.tipo === 'cartao' ? 'Frente do cartão' : 'Pergunta' }}</label>
            <textarea
              :id="`${id}-enunciado`"
              v-model="form.enunciado"
              class="campo min-h-[112px] resize-y py-3 text-[16px] leading-[1.55]"
              :class="erroPergunta && 'treme'"
              maxlength="5000"
              :aria-invalid="erroPergunta"
              :aria-describedby="`${id}-enunciado-ajuda`"
            />
            <p :id="`${id}-enunciado-ajuda`" class="ajuda">{{ form.tipo.startsWith('lacuna') ? 'Escreva três sublinhados (___) onde fica cada lacuna.' : 'Para mostrar código, escreva ``` na linha de cima e na de baixo dele.' }}</p>
          </div>

          <!-- Resposta -->
          <QuestoesAlternativasNaQuestao
            v-if="TIPOS_ESCOLHA.includes(form.tipo)"
            :key="`a-${form.tipo}`"
            v-model="form.conteudo.alternativas"
            :pedir-erro="!importada && !propria"
            :mostrar-erros="detalhes"
            :minimo="importada ? 2 : 4"
            :maximo="5"
          />
          <QuestoesAlternativasNaQuestao v-else-if="form.tipo === 'multipla_resposta'" :key="`a-${form.tipo}`" v-model="form.conteudo.alternativas" multipla :pedir-erro="!importada && !propria" :mostrar-erros="detalhes" :minimo="4" :maximo="6" />
          <QuestoesCamposDoTipo v-else :key="form.tipo" v-model="form.conteudo" :tipo="form.tipo" :importada="importada" />

          <!-- Mais detalhes -->
          <div class="border-t border-borda pt-3">
            <div class="flex flex-wrap items-center gap-x-1">
              <button type="button" class="botao-fantasma botao-p -ml-2.5" :aria-expanded="detalhes" :aria-controls="`${id}-detalhes`" @click="detalhes = !detalhes">
                <ChevronDown :size="16" :stroke-width="2" class="transition-transform" :class="detalhes && 'rotate-180'" aria-hidden="true" />Mais detalhes
              </button>
              <span v-if="!detalhes" class="text-[13px] text-texto-3">nível, explicação, fonte e imagem</span>
            </div>
            <Transition name="abre">
              <div v-if="detalhes" :id="`${id}-detalhes`">
                <div class="flex flex-col gap-5 pt-3">
                  <div class="grid max-w-[620px] gap-4 sm:grid-cols-2">
                    <div>
                      <label class="rotulo" :for="`${id}-nivel`">Nível</label>
                      <Selecao :id="`${id}-nivel`" v-model="form.nivel" :opcoes="opcoesNivel" :busca="false" />
                      <p class="ajuda">É só o começo: ele se ajusta com as respostas.</p>
                    </div>
                    <div>
                      <label class="rotulo" :for="`${id}-bloom`">Tipo de raciocínio</label>
                      <Selecao :id="`${id}-bloom`" v-model="form.bloom" :opcoes="opcoesBloom" :busca="false" />
                      <p class="ajuda">O que a questão pede: lembrar, entender, aplicar...</p>
                    </div>
                  </div>
                  <div>
                    <label class="rotulo" :for="`${id}-explicacao`">Explicação</label>
                    <textarea :id="`${id}-explicacao`" v-model="form.explicacao" class="campo min-h-[84px] resize-y py-3 leading-[1.5]" maxlength="3000" :aria-describedby="`${id}-explicacao-ajuda`" />
                    <p :id="`${id}-explicacao-ajuda`" class="ajuda">Aparece depois da resposta, para quem errou entender.</p>
                  </div>
                  <div class="max-w-[420px]">
                    <label class="rotulo" :for="`${id}-fonte`">Fonte</label>
                    <input :id="`${id}-fonte`" v-model="form.fonte" class="campo" type="text" maxlength="200" autocomplete="off" :aria-describedby="`${id}-fonte-ajuda`">
                    <p :id="`${id}-fonte-ajuda`" class="ajuda">Prova, ano ou livro de onde ela veio.</p>
                  </div>
                  <div>
                    <p class="rotulo">Imagem</p>
                    <p v-if="form.precisa_imagem && !imagem" class="erro-campo m-0 mb-2">A pergunta cita uma figura que não veio no arquivo. Sem ela, a questão fica fora dos estudos.</p>
                    <div v-if="imagem" class="flex flex-wrap items-end gap-3">
                      <img :src="imagem" alt="Imagem da questão" class="max-h-[200px] max-w-full rounded-[12px] border border-borda">
                      <span class="flex gap-1">
                        <button type="button" class="botao-fantasma botao-p" @click="seletor?.click()">Trocar</button>
                        <button type="button" class="botao-fantasma botao-p" @click="tirarImagem">Tirar</button>
                      </span>
                    </div>
                    <div v-else class="flex flex-wrap items-center gap-2">
                      <button type="button" class="botao-secundario botao-p" @click="seletor?.click()">
                        <ImagePlus :size="16" :stroke-width="2" aria-hidden="true" />Anexar imagem
                      </button>
                      <button v-if="form.precisa_imagem" type="button" class="botao-fantasma botao-p" @click="form.precisa_imagem = false">Não precisa de imagem</button>
                    </div>
                    <input ref="seletor" type="file" accept="image/jpeg,image/png,image/webp" hidden @change="escolherImagem">
                  </div>
                  <label v-if="importada" class="linha-opcao -mx-3 max-w-[560px]">
                    <input v-model="form.resolver_comparar" type="checkbox" class="marcar">
                    <span class="text-[14px]"><b class="block">Resolver e comparar</b><span class="text-[13px] text-texto-2">Sem correção automática: você compara com a sua resolução. Não conta pontos.</span></span>
                  </label>
                </div>
              </div>
            </Transition>
          </div>

          <!-- Conferência em uma linha -->
          <div>
            <button
              type="button"
              class="linha-qualidade"
              :data-tom="linhaQualidade.tom"
              :aria-expanded="comecou ? verConferencia : undefined"
              :aria-controls="`${id}-conferencia`"
              :disabled="!comecou"
              @click="verConferencia = !verConferencia"
            >
              <Check v-if="linhaQualidade.tom === 'ok'" :size="18" :stroke-width="2.4" class="shrink-0 text-ok" aria-hidden="true" />
              <TriangleAlert v-else-if="linhaQualidade.tom === 'erro'" :size="18" :stroke-width="2" class="shrink-0 text-erro" aria-hidden="true" />
              <CircleAlert v-else :size="18" :stroke-width="2" class="shrink-0" :class="linhaQualidade.tom === 'aviso' ? 'text-aviso' : 'text-texto-3'" aria-hidden="true" />
              <span class="min-w-0 flex-1 text-left" aria-live="polite">{{ linhaQualidade.texto }}</span>
              <span v-if="comecou" class="shrink-0 text-[13.5px] font-semibold text-acento">{{ verConferencia ? 'Fechar' : 'Ver detalhes' }}</span>
            </button>
            <Transition name="abre">
              <div v-if="verConferencia && comecou" :id="`${id}-conferencia`">
                <div class="px-1 pt-1">
                  <QuestoesConferencia compacto :resultado="resultado" :tipo="form.tipo" :importada="importada" />
                </div>
              </div>
            </Transition>
          </div>

          <p v-if="erro" class="erro-campo m-0" role="alert">{{ erro }}</p>
        </form>

        <!-- Prévia -->
        <aside class="entra min-w-0 lg:sticky lg:top-5" style="--i: 2" aria-labelledby="titulo-previa">
          <div class="flex items-center justify-between gap-3">
            <h2 id="titulo-previa" class="titulo-cartao text-[16px]">Como aparece no Estudar</h2>
            <button type="button" class="botao-fantasma botao-p" :aria-expanded="verPrevia" :aria-controls="`${id}-previa`" @click="verPrevia = !verPrevia">
              <EyeOff v-if="verPrevia" :size="16" :stroke-width="2" aria-hidden="true" />
              <Eye v-else :size="16" :stroke-width="2" aria-hidden="true" />{{ verPrevia ? 'Esconder' : 'Mostrar' }}
            </button>
          </div>
          <Transition name="abre">
            <div v-if="verPrevia" :id="`${id}-previa`">
              <div class="previa-pequena pt-3">
                <QuestoesPrevia :questao="form" :contexto="contexto" :imagem="imagem" mostrar-gabarito :linguagem="linguagem" />
              </div>
            </div>
          </Transition>
        </aside>
      </div>

      <!-- Salvar -->
      <div class="barra-salvar lg:mr-[384px]">
        <NuxtLink :to="voltarPara" class="botao-fantasma no-underline">Cancelar</NuxtLink>
        <button v-if="!editando" type="button" class="botao-secundario max-sm:hidden" :disabled="salvando" @click="salvar(true)">Salvar e escrever outra</button>
        <button type="submit" :form="`${id}-form`" class="botao" :aria-busy="salvando" :disabled="salvando">
          <span v-if="salvando" class="rodando" aria-hidden="true" />
          <Check v-else :size="18" :stroke-width="2.2" aria-hidden="true" />Salvar questão
        </button>
      </div>
    </template>
  </div>
</template>

<style scoped>
.linha-qualidade {
  display: flex;
  width: 100%;
  min-height: 46px;
  align-items: center;
  gap: 10px;
  padding: 9px 14px;
  border: 0;
  border-radius: 14px;
  background: var(--folha-2);
  color: var(--tinta);
  font: inherit;
  font-size: 14px;
  cursor: pointer;
  transition: background-color 0.15s;
}
.linha-qualidade:hover:not(:disabled) {
  background: var(--folha-3);
}
.linha-qualidade:disabled {
  color: var(--texto-2);
  cursor: default;
}
.linha-qualidade:focus-visible {
  outline: 2px solid var(--acento);
  outline-offset: 2px;
}
.linha-qualidade[data-tom='ok'] {
  background: var(--ok-suave);
}
.previa-pequena {
  zoom: 0.92;
}
.barra-salvar {
  position: sticky;
  bottom: 16px;
  z-index: 4;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 20px;
  padding: 10px 12px;
  border: 1px solid var(--borda);
  border-radius: 18px;
  background: color-mix(in oklab, var(--folha) 90%, transparent);
  backdrop-filter: blur(10px);
}
@media (max-width: 1023px) {
  .barra-salvar {
    bottom: calc(74px + env(safe-area-inset-bottom));
    padding-right: 72px;
  }
}
</style>
