<script setup>
// "Quem escreve": três jeitos numa lista compacta. Cada um diz se usa IA e o que gasta.
// O antigo "Misto" virou uma escolha dentro da IA do PGC ("Usar primeiro o que sai do texto"): é a mesma IA,
// só que ela escreve apenas o que o texto não deu.
import { FileText, MessagesSquare, Sparkles } from '@lucide/vue'

const props = defineProps({
  estado: { type: Object, required: true },
  temTexto: { type: Boolean, default: false },
  cota: { type: Object, default: () => ({ usadas: 0, limite: 30 }) },
})
const id = useId()
const semCota = computed(() => (props.cota?.usadas ?? 0) >= (props.cota?.limite ?? 30))

const opcoes = computed(() => [
  {
    id: 'local',
    nome: 'Do texto, sem IA',
    icone: FileText,
    ia: false,
    desativado: !props.temTexto,
    descricao: props.temTexto
      ? 'Lacunas, cartões e contas tiradas do próprio texto. Sai na hora e não gasta nada.'
      : 'Marque um texto acima para usar este jeito.',
  },
  {
    id: 'ia',
    nome: 'IA do PGC',
    icone: Sparkles,
    ia: true,
    desativado: semCota.value,
    descricao: semCota.value
      ? `As ${props.cota?.limite ?? 30} gerações de hoje acabaram. Amanhã a cota volta.`
      : 'A IA escreve, e o PGC confere cada questão antes de salvar.',
  },
  {
    id: 'externa',
    nome: 'Outra IA que você usa',
    icone: MessagesSquare,
    ia: true,
    desativado: false,
    descricao: 'O PGC monta o pedido completo. Você cola no ChatGPT, Gemini ou Claude e traz a resposta.',
  },
])
</script>

<template>
  <div role="radiogroup" :aria-labelledby="`${id}-r`" class="flex max-w-[680px] flex-col gap-1">
    <span :id="`${id}-r`" class="sr-only">Quem escreve as questões</span>
    <template v-for="m in opcoes" :key="m.id">
      <label class="linha-opcao">
        <input v-model="estado.modo" type="radio" class="escolher mt-[3px]" :name="`${id}-modo`" :value="m.id" :disabled="m.desativado">
        <component :is="m.icone" :size="19" :stroke-width="2" class="mt-[2px] shrink-0 text-texto-2" aria-hidden="true" />
        <span class="min-w-0 flex-1">
          <span class="flex flex-wrap items-center gap-x-2 gap-y-1 text-[15px] font-semibold">
            {{ m.nome }}
            <span class="marca-ia" :data-ia="m.ia ? 'true' : undefined">{{ m.ia ? 'usa IA' : 'sem IA' }}</span>
          </span>
          <span class="mt-0.5 block text-[13.5px] leading-[1.45] text-texto-2">{{ m.descricao }}</span>
        </span>
        <span class="hidden shrink-0 pt-0.5 text-right text-[13px] text-texto-2 sm:block">
          <template v-if="m.id === 'ia'"><Fracao :valor="cota?.usadas ?? 0" :total="cota?.limite ?? 30" sem-animacao /> hoje</template>
          <template v-else-if="m.id === 'local'">grátis</template>
          <template v-else>não gasta a cota</template>
        </span>
      </label>
      <Transition name="abre">
        <div v-if="m.id === 'ia' && estado.modo === 'ia' && temTexto" class="pl-9">
          <label class="linha-opcao">
            <input v-model="estado.aproveitarTexto" type="checkbox" class="marcar mt-[2px]">
            <span class="min-w-0">
              <span class="block text-[14.5px] font-semibold">Usar primeiro o que sai do texto</span>
              <span class="mt-0.5 block text-[13px] leading-[1.45] text-texto-2">Cartões, lacunas e contas que o texto já dá entram sem IA. A IA escreve só o que faltar e, se o texto der conta de tudo, a cota nem é usada.</span>
            </span>
          </label>
        </div>
      </Transition>
    </template>
  </div>
</template>
