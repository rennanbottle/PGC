<script setup>
// Assuntos sugeridos pelo catálogo para a matéria, na ordem das aulas. Um toque adiciona um;
// "Adicionar todos" põe a lista inteira. Com "destaque" (matéria sem assuntos), o guia apresenta a lista.
import { Lightbulb, Plus } from '@lucide/vue'

const props = defineProps({
  nomes: { type: Array, required: true },
  materia: { type: String, required: true },
  destaque: { type: Boolean, default: false },
  // Nomes sendo adicionados agora (mostram o carregando).
  ocupados: { type: Array, default: () => [] },
  todosCarregando: { type: Boolean, default: false },
})
defineEmits(['adicionar', 'adicionar-todos'])

const ocupado = (n) => props.ocupados.includes(n)
</script>

<template>
  <div :class="destaque ? 'destaque' : 'compacto'">
    <GuiaPersonagem v-if="destaque" humor="acenando" :tamanho="72" class="hidden shrink-0 sm:block" />
    <div class="min-w-0 flex-1">
      <template v-if="destaque">
        <h3 class="titulo-cartao">Os assuntos de {{ materia }}, na ordem das aulas</h3>
        <p class="m-0 mt-1 max-w-[560px] text-[14.5px] leading-normal text-texto-2">Toque nos que você vai estudar ou adicione todos. Dá para mudar depois.</p>
      </template>
      <p v-else class="m-0 flex items-center gap-2 text-[13.5px] font-semibold text-texto-2">
        <Lightbulb :size="16" :stroke-width="2" aria-hidden="true" />Mais assuntos de {{ materia }}
      </p>

      <TransitionGroup name="chip" tag="ul" class="m-0 mt-3 flex list-none flex-wrap gap-2 p-0" :aria-label="`Assuntos sugeridos para ${materia}`">
        <li v-for="n in nomes" :key="n">
          <button
            type="button"
            class="chip-sugestao"
            :aria-label="`Adicionar o assunto ${n}`"
            :aria-busy="ocupado(n)"
            :disabled="ocupado(n) || todosCarregando"
            @click="$emit('adicionar', n)"
          >
            <span v-if="ocupado(n)" class="rodando" aria-hidden="true" />
            <Plus v-else :size="15" :stroke-width="2.3" aria-hidden="true" class="mais" />
            {{ n }}
          </button>
        </li>
      </TransitionGroup>

      <div v-if="nomes.length > 1" class="mt-4">
        <BotaoAdicionar v-if="destaque" :desativado="todosCarregando" @click="$emit('adicionar-todos')">
          {{ todosCarregando ? 'Adicionando...' : `Adicionar os ${nomes.length}` }}
        </BotaoAdicionar>
        <button v-else type="button" class="link text-[14px]" :disabled="todosCarregando" @click="$emit('adicionar-todos')">Adicionar todos ({{ nomes.length }})</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.destaque {
  display: flex;
  align-items: flex-start;
  gap: 20px;
  padding: 20px;
  border-radius: 16px;
  background: var(--folha-2);
}
.compacto {
  padding: 16px 20px 18px;
  border-top: 1px solid var(--borda);
}
.chip-sugestao {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 36px;
  padding: 0 12px 0 10px;
  border: 1px solid var(--borda-forte);
  border-radius: 10px;
  background: var(--folha);
  color: var(--tinta);
  font: inherit;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: border-color 0.18s, background-color 0.18s, color 0.18s, transform 0.25s var(--ease-mola);
}
.chip-sugestao .mais {
  color: var(--acento);
  transition: transform 0.3s var(--ease-mola);
}
.chip-sugestao:hover:not(:disabled) {
  border-color: var(--acento);
  background: var(--acento-suave);
  color: var(--acento);
}
.chip-sugestao:hover:not(:disabled) .mais {
  transform: rotate(90deg);
}
.chip-sugestao:active:not(:disabled) {
  transform: scale(0.96);
}
.chip-sugestao:disabled {
  cursor: default;
}
.chip-leave-active {
  transition: opacity 0.28s ease, transform 0.32s var(--ease-saida);
}
.chip-leave-to {
  opacity: 0;
  transform: scale(0.6) translateY(-6px);
}
.chip-move {
  transition: transform 0.3s var(--ease-saida);
}
.chip-enter-active {
  transition: opacity 0.25s ease, transform 0.25s var(--ease-saida);
}
.chip-enter-from {
  opacity: 0;
  transform: scale(0.85);
}
@media (prefers-reduced-motion: reduce) {
  .chip-sugestao, .chip-sugestao .mais, .chip-leave-active, .chip-move, .chip-enter-active { transition: none; }
}
:global(:root.menos-movimento) .chip-sugestao,
:global(:root.menos-movimento) .chip-leave-active,
:global(:root.menos-movimento) .chip-move,
:global(:root.menos-movimento) .chip-enter-active {
  transition: none;
}
</style>
