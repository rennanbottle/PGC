<script setup>
// Acerto por grupo (tipo de questão, nível, bloco, matéria) em barras deitadas: cada linha mostra quantas ficaram
// certas, parciais, erradas e em branco, lado a lado, com a porcentagem e a fração escritas à direita (a cor nunca
// diz nada sozinha: a legenda tem ícone e o número está escrito). As barras crescem quando o gráfico aparece.
// Passar o mouse ou focar a linha mostra a conta inteira.
// Uso: <GraficoAcerto :linhas="[{ rotulo: 'Lacunas', certas: 3, parciais: 0, erradas: 1, branco: 0, total: 4 }]" descricao="..." />
import { Circle, CircleAlert, CircleCheck, CircleX } from '@lucide/vue'

const props = defineProps({
  linhas: { type: Array, required: true },
  descricao: { type: String, required: true },
  legenda: { type: Boolean, default: true },
  larguraRotulo: { type: String, default: '8.5rem' },
})
const PARTES = [
  { chave: 'certas', nome: 'certas', um: 'certa', cor: 'var(--ok-vivo)', icone: CircleCheck, texto: 'text-ok' },
  { chave: 'parciais', nome: 'parciais', um: 'parcial', cor: 'var(--aviso-vivo)', icone: CircleAlert, texto: 'text-aviso' },
  { chave: 'erradas', nome: 'erradas', um: 'errada', cor: 'var(--erro-vivo)', icone: CircleX, texto: 'text-erro' },
  { chave: 'branco', nome: 'em branco', um: 'em branco', cor: 'var(--folha-3)', icone: Circle, texto: 'text-texto-3' },
]
const acertoDe = (l) => (l.total ? Math.round((100 * (l.certas + 0.5 * (l.parciais ?? 0))) / l.total) : 0)
const presentes = computed(() => PARTES.filter((p) => props.linhas.some((l) => (l[p.chave] ?? 0) > 0)))
const conta = (l) => PARTES.filter((p) => (l[p.chave] ?? 0) > 0).map((p) => `${l[p.chave]} ${l[p.chave] === 1 ? p.um : p.nome}`).join(', ')
const focada = ref(-1)
</script>

<template>
  <figure class="m-0">
    <figcaption class="so-leitor">{{ descricao }}</figcaption>
    <ul v-if="legenda && presentes.length > 1" class="m-0 mb-3 flex list-none flex-wrap gap-x-4 gap-y-1 p-0 text-[12.5px] text-texto-2" aria-hidden="true">
      <li v-for="p in presentes" :key="p.chave" class="flex items-center gap-1.5"><component :is="p.icone" :size="13" :stroke-width="2.4" :class="p.texto" />{{ p.nome }}</li>
    </ul>
    <ul class="m-0 flex list-none flex-col gap-1 p-0" aria-hidden="true">
      <li
        v-for="(l, i) in linhas"
        :key="l.rotulo"
        class="linha-acerto relative grid items-center gap-x-3 rounded-[10px] px-2 py-1.5"
        :style="{ gridTemplateColumns: `minmax(0, ${larguraRotulo}) minmax(0, 1fr) 4.6rem` }"
        @pointerenter="focada = i"
        @pointerleave="focada = -1"
      >
        <span class="truncate text-[13.5px] font-semibold" :title="l.nome ?? l.rotulo">{{ l.rotulo }}</span>
        <span class="block h-2.5 overflow-hidden rounded-full bg-folha-3">
          <span class="parte-acerto flex h-full gap-[2px]" :style="{ animationDelay: `${i * 70 + 150}ms` }">
            <span v-for="p in PARTES.filter((x) => (l[x.chave] ?? 0) > 0)" :key="p.chave" class="h-full" :style="{ flex: l[p.chave], background: p.cor }" />
          </span>
        </span>
        <span class="text-right text-[13.5px] tabular-nums"><b>{{ acertoDe(l) }}%</b> <span class="text-[12px] text-texto-2">{{ l.certas }}/{{ l.total }}</span></span>
        <span v-if="focada === i" class="pointer-events-none absolute bottom-full left-1/2 z-10 -translate-x-1/2 whitespace-nowrap rounded-lg bg-tinta px-2 py-1 text-[12px] font-semibold text-folha shadow-[var(--sombra-menu)] aparece">{{ l.nome ?? l.rotulo }}: {{ conta(l) }}</span>
      </li>
    </ul>
  </figure>
</template>

<style scoped>
.linha-acerto {
  transition: background 0.15s;
}
.linha-acerto:hover {
  background: var(--folha-2);
}
.parte-acerto {
  transform-origin: left center;
  animation: cresce-x 0.8s var(--ease-saida) backwards;
}
</style>
