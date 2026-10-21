<script setup>
// Ações de um texto (menu de três pontinhos da lista e da página do texto) e as janelas delas:
// gerar questões, renomear, mover de matéria, uso de IA, baixar o original, arquivar e excluir.
// Uso: <MateriaisAcoesTexto ref="acoes" />, depois :itens="acoes?.itens(t)" e @escolher="acoes.executar(t, $event)".
import { Archive, ArchiveRestore, CircleAlert, Download, FolderInput, Pencil, ShieldCheck, Sparkles } from '@lucide/vue'
import { IA_PERMITIDA } from '#shared/regras/perfil.js'
import { LIMITE_TITULO, origemDoTexto, validarTitulo } from '#shared/regras/materiais.js'

const emit = defineEmits(['excluido'])
const api = useMateriais()
const { data: materias } = useMaterias()
const { avisar } = useAvisos()

const alvo = ref(null)
const ocupado = ref(false)
const erro = ref('')
const janelaNome = ref(null)
const janelaMover = ref(null)
const janelaIa = ref(null)
const janelaExcluir = ref(null)
const nome = ref('')
const destino = ref('')
const ia = ref('sem_treino')

const opcoesMateria = computed(() => (materias.value ?? []).filter((m) => !m.arquivada_em).map((m) => ({ valor: m.id, texto: m.nome, cor: `${corMateria(m.cor)}` })))
const opcoesIa = IA_PERMITIDA.map((o) => ({ valor: o.valor, texto: o.texto, descricao: o.descricao }))

function itens(t) {
  if (t.arquivado_em) {
    return [
      { id: 'restaurar', texto: 'Restaurar', icone: ArchiveRestore },
      { id: 'excluir', texto: 'Excluir', perigo: true, separar: true },
    ]
  }
  const aberto = origemDoTexto(t) !== 'arquivo' && origemDoTexto(t) !== 'colado'
  return [
    { id: 'gerar', texto: 'Gerar questões deste texto', icone: Sparkles, desativado: t.status !== 'pronto' },
    { id: 'renomear', texto: 'Renomear', icone: Pencil, separar: true },
    { id: 'mover', texto: 'Mover para outra matéria', icone: FolderInput, desativado: opcoesMateria.value.length < 2 },
    ...(aberto ? [] : [{ id: 'ia', texto: 'Uso de IA', icone: ShieldCheck }]),
    ...(t.arquivo_caminho ? [{ id: 'baixar', texto: 'Baixar o original', icone: Download }] : []),
    { id: 'arquivar', texto: 'Arquivar', icone: Archive },
    { id: 'excluir', texto: 'Excluir', perigo: true, separar: true },
  ]
}

async function tentar(acao, texto) {
  ocupado.value = true
  erro.value = ''
  try {
    await acao()
    if (texto) avisar({ texto, tipo: 'ok' })
    return true
  }
  catch (e) {
    erro.value = e.message
    return false
  }
  finally {
    ocupado.value = false
  }
}

async function executar(t, id) {
  alvo.value = t
  erro.value = ''
  if (id === 'gerar') return navigateTo(`/questoes/gerar?texto=${t.id}&materia=${t.materia_id}`)
  if (id === 'renomear') {
    nome.value = t.titulo
    return janelaNome.value?.abrir()
  }
  if (id === 'mover') {
    destino.value = t.materia_id
    return janelaMover.value?.abrir()
  }
  if (id === 'ia') {
    ia.value = t.ia_permitida ?? 'sem_treino'
    return janelaIa.value?.abrir()
  }
  if (id === 'baixar') {
    try {
      window.open(await api.linkDoOriginal(t), '_blank', 'noopener')
    }
    catch (e) {
      avisar({ texto: e.message, tipo: 'erro' })
    }
    return
  }
  if (id === 'arquivar') {
    try {
      await api.arquivar(t.id, true)
      avisar({ texto: 'Texto arquivado.', acao: { texto: 'Desfazer', fazer: () => api.arquivar(t.id, false) } })
    }
    catch (e) {
      avisar({ texto: e.message, tipo: 'erro' })
    }
    return
  }
  if (id === 'restaurar') {
    try {
      await api.arquivar(t.id, false)
      avisar({ texto: 'Texto restaurado.', tipo: 'ok' })
    }
    catch (e) {
      avisar({ texto: e.message, tipo: 'erro' })
    }
    return
  }
  if (id === 'excluir') janelaExcluir.value?.abrir()
}

