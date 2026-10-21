<script setup>
// Lacunas no meio do enunciado: digitar a palavra (sem diferença de acento e maiúscula) ou escolher entre opções.
// O enunciado é desenhado aqui, com o campo no lugar de cada ___.
import { partesComLacunas } from '#shared/regras/sessao.js'

const props = defineProps({
  questao: { type: Object, required: true },
  correcao: { type: Object, default: null },
  travada: { type: Boolean, default: false },
})
const resposta = defineModel({ type: Object, default: () => ({}) })
const digitada = computed(() => props.questao.tipo === 'lacuna_digitada')
const partes = computed(() => partesComLacunas(props.questao.enunciado))
const valor = (k) => (digitada.value ? resposta.value.textos?.[k] ?? '' : resposta.value.escolhas?.[k] ?? '')
function mudar(k, v) {
  const campo = digitada.value ? 'textos' : 'escolhas'
  const lista = [...(resposta.value[campo] ?? [])]
  lista[k] = digitada.value ? v : Number(v)
  resposta.value = { ...resposta.value, [campo]: lista }
}
function certo(k) {
  const d = props.correcao?.detalhe
  if (!d) return null
  return digitada.value ? !!d.acertos?.[k] : d.certas?.[k] === resposta.value.escolhas?.[k]
}
</script>

<template>
  <div>
    <div class="text-[21px] leading-[2.1]">
      <template v-for="(p, i) in partes" :key="i">
        <TextoRico v-if="p.texto !== undefined" :texto="p.texto" tag="span" />
        <span v-else class="mx-1.5 inline-flex items-baseline gap-1 align-baseline">
          <input
            v-if="digitada"
            class="h-10 w-[180px] rounded-[8px] border bg-campo px-2 font-sans text-[16px]"
            :class="certo(p.lacuna) === null ? 'border-borda-campo' : certo(p.lacuna) ? 'border-ok' : 'border-erro'"
            type="text"
            autocomplete="off"
            spellcheck="false"
            :aria-label="`Lacuna ${p.lacuna + 1}`"
            :readonly="travada"
            :value="valor(p.lacuna)"
            maxlength="120"
            @input="mudar(p.lacuna, $event.target.value)"
          >
          <Selecao
            v-else
            class="min-w-[150px] text-[16px] leading-normal"
            :model-value="String(valor(p.lacuna))"
            :opcoes="questao.lacunas[p.lacuna].map((o, j) => ({ valor: String(j), texto: o }))"
            :rotulo="`Lacuna ${p.lacuna + 1}`"
            :desativado="travada"
            :invalido="certo(p.lacuna) === false"
            texto-vazio="Escolha"
            :busca="false"
            @update:model-value="mudar(p.lacuna, $event)"
          />
          <span v-if="certo(p.lacuna) === false" class="font-sans text-[13px] font-semibold text-erro">
            ({{ digitada ? (correcao.detalhe.aceitas?.[p.lacuna] ?? []).join(' ou ') : questao.lacunas[p.lacuna][correcao.detalhe.certas[p.lacuna]] }})
          </span>
        </span>
      </template>
    </div>
    <p v-if="digitada && !correcao" class="m-0 mt-2 text-[13px] text-texto-2">Acento e maiúscula não contam.</p>
  </div>
</template>
