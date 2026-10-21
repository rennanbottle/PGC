<script setup>
// Escolher o guia: os prontos ou "Criar o meu" (com o passo a passo e o envio dos mosaicos).
// v-model: { id: 'gato' | ... | 'proprio', imagem: data URL do guia próprio ou null, nome: '' }.
// Qualquer guia pode ganhar outro nome. Ao trocar de guia, o campo passa para o nome de costume do novo, a não ser
// que a pessoa já tenha escrito um nome dela. Usado no cadastro (passo "Seu guia") e no perfil (trocar o guia).
import { Check, Sparkles } from '@lucide/vue'
import { GUIAS_PRONTOS, NOME_GUIA_MAX, nomePadraoDoGuia } from '#shared/regras/guias.js'

const escolha = defineModel({ type: Object, required: true })
const props = defineProps({ imagemAtual: { type: String, default: '' } })
const idCampo = useId()

function escolher(id) {
  const nomeAtual = String(escolha.value.nome ?? '').trim()
  const eraDeCostume = !nomeAtual || nomeAtual === nomePadraoDoGuia(escolha.value.id)
  escolha.value = { ...escolha.value, id, nome: eraDeCostume ? nomePadraoDoGuia(id) : nomeAtual }
}
// Começa com o nome de costume no campo (sem texto de exemplo dentro dele).
if (!String(escolha.value.nome ?? '').trim() && escolha.value.id !== 'proprio') escolha.value = { ...escolha.value, nome: nomePadraoDoGuia(escolha.value.id) }
const imagemPropria = computed({
  get: () => escolha.value.imagem ?? null,
  set: (v) => (escolha.value = { ...escolha.value, imagem: v }),
})
const nome = computed({
  get: () => escolha.value.nome ?? '',
  set: (v) => (escolha.value = { ...escolha.value, nome: v }),
})
const previaPropria = computed(() => escolha.value.imagem || props.imagemAtual)
</script>

<template>
  <div class="flex flex-col gap-5">
    <div role="radiogroup" aria-label="Guia" class="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
      <button
        v-for="g in GUIAS_PRONTOS"
        :key="g.id"
        type="button"
        role="radio"
        class="opcao-guia"
        :aria-checked="escolha.id === g.id"
        @click="escolher(g.id)"
      >
        <GuiaPersonagem :imagem="g.arquivo" :humor="escolha.id === g.id ? 'feliz' : 'neutro'" :tamanho="76" />
        <span class="flex w-full items-center gap-1.5 text-[14px] font-semibold">
          {{ g.nome }}
          <Check v-if="escolha.id === g.id" :size="15" :stroke-width="2.8" class="ml-auto text-acento" aria-hidden="true" />
        </span>
      </button>
      <button type="button" role="radio" class="opcao-guia" :aria-checked="escolha.id === 'proprio'" @click="escolher('proprio')">
        <GuiaPersonagem v-if="previaPropria" :imagem="previaPropria" humor="feliz" :tamanho="76" />
        <span v-else class="grid size-[76px] place-items-center rounded-[28%] border border-borda text-texto-2" aria-hidden="true">
          <Sparkles :size="26" :stroke-width="1.8" />
        </span>
        <span class="flex w-full items-center gap-1.5 text-[14px] font-semibold">
          Criar o meu
          <Check v-if="escolha.id === 'proprio'" :size="15" :stroke-width="2.8" class="ml-auto text-acento" aria-hidden="true" />
        </span>
      </button>
    </div>

    <Transition name="abre">
      <div v-if="escolha.id === 'proprio'" class="border-t border-borda pt-5">
        <GuiaCriarGuia v-model:imagem="imagemPropria" />
      </div>
    </Transition>

    <div class="max-w-[320px]">
      <label class="rotulo" :for="`${idCampo}-nome`">Nome do guia</label>
      <input :id="`${idCampo}-nome`" v-model="nome" class="campo" type="text" :maxlength="NOME_GUIA_MAX" autocomplete="off" :aria-describedby="`${idCampo}-ajuda`">
      <p :id="`${idCampo}-ajuda`" class="ajuda">{{ escolha.id === 'proprio' ? 'Opcional. Aparece quando o guia se apresenta.' : 'Pode trocar. Aparece quando o guia se apresenta.' }}</p>
    </div>
  </div>
</template>

<style scoped>
.opcao-guia {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 8px;
  padding: 10px 12px 11px;
  border: 1.5px solid var(--borda);
  border-radius: 16px;
  background: var(--folha);
  color: var(--tinta);
  text-align: left;
  cursor: pointer;
  transition: border-color 0.15s;
}
.opcao-guia:hover {
  border-color: var(--borda-forte);
}
.opcao-guia[aria-checked='true'] {
  border-color: var(--acento);
}
</style>