async function salvarNome() {
  erro.value = validarTitulo(nome.value)
  if (erro.value) return
  if (await tentar(() => api.atualizar(alvo.value.id, { titulo: nome.value.trim() }), 'Texto renomeado.')) janelaNome.value?.fechar()
}
async function mover() {
  const nomeDestino = opcoesMateria.value.find((m) => m.valor === destino.value)?.texto
  if (await tentar(() => api.atualizar(alvo.value.id, { materia_id: destino.value }), `Texto movido para ${nomeDestino}.`)) janelaMover.value?.fechar()
}
async function salvarIa() {
  if (await tentar(() => api.atualizar(alvo.value.id, { ia_permitida: ia.value }), 'Uso de IA salvo.')) janelaIa.value?.fechar()
}
async function excluir() {
  const id = alvo.value.id
  if (await tentar(() => api.excluir(alvo.value), 'Texto excluído.')) {
    janelaExcluir.value?.fechar()
    emit('excluido', id)
  }
}

defineExpose({ itens, executar })
</script>

<template>
  <div>
    <JanelaBase ref="janelaNome" titulo="Renomear texto">
      <form id="form-nome-texto" novalidate @submit.prevent="salvarNome">
        <label class="rotulo" for="novo-nome-texto">Nome do texto</label>
        <input id="novo-nome-texto" v-model="nome" class="campo" type="text" :maxlength="LIMITE_TITULO" :aria-invalid="!!erro || undefined" @input="erro = ''">
      </form>
      <p v-if="erro" class="erro-campo m-0" role="alert"><CircleAlert :size="16" :stroke-width="2" aria-hidden="true" class="mt-px shrink-0" />{{ erro }}</p>
      <template #rodape>
        <button type="button" class="botao-fantasma botao-p h-10" @click="janelaNome?.fechar()">Cancelar</button>
        <button type="submit" form="form-nome-texto" class="botao h-10" :disabled="ocupado">Salvar nome</button>
      </template>
    </JanelaBase>

    <JanelaBase ref="janelaMover" :titulo="`Mover ${alvo?.titulo ?? 'texto'}`" descricao="As questões que já saíram dele ficam na matéria em que estão.">
      <div class="max-w-[360px]">
        <label class="rotulo" for="destino-texto">Para a matéria</label>
        <Selecao id="destino-texto" v-model="destino" :opcoes="opcoesMateria" />
      </div>
      <p v-if="erro" class="erro-campo m-0" role="alert">{{ erro }}</p>
      <template #rodape>
        <button type="button" class="botao-fantasma botao-p h-10" @click="janelaMover?.fechar()">Cancelar</button>
        <button type="button" class="botao h-10" :disabled="ocupado || destino === alvo?.materia_id" @click="mover">Mover texto</button>
      </template>
    </JanelaBase>

    <JanelaBase ref="janelaIa" titulo="Uso de IA" descricao="Quais serviços de IA podem ler este texto para criar questões.">
      <div class="max-w-[460px]">
        <label class="rotulo" for="ia-do-texto">Serviços que podem ler</label>
        <Selecao id="ia-do-texto" v-model="ia" :opcoes="opcoesIa" />
      </div>
      <p v-if="erro" class="erro-campo m-0" role="alert">{{ erro }}</p>
      <template #rodape>
        <button type="button" class="botao-fantasma botao-p h-10" @click="janelaIa?.fechar()">Cancelar</button>
        <button type="button" class="botao h-10" :disabled="ocupado" @click="salvarIa">Salvar</button>
      </template>
    </JanelaBase>

    <JanelaBase ref="janelaExcluir" :titulo="`Excluir ${alvo?.titulo ?? 'texto'}?`">
      <p class="m-0 text-[15.5px] leading-[1.55]">O texto e o arquivo saem da Biblioteca. As questões que já saíram dele continuam no banco. Não dá para desfazer.</p>
      <p class="m-0 text-[14.5px] text-texto-2">Para só tirar da lista, use Arquivar.</p>
      <p v-if="erro" class="erro-campo m-0" role="alert">{{ erro }}</p>
      <template #rodape>
        <button type="button" class="botao-fantasma botao-p h-10" @click="janelaExcluir?.fechar()">Cancelar</button>
        <button type="button" class="botao botao-perigo h-10" :aria-busy="ocupado" :disabled="ocupado" @click="excluir">Excluir texto</button>
      </template>
    </JanelaBase>
  </div>
</template>
