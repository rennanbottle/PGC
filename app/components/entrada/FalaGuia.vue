<script setup>
// O guia acompanha um fluxo (cadastro) com uma fala curta ao lado. Quem usa troca o humor e o texto a cada passo.
// "imagem" mostra o guia que a pessoa está escolhendo (antes de ter conta).
// Pequeno de propósito: acompanha, não toma a tela. A fala é texto comum (leitores de tela leem na ordem).
defineProps({
  humor: { type: String, default: 'neutro' },
  texto: { type: String, default: '' },
  tamanho: { type: Number, default: 58 },
  imagem: { type: String, default: '' },
})
</script>

<template>
  <div class="flex items-center gap-3.5">
    <p class="fala-guia relative m-0 min-w-0 flex-1 rounded-[14px] border border-borda bg-folha-2 px-3.5 py-2.5 text-[14px] leading-[1.45] text-texto-2">
      <Transition name="vira" mode="out-in">
        <span :key="texto" class="block">{{ texto }}</span>
      </Transition>
    </p>
    <GuiaPersonagem :humor="humor" :tamanho="tamanho" :imagem="imagem" class="shrink-0" />
  </div>
</template>

<style scoped>
.fala-guia::after {
  content: '';
  position: absolute;
  top: 50%;
  right: -6.5px;
  width: 12px;
  height: 12px;
  margin-top: -6px;
  border-top: 1px solid var(--borda);
  border-right: 1px solid var(--borda);
  border-radius: 0 3px 0 0;
  background: var(--folha-2);
  transform: rotate(45deg);
}
</style>
