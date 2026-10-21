<script setup>
// "Pedir o texto a uma IA": o PGC monta o pedido (organizado em partes), a pessoa cola na IA que já usa e traz a
// resposta para o campo da Biblioteca. A resposta pode vir solta: ao salvar, o PGC arruma fórmulas e marcação.
// Uso: <MateriaisPedirTexto :tema="tema" :materia="materia" :assunto="nomeDoAssunto" @copiou="..." />
import { Check, Copy, ExternalLink } from '@lucide/vue'
import { montarPedidoTexto } from '#shared/regras/pedidoTexto.js'

const props = defineProps({
  tema: { type: String, required: true },
  materia: { type: Object, default: null },
  assunto: { type: String, default: '' },
})
const emit = defineEmits(['copiou'])
const { avisar } = useAvisos()

const IAS = [
  { nome: 'ChatGPT', url: 'https://chatgpt.com/' },
  { nome: 'Gemini', url: 'https://gemini.google.com/app' },
  { nome: 'Claude', url: 'https://claude.ai/new' },
  { nome: 'Grok', url: 'https://grok.com/' },
]
const pedido = computed(() => montarPedidoTexto({ tema: props.tema, materia: props.materia?.nome ?? '', area: props.materia?.area ?? '', assunto: props.assunto }))
const copiado = ref(false)
const verPedido = ref(false)
watch(pedido, () => (copiado.value = false))

async function copiar() {
  try {
    await copiarTexto(pedido.value)
    copiado.value = true
    emit('copiou')
  }
  catch {
    verPedido.value = true
    avisar({ texto: 'Não deu para copiar sozinho. Selecione o pedido abaixo e copie.', tipo: 'erro' })
  }
}
</script>

<template>
  <section class="mt-6 border-t border-borda pt-5" aria-labelledby="titulo-pedir-texto">
    <h3 id="titulo-pedir-texto" class="titulo-cartao">Ou peça o texto a uma IA</h3>
    <p class="m-0 mt-1 max-w-[620px] text-[14px] leading-[1.5] text-texto-2">
      O PGC monta o pedido para um texto completo, com técnicas, variações e exemplos resolvidos. Cole na IA que você usa,
      copie a resposta inteira e cole no campo acima. Fórmulas e títulos são arrumados ao salvar.
    </p>
    <div class="mt-3.5 flex flex-wrap items-center gap-2">
      <button type="button" class="botao-secundario botao-p" @click="copiar">
        <Check v-if="copiado" :size="16" :stroke-width="2.4" class="text-ok" aria-hidden="true" />
        <Copy v-else :size="16" :stroke-width="2.1" aria-hidden="true" />
        {{ copiado ? 'Pedido copiado' : 'Copiar pedido' }}
      </button>
      <a v-for="ia in IAS" :key="ia.nome" :href="ia.url" target="_blank" rel="noopener noreferrer" class="botao-fantasma botao-p no-underline">
        {{ ia.nome }}<ExternalLink :size="14" :stroke-width="2.1" aria-hidden="true" /><span class="so-leitor"> (abre em outra aba)</span>
      </a>
      <button type="button" class="link-discreto ml-1 text-[13.5px]" :aria-expanded="verPedido" aria-controls="pedido-texto" @click="verPedido = !verPedido">
        {{ verPedido ? 'Esconder o pedido' : 'Ver o pedido' }}
      </button>
    </div>
    <Transition name="abre">
      <pre v-if="verPedido" id="pedido-texto" class="m-0 mt-3 max-h-[260px] max-w-[760px] overflow-auto whitespace-pre-wrap rounded-[12px] border border-borda bg-folha-2 px-3.5 py-3 font-mono text-[12.5px] leading-[1.55] text-texto-2">{{ pedido }}</pre>
    </Transition>
  </section>
</template>
