<script setup>
// Barras deitadas para comparar categorias (acerto por matéria, por tipo, por nível).
// O texto usa as cores de texto; a cor da série (ex.: a cor da matéria) fica só na marca e na barra.
// Cada barra cresce ao aparecer, uma depois da outra. Leitores de tela recebem a lista em texto.
// itens: [{ id, rotulo, valor (0 a 100), cor?, detalhe? }]. Sem dica ao passar o mouse: a dica do PGC abre ao lado
// do elemento e, numa linha da largura do cartão, sairia da tela; o valor já está escrito na linha.
const props = defineProps({
  itens: { type: Array, default: () => [] },
  sufixo: { type: String, default: '%' },
  descricao: { type: String, default: '' },
})
const resumo = computed(() => props.descricao || props.itens.map((i) => `${i.rotulo}: ${i.valor}${props.sufixo}`).join('; '))
</script>

<template>
  <div>
    <p class="so-leitor">{{ resumo }}</p>
    <ul class="m-0 flex list-none flex-col gap-3.5 p-0" aria-hidden="true">
      <li v-for="(item, i) in itens" :key="item.id ?? item.rotulo">
        <div class="flex items-baseline justify-between gap-3 text-[14px]">
          <span class="flex min-w-0 items-center gap-2">
            <span v-if="item.cor" class="size-2.5 shrink-0 rounded-full" :style="{ background: item.cor }" />
            <span class="truncate font-medium">{{ item.rotulo }}</span>
            <span v-if="item.detalhe" class="hidden shrink-0 text-[12.5px] text-texto-3 sm:inline">{{ item.detalhe }}</span>
          </span>
          <span class="shrink-0 font-semibold tabular-nums">{{ item.valor }}{{ sufixo }}</span>
        </div>
        <div class="barra fina mt-1.5">
          <i :style="{ width: `${Math.max(2, Math.min(100, item.valor))}%`, background: item.cor || undefined, animationDelay: `${0.1 + i * 0.07}s` }" />
        </div>
      </li>
    </ul>
  </div>
</template>
