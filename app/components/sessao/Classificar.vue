<script setup>
// Classificar em grupos: cada item recebe um grupo (etiquetas de escolha).
const props = defineProps({
  questao: { type: Object, required: true },
  correcao: { type: Object, default: null },
  travada: { type: Boolean, default: false },
})
const resposta = defineModel({ type: Object, default: () => ({}) })
const id = useId()
const grupo = (p) => resposta.value.grupos?.[p]
function por(p, g) {
  if (!props.travada) resposta.value = { grupos: { ...(resposta.value.grupos ?? {}), [p]: g } }
}
const ok = (p) => (props.correcao ? props.correcao.detalhe?.certos?.[p] === grupo(p) : null)
</script>

<template>
  <ul class="m-0 flex list-none flex-col gap-2 p-0">
    <li v-for="(t, p) in questao.itens" :key="p" class="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-[12px] border bg-campo px-3.5 py-2.5" :class="ok(p) === null ? 'border-borda-campo' : ok(p) ? 'border-ok' : 'border-erro'">
      <span class="min-w-[140px] flex-1 text-[15.5px]">{{ t }}</span>
      <fieldset class="m-0 flex flex-wrap gap-1.5 border-0 p-0">
        <legend class="so-leitor">Grupo de {{ t }}</legend>
        <label v-for="(g, gi) in questao.grupos" :key="gi" class="pilula min-h-8 py-1 text-[13.5px]">
          <input type="radio" class="so-leitor" :name="`${id}-${p}`" :checked="grupo(p) === gi" :disabled="travada" @change="por(p, gi)">{{ g }}
        </label>
      </fieldset>
      <span v-if="ok(p) === false" class="text-[13px] font-semibold text-erro">é {{ questao.grupos[correcao.detalhe.certos[p]] }}</span>
    </li>
  </ul>
</template>
