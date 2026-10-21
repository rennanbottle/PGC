<script setup>
// Correção de uma questão: o que você marcou e o que era, o erro de raciocínio por trás da alternativa escolhida,
// a explicação e o trecho do material, e os pontos. "Questão com problema" tira a questão dos estudos (vai para as
// arquivadas do banco, dá para desfazer): é o jeito de descartar uma questão gerada que saiu errada.
import { CircleAlert, CircleCheck, CircleX, Flag, Undo2 } from '@lucide/vue'
import { LETRAS } from '#shared/regras/questoes.js'

const props = defineProps({
  item: { type: Object, required: true },
  resposta: { type: Object, default: () => ({}) },
})
const c = computed(() => props.item.correcao)
const q = computed(() => props.item.questao)
const d = computed(() => c.value?.detalhe ?? {})
const escolha = computed(() => ['multipla_escolha', 'texto_base', 'prever_resultado'].includes(q.value.tipo))
const titulo = computed(() => {
  if (escolha.value) {
    const certa = `${LETRAS[d.value.certa]}, ${q.value.alternativas[d.value.certa]}`
    if (c.value.resultado === 'correta') return `Resposta: ${certa}.`
    return d.value.escolhida === null || d.value.escolhida === undefined ? `Em branco. A certa é ${certa}.` : `Você marcou ${LETRAS[d.value.escolhida]}. A certa é ${certa}.`
  }
  return ''
})
// Cada resultado tem cor, ícone e palavra: nunca só a cor.
const TONS = {
  correta: { caixa: 'bg-ok-suave', texto: 'text-ok', icone: CircleCheck, palavra: 'Certa' },
  parcial: { caixa: 'bg-aviso-suave', texto: 'text-aviso', icone: CircleAlert, palavra: 'Parcialmente certa' },
  incorreta: { caixa: 'bg-erro-suave', texto: 'text-erro', icone: CircleX, palavra: 'Errada' },
}
const tom = computed(() => TONS[c.value.resultado] ?? TONS.incorreta)

// Questão com problema: pergunta antes, arquiva e deixa desfazer.
const { arquivar } = useQuestoes()
const problema = ref('') // '' | 'perguntando' | 'salvando' | 'tirada'
const erroProblema = ref('')
async function tirarDosEstudos(sim = true) {
  erroProblema.value = ''
  problema.value = 'salvando'
  try {
    await arquivar([props.item.questaoId], sim)
    problema.value = sim ? 'tirada' : ''
  }
  catch {
    problema.value = sim ? 'perguntando' : 'tirada'
    erroProblema.value = 'Não deu para salvar agora. Tente de novo.'
  }
}
const textoPontos = computed(() => {
  if (c.value.resultado === 'incorreta') return 'Ler a correção vale 1 ponto, se esta questão não foi respondida nas últimas 20 horas.'
  if (['resposta_curta', 'explicar'].includes(q.value.tipo)) return 'Correção feita por você: não conta pontos.'
  return c.value.pontos ? `+${c.value.pontos} ${c.value.pontos === 1 ? 'ponto' : 'pontos'}.` : 'Sem pontos: respondida há menos de 20 horas ou cedo demais.'
})
</script>

