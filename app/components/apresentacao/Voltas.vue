<script setup>
// Quando uma questão volta: a linha do tempo da apresentação. Sem resposta, mostra o caminho de quem acerta sempre
// (intervalos do FSRS com os parâmetros padrão: 3, 11, 35 e 101 dias). Depois da questão de exemplo ao lado, marca a
// próxima volta: em 3 dias se acertou, amanhã se errou (e aí os intervalos recomeçam curtos).
// Os trechos crescem da esquerda para a direita quando a linha aparece na tela.
const props = defineProps({
  resposta: { type: Boolean, default: null }, // true acertou, false errou, null ainda não respondeu
})
const CERTO = [
  { quando: 'Hoje', depois: 0 },
  { quando: 'Dia 3', depois: 3 },
  { quando: 'Dia 14', depois: 11 },
  { quando: 'Dia 49', depois: 35 },
  { quando: 'Dia 150', depois: 101 },
]
const ERRADO = [
  { quando: 'Hoje', depois: 0 },
  { quando: 'Amanhã', depois: 1 },
]
const voltas = computed(() => (props.resposta === false ? ERRADO : CERTO))
const proxima = computed(() => (props.resposta === null ? -1 : 1))
const legenda = computed(() => {
  if (props.resposta === true) return 'Você acertou: a próxima volta é no dia 3. Se continuar acertando, os intervalos crescem assim.'
  if (props.resposta === false) return 'Você errou: ela volta amanhã. Os intervalos recomeçam curtos e crescem de novo a cada acerto.'
  return 'Na quinta revisão, a questão já fica 101 dias sem aparecer, contra 3 depois da primeira.'
})
</script>

<template>
  <div class="cartao">
    <p class="m-0 text-[14px] text-texto-2">{{ resposta === null ? 'Uma questão de Matemática, com acerto em todas as revisões' : 'A questão de exemplo, depois da sua resposta' }}</p>
    <Transition name="troca-linha" mode="out-in">
      <ol :key="resposta === false ? 'errado' : 'certo'" class="linha-tempo m-0 mt-7 list-none p-0" aria-label="Datas em que a questão volta">
        <li v-for="(v, i) in voltas" :key="v.quando" class="parada" :class="i === proxima && 'proxima'" :style="{ '--peso': i ? Math.log(v.depois + 1).toFixed(2) : 0, '--i': i }">
          <span v-if="i" class="trecho" aria-hidden="true"><span class="trecho-dias">+{{ v.depois }} {{ v.depois === 1 ? 'dia' : 'dias' }}</span></span>
          <span class="ponto" aria-hidden="true" />
          <span class="quando">{{ v.quando }}<span v-if="i" class="so-leitor">, {{ v.depois }} {{ v.depois === 1 ? 'dia' : 'dias' }} depois da anterior</span><span v-if="i === proxima" class="so-leitor">, a próxima volta</span></span>
        </li>
      </ol>
    </Transition>
    <p class="m-0 mt-6 border-t border-borda pt-4 text-[14px] leading-[1.55] text-texto-2" aria-live="polite">{{ legenda }}</p>
  </div>
</template>

<style scoped>
.linha-tempo {
  display: flex;
  align-items: flex-start;
}
.parada {
  position: relative;
  display: flex;
  flex: var(--peso) 1 0;
  flex-direction: column;
  align-items: flex-end;
  min-width: 52px;
}
.parada:first-child {
  flex: 0 0 auto;
  align-items: flex-start;
}
.trecho {
  position: absolute;
  top: 7px;
  left: 0;
  right: 8px;
  height: 2px;
  background: var(--acento);
  transform-origin: left center;
  animation: cresce-x 0.5s var(--ease-saida) backwards;
  animation-delay: calc(var(--i) * 260ms - 100ms);
}
.trecho-dias {
  position: absolute;
  bottom: 8px;
  left: 50%;
  transform: translateX(-50%);
  white-space: nowrap;
  font-size: 12.5px;
  font-weight: 600;
  color: var(--texto-2);
}
.ponto {
  width: 16px;
  height: 16px;
  border: 3px solid var(--acento);
  border-radius: 999px;
  background: var(--folha);
  animation: pop 0.4s var(--ease-mola) backwards;
  animation-delay: calc(var(--i) * 260ms + 250ms);
}
.parada:first-child .ponto {
  background: var(--acento);
  animation-delay: 0ms;
}
.parada.proxima .ponto {
  background: var(--energia);
  border-color: var(--energia);
  box-shadow: 0 0 0 5px var(--energia-suave);
}
.quando {
  margin-top: 8px;
  font-family: var(--font-titulo);
  font-size: 14px;
  font-weight: 700;
  white-space: nowrap;
  transform: translateX(calc(50% - 8px));
}
.parada.proxima .quando {
  color: var(--energia-texto);
}
.parada:first-child .quando,
.parada:last-child .quando {
  transform: none;
}
.troca-linha-enter-active {
  transition: opacity 0.25s ease;
}
.troca-linha-leave-active {
  transition: opacity 0.15s ease;
}
.troca-linha-enter-from,
.troca-linha-leave-to {
  opacity: 0;
}
@media (max-width: 520px) {
  .trecho-dias {
    font-size: 11.5px;
  }
  .quando {
    font-size: 12.5px;
  }
}
@media (prefers-reduced-motion: reduce) {
  .trecho,
  .ponto {
    animation: none;
  }
}
</style>
