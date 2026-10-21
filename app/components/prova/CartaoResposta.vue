<script setup>
// Cartão-resposta, como o do ENEM: uma linha por questão, com as bolinhas preenchidas a caneta.
// Durante a prova: a linha atual fica marcada e clicar numa linha leva até a questão.
// Depois de entregar ("conferido"): a certa ganha o anel e cada linha diz se acertou, errou ou ficou em branco
// (com ícone e texto, nunca só pela cor).
// Uso: <ProvaCartaoResposta :itens="itens" :respostas="respostas" :marcadas="marcadas" :atual="3" @ir="ir" />
import { Check, Flag, Minus, X } from '@lucide/vue'
import { linhaDoCartao } from '#shared/regras/provas.js'

const props = defineProps({
  itens: { type: Array, required: true },
  respostas: { type: Object, default: () => ({}) },
  marcadas: { type: Object, default: () => ({}) },
  atual: { type: Number, default: -1 },
  conferido: { type: Boolean, default: false },
  so: { type: String, default: '' }, // 'erradas': no conferido, mostra só as que não acertou
  colunas: { type: Boolean, default: false }, // em colunas (no resultado, que tem largura)
})
const emit = defineEmits(['ir'])

const linhas = computed(() => props.itens.map((it, i) => {
  const l = linhaDoCartao({ ...it, resposta: props.respostas[it.id] ?? it.resposta })
  return { ...l, i, id: it.id, numero: String(i + 1).padStart(2, '0'), marcada: !!props.marcadas[it.id] }
}).filter((l) => !(props.conferido && props.so === 'erradas' && l.resultado === 'correta')))

const SITUACAO = {
  correta: { icone: Check, texto: 'certa', classe: 'text-ok' },
  parcial: { icone: Check, texto: 'meio certa', classe: 'text-aviso' },
  errada: { icone: X, texto: 'errada', classe: 'text-erro' },
  em_branco: { icone: Minus, texto: 'em branco', classe: 'text-texto-3' },
}
const situacao = (l) => SITUACAO[l.resultado ?? 'em_branco'] ?? SITUACAO.errada
function rotulo(l) {
  const marcadas = l.opcoes.filter((o) => o.marcada).map((o) => o.letra).join(' e ')
  const parte = l.tipo === 'bolinhas' ? (marcadas ? `marcou ${marcadas}` : 'em branco') : l.respondida ? 'respondida' : 'em branco'
  if (props.conferido) {
    const certa = l.opcoes.filter((o) => o.certa).map((o) => o.letra).join(' e ')
    return `Questão ${l.i + 1}: ${parte}, ${situacao(l).texto}${certa && l.resultado !== 'correta' ? `, a certa é ${certa}` : ''}`
  }
  return `Questão ${l.i + 1}: ${parte}${l.marcada ? ', marcada para voltar' : ''}${l.i === props.atual ? ', atual' : ''}`
}
</script>

<template>
  <ol class="cartao-resposta m-0 list-none p-0" :class="colunas && 'gap-x-6 sm:columns-2 lg:columns-3'">
    <li v-for="l in linhas" :key="l.id">
      <button
        type="button"
        class="linha-cartao"
        :class="{ atual: l.i === atual }"
        :aria-current="l.i === atual ? 'step' : undefined"
        :aria-label="rotulo(l)"
        @click="emit('ir', l.i)"
      >
        <span class="w-[22px] shrink-0 text-[12.5px] font-semibold tabular-nums text-texto-2">{{ l.numero }}</span>
        <span v-if="l.tipo === 'bolinhas'" class="flex gap-[5px]" aria-hidden="true">
          <span
            v-for="o in l.opcoes"
            :key="o.letra"
            class="bolinha"
            :class="{ cheia: o.marcada, certa: conferido && o.certa }"
          >{{ o.letra }}</span>
        </span>
        <span v-else class="text-[12.5px]" :class="l.respondida ? 'font-semibold text-tinta' : 'text-texto-3'" aria-hidden="true">{{ l.respondida ? 'Respondida' : 'Em branco' }}</span>
        <span class="ml-auto flex items-center gap-1.5" aria-hidden="true">
          <Flag v-if="!conferido && l.marcada" :size="13" :stroke-width="2.4" class="text-acento" />
          <component :is="situacao(l).icone" v-if="conferido" :size="15" :stroke-width="2.6" :class="situacao(l).classe" />
        </span>
      </button>
    </li>
  </ol>
</template>
