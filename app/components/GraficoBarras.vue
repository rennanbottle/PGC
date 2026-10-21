<script setup>
// Barras verticais (questões por dia, acertos por bloco, tempo por questão). Crescem uma vez ao aparecer, com 3 px
// entre elas. A barra marcada como destaque (hoje) fica no azul cheio; as outras num azul apagado, ou na cor que o
// dado trouxer em "cor" (ex.: a cor do resultado da questão, sempre com o resultado escrito na dica).
// "media" desenha uma linha tracejada com o texto ao lado (ex.: a média de tempo). "valores" escreve o número em
// cima de cada barra, para poucas barras. Passar o mouse ou focar uma barra mostra a dica. Leitores de tela recebem o
// resumo em "descricao".
// Uso: <GraficoBarras :dados="[{ rotulo: 'S', valor: 12, dica: 'Segunda, 12 questões' }, ...]" descricao="..." />
const props = defineProps({
  dados: { type: Array, required: true },
  altura: { type: Number, default: 120 },
  descricao: { type: String, required: true },
  maximo: { type: Number, default: 0 },
  mostrarRotulos: { type: Boolean, default: true },
  media: { type: Object, default: null }, // { valor, texto }
  valores: { type: Boolean, default: false },
  sufixo: { type: String, default: '' },
})
const topo = computed(() => (props.valores ? 18 : 0))
const util = computed(() => props.altura - topo.value)
const maior = computed(() => Math.max(1, props.maximo, props.media?.valor ?? 0, ...props.dados.map((d) => d.valor)))
const altura = (d) => (d.valor > 0 ? Math.max(4, Math.round((d.valor / maior.value) * (util.value - 4))) : 2)
const alturaMedia = computed(() => (props.media ? Math.round((props.media.valor / maior.value) * (util.value - 4)) : 0))
const focada = ref(-1)
const corDe = (d) => d.cor ?? (d.destaque ? 'var(--acento)' : d.valor > 0 ? 'color-mix(in oklab, var(--acento) 38%, var(--folha-3))' : 'var(--folha-3)')
// A dica fica dentro do gráfico: nas barras da ponta ela se alinha pela borda, não pelo meio.
const lado = (i) => {
  const n = props.dados.length
  if (n > 2 && i < n / 4) return 'left-0'
  if (n > 2 && i >= (n * 3) / 4) return 'right-0'
  return 'left-1/2 -translate-x-1/2'
}
const numero = (v) => Number(v).toLocaleString('pt-BR', { maximumFractionDigits: 1 })
</script>

<template>
  <figure class="m-0">
    <figcaption class="so-leitor">{{ descricao }}</figcaption>
    <div class="relative flex items-end gap-[3px]" :style="{ height: `${altura}px` }" aria-hidden="true">
      <span class="absolute inset-x-0 bottom-0 h-px bg-borda" />
      <template v-if="media && media.valor > 0">
        <span class="linha-media absolute inset-x-0 z-[1] border-t-[1.5px] border-dashed border-texto-3" :style="{ bottom: `${alturaMedia}px` }" />
        <span class="absolute right-0 z-[2] -translate-y-full rounded-md bg-folha px-1.5 pb-0.5 text-[11.5px] font-semibold text-texto-2" :style="{ bottom: `${alturaMedia + 2}px` }">{{ media.texto }}</span>
      </template>
      <div
        v-for="(d, i) in dados"
        :key="i"
        class="group relative flex h-full flex-1 cursor-default flex-col items-center justify-end"
        @pointerenter="focada = i"
        @pointerleave="focada = -1"
      >
        <span v-if="valores" class="mb-1 text-[12px] font-semibold tabular-nums text-texto-2 aparece" :style="{ animationDelay: `${i * 35 + 450}ms` }">{{ numero(d.valor) }}{{ sufixo }}</span>
        <span
          class="barra-cresce block w-full max-w-[34px] rounded-t-[5px] rounded-b-[2px] transition-[filter,transform] duration-150 group-hover:brightness-110"
          :style="{ height: `${altura(d)}px`, background: corDe(d), animationDelay: `${i * 35 + 120}ms` }"
        />
        <span
          v-if="focada === i || (d.destaque && focada === -1 && d.valor > 0)"
          class="pointer-events-none absolute z-10 -translate-y-1.5 whitespace-nowrap rounded-lg bg-tinta px-2 py-1 text-[12px] font-semibold text-folha shadow-[var(--sombra-menu)] aparece"
          :class="lado(i)"
          :style="{ bottom: `${altura(d) + topo}px` }"
        >{{ d.dica ?? d.valor }}</span>
      </div>
    </div>
    <div v-if="mostrarRotulos" class="mt-2 flex gap-[3px]" aria-hidden="true">
      <span v-for="(d, i) in dados" :key="i" class="flex-1 truncate text-center text-[11.5px] font-semibold" :class="d.destaque ? 'text-acento' : 'text-texto-3'">{{ d.rotulo }}</span>
    </div>
  </figure>
</template>

<style scoped>
.linha-media {
  transform-origin: left center;
  animation: cresce-x 0.9s var(--ease-saida) 0.5s backwards;
}
</style>
