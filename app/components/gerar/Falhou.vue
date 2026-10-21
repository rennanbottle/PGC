<script setup>
// Nenhum serviço do PGC respondeu: o motivo, tentar de novo e o caminho da outra IA (o pedido completo já vem
// pronto; a resposta colada passa pela mesma conferência). Nada é descontado da cota do dia.
import { RefreshCw } from '@lucide/vue'
import { conferirRespostaColada } from '#shared/regras/ia.js'

const props = defineProps({
  falha: { type: Object, required: true },
  contexto: { type: Object, required: true },
  quantidade: { type: Number, default: 10 },
})
const emit = defineEmits(['tentar'])
const ia = useIa()
const resposta = ref('')
const copiado = ref(false)
const jaCopiou = ref(false)
const salvando = ref(false)
const erroServidor = ref(null)
const conferencia = computed(() => (resposta.value.trim() ? conferirRespostaColada(resposta.value, props.contexto, props.quantidade) : null))
watch(resposta, () => (erroServidor.value = null))

async function copiar() {
  try {
    await copiarTexto(props.falha.pedido)
    copiado.value = true
    jaCopiou.value = true
    setTimeout(() => (copiado.value = false), 2200)
  }
  catch {
    erroServidor.value = { motivo: 'Não deu para copiar. Clique no pedido, selecione tudo (Ctrl + A) e copie (Ctrl + C).' }
  }
}
async function salvar() {
  salvando.value = true
  try {
    const r = await ia.colar(props.falha.geracaoId, resposta.value)
    if (r.status === 'concluida') return navigateTo(`/questoes/geradas/${r.geracaoId}`)
    erroServidor.value = { motivo: r.motivo, problemas: r.problemas ?? [] }
  }
  catch (e) {
    erroServidor.value = { motivo: e.message }
  }
  finally {
    salvando.value = false
  }
}
</script>

<template>
  <section class="cartao mx-auto max-w-[760px]" role="alert" aria-labelledby="titulo-falhou">
    <div class="flex flex-col gap-4 sm:flex-row sm:items-start">
      <GuiaPersonagem humor="confuso" :tamanho="76" class="shrink-0" />
      <div class="min-w-0">
        <h2 id="titulo-falhou" class="titulo-secao">A IA do PGC não respondeu agora</h2>
        <p class="m-0 mt-1.5 text-[15px] text-texto-2">{{ falha.motivo }}</p>
        <p class="m-0 mt-2 text-[14px]">
          Nada foi descontado da sua cota.
          <template v-if="falha.salvasSemIa">As {{ falha.salvasSemIa }} questões tiradas do texto já estão no banco.</template>
        </p>
        <button type="button" class="botao mt-4" @click="emit('tentar')">
          <RefreshCw :size="17" :stroke-width="2.2" aria-hidden="true" />
          Tentar de novo
        </button>
      </div>
    </div>
    <hr class="divisoria my-7">
    <h2 class="titulo-secao">Ou use outra IA</h2>
    <p class="m-0 mb-5 mt-1 text-[14.5px] text-texto-2">O pedido já está pronto. A resposta passa pela mesma conferência e não gasta a cota.</p>
    <GerarPassosOutraIa
      v-model:resposta="resposta"
      :pedido="falha.pedido ?? ''"
      :conferencia="conferencia"
      :copiado="copiado"
      :ja-copiou="jaCopiou"
      :salvando="salvando"
      :erro-servidor="erroServidor"
      :aviso="falha.materialSoSemTreino ? 'O texto está marcado para ir só a serviços que não treinam com ele. Colar em outra IA é escolha sua.' : ''"
      @copiar="copiar"
      @salvar="salvar"
    />
  </section>
</template>
