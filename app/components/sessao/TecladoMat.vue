<script setup>
// Teclado de símbolos para escrever conta no campo da resposta (x², √, π, Δ, ±, ≤, ∈, ∪...), que no teclado comum
// dá trabalho. O símbolo entra onde está o cursor do campo aberto, sem tirar o foco dele (o clique não rouba o foco).
// "alvo" é o último campo de texto que a pessoa usou nesta questão.
const props = defineProps({
  alvo: { type: Object, default: null },
  travada: { type: Boolean, default: false },
})
// Os símbolos em grupos, como na lista de operadores que o R mandou (contas, comparação, letras e índices,
// conjuntos e lógica, outros). Abre no grupo de contas.
const GRUPOS = [
  { nome: 'Contas', simbolos: [
    { s: 'x²', ins: '²', nome: 'ao quadrado' },
    { s: 'x³', ins: '³', nome: 'ao cubo' },
    { s: 'xⁿ', ins: '^', nome: 'potência' },
    { s: '√', nome: 'raiz quadrada' },
    { s: '∛', nome: 'raiz cúbica' },
    { s: '±', nome: 'mais ou menos' },
    { s: '·', nome: 'vezes' },
    { s: '÷', nome: 'dividido por' },
    { s: '( )', ins: '()', volta: 1, nome: 'parênteses' },
    { s: '[ ]', ins: '[]', volta: 1, nome: 'colchetes' },
    { s: '|x|', ins: '||', volta: 1, nome: 'valor absoluto' },
    { s: '%', nome: 'porcentagem' },
    { s: '!', nome: 'fatorial' },
  ] },
  { nome: 'Comparar', simbolos: [
    { s: '≠', nome: 'diferente' },
    { s: '≤', nome: 'menor ou igual' },
    { s: '≥', nome: 'maior ou igual' },
    { s: '≈', nome: 'aproximadamente' },
    { s: '<', nome: 'menor que' },
    { s: '>', nome: 'maior que' },
    { s: '≡', nome: 'idêntico' },
  ] },
  { nome: 'Letras e índices', simbolos: [
    { s: 'π', nome: 'pi' },
    { s: 'Δ', nome: 'delta' },
    { s: 'α', nome: 'alfa' },
    { s: 'β', nome: 'beta' },
    { s: 'θ', nome: 'teta' },
    { s: 'λ', nome: 'lambda' },
    { s: 'x₁', ins: '₁', nome: 'índice 1' },
    { s: 'x₂', ins: '₂', nome: 'índice 2' },
    { s: 'xₙ', ins: 'ₙ', nome: 'índice n' },
    { s: '°', nome: 'graus' },
    { s: '∞', nome: 'infinito' },
  ] },
  { nome: 'Conjuntos e lógica', simbolos: [
    { s: '∈', nome: 'pertence' },
    { s: '∉', nome: 'não pertence' },
    { s: '⊂', nome: 'está contido' },
    { s: '⊃', nome: 'contém' },
    { s: '∪', nome: 'união' },
    { s: '∩', nome: 'interseção' },
    { s: '∅', nome: 'conjunto vazio' },
    { s: '{ }', ins: '{}', volta: 1, nome: 'chaves' },
    { s: '∧', nome: 'e lógico' },
    { s: '∨', nome: 'ou lógico' },
    { s: '¬', nome: 'não lógico' },
    { s: '⇒', nome: 'implica' },
    { s: '⇔', nome: 'se e somente se' },
  ] },
  { nome: 'Outros', simbolos: [
    { s: '∑', nome: 'somatório' },
    { s: '∏', nome: 'produtório' },
    { s: '∫', nome: 'integral' },
    { s: '∂', nome: 'derivada parcial' },
    { s: '∇', nome: 'nabla' },
    { s: '∥', nome: 'paralelo' },
    { s: '⊥', nome: 'perpendicular' },
    { s: '∠', nome: 'ângulo' },
  ] },
]
const grupo = ref(0)
const id = useId()
const aviso = ref('')
function inserir(simbolo) {
  if (props.travada) return
  const ativo = document.activeElement
  const el = ativo && ['INPUT', 'TEXTAREA'].includes(ativo.tagName) ? ativo : props.alvo
  if (!el || el.readOnly || el.disabled) {
    aviso.value = 'Clique no campo da resposta e depois no símbolo.'
    return
  }
  aviso.value = ''
  const texto = simbolo.ins ?? simbolo.s
  const ini = el.selectionStart ?? el.value.length
  const fim = el.selectionEnd ?? ini
  el.focus()
  el.setRangeText(texto, ini, fim, 'end')
  if (simbolo.volta) {
    const p = el.selectionStart - simbolo.volta
    el.setSelectionRange(p, p)
  }
  el.dispatchEvent(new Event('input', { bubbles: true }))
}
</script>

<template>
  <div class="teclado-mat" role="group" aria-label="Símbolos de matemática">
    <div class="flex flex-wrap gap-1.5" role="tablist" aria-label="Grupos de símbolos">
      <button
        v-for="(g, i) in GRUPOS"
        :id="`${id}-aba-${i}`"
        :key="g.nome"
        type="button"
        role="tab"
        class="aba-teclado"
        :aria-selected="grupo === i"
        :aria-controls="`${id}-grupo`"
        :tabindex="grupo === i ? 0 : -1"
        @mousedown.prevent
        @click="grupo = i"
        @keydown.right.prevent="grupo = (grupo + 1) % GRUPOS.length"
        @keydown.left.prevent="grupo = (grupo + GRUPOS.length - 1) % GRUPOS.length"
      >
        {{ g.nome }}
      </button>
    </div>
    <div :id="`${id}-grupo`" class="mt-2 flex flex-wrap gap-1.5" role="tabpanel" :aria-labelledby="`${id}-aba-${grupo}`">
      <button
        v-for="x in GRUPOS[grupo].simbolos"
        :key="x.nome"
        type="button"
        class="tecla-mat"
        :disabled="travada"
        :aria-label="`Inserir ${x.nome}`"
        :title="x.nome"
        @mousedown.prevent
        @click="inserir(x)"
      >
        {{ x.s }}
      </button>
    </div>
    <p v-if="aviso" class="m-0 mt-1.5 w-full text-[12.5px] text-texto-2" role="status">{{ aviso }}</p>
  </div>
</template>

<style scoped>
.aba-teclado {
  border: 0;
  border-radius: 8px;
  background: transparent;
  padding: 4px 9px;
  color: var(--texto-2);
  font: inherit;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.15s, color 0.15s;
}
.aba-teclado:hover {
  color: var(--tinta);
}
.aba-teclado[aria-selected='true'] {
  background: var(--acento-suave);
  color: var(--acento);
}
.tecla-mat {
  display: inline-grid;
  min-width: 40px;
  height: 36px;
  place-items: center;
  padding: 0 9px;
  border: 1px solid var(--borda-campo);
  border-bottom-width: 2px;
  border-radius: 9px;
  background: var(--folha);
  color: var(--tinta);
  font-size: 16px;
  font-family: 'Cambria Math', 'STIX Two Math', var(--font-sans);
  cursor: pointer;
  transition: transform 0.12s var(--ease-saida), border-color 0.15s, background 0.15s;
}
.tecla-mat:hover {
  border-color: var(--acento);
  background: var(--acento-suave);
}
.tecla-mat:active {
  transform: translateY(1px);
}
.tecla-mat:disabled {
  opacity: 0.5;
  cursor: default;
}
</style>