<template>
  <section class="rounded-[16px] px-5 py-4 sm:px-6" :class="tom.caixa" aria-live="polite" aria-label="Correção">
    <div class="flex flex-wrap items-center justify-between gap-2">
      <p class="m-0 flex items-center gap-2 font-titulo text-[19px] font-bold" :class="tom.texto">
        <component :is="tom.icone" :size="22" :stroke-width="2.3" class="pop" aria-hidden="true" />{{ tom.palavra }}
      </p>
      <span v-if="c.pontos && c.resultado !== 'incorreta' && !['resposta_curta', 'explicar'].includes(q.tipo)" class="selo" data-tipo="energia">+{{ c.pontos }} {{ c.pontos === 1 ? 'ponto' : 'pontos' }}</span>
    </div>
    <TextoRico v-if="titulo" :texto="titulo" tag="p" class="m-0 mt-1.5 text-[15.5px] font-semibold" />
    <template v-if="d.erro">
      <p class="m-0 mt-3 text-[13px] font-semibold text-texto-2">Por que a sua parece certa</p>
      <TextoRico :texto="d.erro" class="mt-0.5 text-[15px] leading-[1.55]" />
    </template>
    <template v-if="q.tipo === 'verdadeiro_falso' && d.justificativa">
      <p class="m-0 mt-3 text-[13px] font-semibold text-texto-2">Justificativa esperada, para comparar com a sua</p>
      <TextoRico :texto="d.justificativa" class="mt-0.5 text-[15px] leading-[1.55]" />
    </template>
    <template v-if="c.explicacao">
      <p class="m-0 mt-3 text-[13px] font-semibold text-texto-2">Explicação</p>
      <TextoRico :texto="c.explicacao" class="mt-0.5 text-[15px] leading-[1.55]" />
    </template>
    <GraficoDaQuestao :enunciado="q.enunciado" :explicacao="c.explicacao" />
    <blockquote v-if="c.trecho" class="m-0 mt-3 border-l-2 border-borda-forte pl-3 text-[15px] leading-[1.55] text-texto-2">
      "{{ c.trecho.texto.length > 420 ? `${c.trecho.texto.slice(0, 420)}...` : c.trecho.texto }}"
      <span class="mt-1 block text-[12.5px]">{{ c.trecho.material ?? 'Texto' }}<template v-if="c.trecho.pagina">, p. {{ c.trecho.pagina }}</template></span>
    </blockquote>
    <p v-if="!c.pontos || c.resultado === 'incorreta'" class="m-0 mt-3 text-[13px] text-texto-2">{{ textoPontos }}</p>

    <div v-if="item.questaoId" class="mt-3 border-t border-borda/70 pt-2.5 text-[13.5px]" aria-live="polite">
      <button v-if="!problema" type="button" class="link-discreto inline-flex items-center gap-1.5" @click="problema = 'perguntando'">
        <Flag :size="14" :stroke-width="2.2" aria-hidden="true" />Questão com problema
      </button>
      <div v-else-if="problema !== 'tirada'" class="flex flex-wrap items-center gap-x-3 gap-y-2">
        <span class="text-tinta">Tirar esta questão dos estudos? Ela fica nas arquivadas do banco, para corrigir ou apagar.</span>
        <span class="flex gap-2">
          <button type="button" class="botao-secundario botao-p" :disabled="problema === 'salvando'" :aria-busy="problema === 'salvando'" @click="tirarDosEstudos()">
            <span v-if="problema === 'salvando'" class="rodando" aria-hidden="true" />Tirar dos estudos
          </button>
          <button type="button" class="botao-fantasma botao-p" :disabled="problema === 'salvando'" @click="problema = ''">Cancelar</button>
        </span>
      </div>
      <p v-else class="m-0 flex flex-wrap items-center gap-x-3 gap-y-1 text-tinta">
        <span>Tirada dos estudos. Ela está nas arquivadas do banco de questões.</span>
        <button type="button" class="link-discreto inline-flex items-center gap-1.5" @click="tirarDosEstudos(false)"><Undo2 :size="14" :stroke-width="2.2" aria-hidden="true" />Desfazer</button>
      </p>
      <p v-if="erroProblema" class="erro-campo m-0 mt-1.5">{{ erroProblema }}</p>
    </div>
  </section>
</template>

<style scoped>
.pop {
  animation: pop 0.45s var(--ease-saida) both;
}
@media (prefers-reduced-motion: reduce) {
  .pop {
    animation: none;
  }
}
:global(:root.menos-movimento) .pop {
  animation: none;
}
</style>
