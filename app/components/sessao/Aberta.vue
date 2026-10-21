<script setup>
// Cartão, resposta curta e explicar: a pessoa escreve antes de ver a resposta. Depois vê a esperada e se avalia:
// no cartão, sabia, quase ou não sabia; nas abertas, marca os pontos-chave que escreveu (não conta pontos).
const props = defineProps({
  questao: { type: Object, required: true },
  revelar: { type: Object, default: null },
  correcao: { type: Object, default: null },
  travada: { type: Boolean, default: false },
})
const resposta = defineModel({ type: Object, default: () => ({}) })
const id = useId()
const cartao = computed(() => props.questao.tipo === 'cartao')
const mostrar = computed(() => props.revelar ?? props.correcao?.revelar ?? null)
function ponto(i, v) {
  const lista = [...(resposta.value.pontos ?? (mostrar.value?.pontos ?? []).map(() => false))]
  lista[i] = v
  resposta.value = { ...resposta.value, pontos: lista }
}
</script>

<template>
  <div class="flex flex-col gap-4">
    <div>
      <label class="text-[13.5px] font-semibold" :for="`${id}-texto`">{{ cartao ? 'Escreva o que lembra antes de virar' : 'Sua resposta' }}</label>
      <textarea :id="`${id}-texto`" class="campo mt-1 h-auto min-h-[110px] resize-y py-2.5 text-[16px] leading-[1.5]" :readonly="travada || !!mostrar" :value="resposta.texto ?? ''" maxlength="3000" @input="resposta = { ...resposta, texto: $event.target.value }" />
    </div>
    <div v-if="mostrar" class="rounded-[12px] border border-borda bg-folha px-4 py-3">
      <p class="m-0 text-[13px] font-semibold text-texto-2">{{ cartao ? 'Verso' : 'Resposta esperada' }}</p>
      <TextoRico :texto="cartao ? mostrar.verso : mostrar.resposta" class="mt-1 text-[17px] leading-[1.55]" />
      <template v-if="!cartao && mostrar.pontos?.length">
        <p class="m-0 mt-3 text-[13px] font-semibold text-texto-2">Marque os pontos que a sua resposta tem</p>
        <label v-for="(p, i) in mostrar.pontos" :key="i" class="linha-opcao -mx-1 mt-1 px-1 py-1.5">
          <input type="checkbox" class="so-leitor" :checked="resposta.pontos?.[i] === true" :disabled="!!correcao" @change="ponto(i, $event.target.checked)">
          <span class="caixa" aria-hidden="true" />
          <span class="text-[15px]">{{ p }}</span>
        </label>
        <p class="m-0 mt-2 text-[12.5px] text-texto-2">Correção feita por você: não conta pontos nem proficiência.</p>
      </template>
      <fieldset v-if="cartao && !correcao" class="m-0 mt-3 min-w-0 border-0 p-0">
        <legend class="mb-2 text-[13px] font-semibold text-texto-2">Como foi?</legend>
        <div class="flex flex-wrap gap-2">
          <label v-for="[v, n] in [['sabia', 'Sabia'], ['quase', 'Quase'], ['nao', 'Não sabia']]" :key="v" class="pilula">
            <input type="radio" class="so-leitor" :name="`${id}-auto`" :checked="resposta.autoavaliacao === v" @change="resposta = { ...resposta, autoavaliacao: v }">{{ n }}
          </label>
        </div>
      </fieldset>
    </div>
  </div>
</template>
