<script setup>
// Paginação de lista longa: "51 a 100 de 312", a página anterior, os números (com reticências quando são muitos) e a
// próxima. No celular, os números dão lugar a "Página 2 de 7". A página atual tem aria-current e fundo cheio (não
// depende só da cor). Uso: <Paginacao v-model="pagina" :total="lista.total" :por-pagina="50" />
import { ChevronLeft, ChevronRight } from '@lucide/vue'
import { paginasVisiveis, totalDePaginas } from '#shared/regras/paginacao.js'

const props = defineProps({
  total: { type: Number, required: true },
  porPagina: { type: Number, default: 50 },
  rotulo: { type: String, default: 'Páginas da lista' },
  carregando: { type: Boolean, default: false },
})
const pagina = defineModel({ type: Number, default: 1 })
const paginas = computed(() => totalDePaginas(props.total, props.porPagina))
const de = computed(() => (props.total ? (pagina.value - 1) * props.porPagina + 1 : 0))
const ate = computed(() => Math.min(props.total, pagina.value * props.porPagina))
const numeros = computed(() => paginasVisiveis(paginas.value, pagina.value))
function ir(p) {
  if (p >= 1 && p <= paginas.value && p !== pagina.value) pagina.value = p
}
const numero = (n) => n.toLocaleString('pt-BR')
</script>

<template>
  <nav class="flex flex-wrap items-center justify-between gap-3" :aria-label="rotulo">
    <p class="m-0 text-[13.5px] text-texto-2" aria-live="polite">
      <b class="tabular-nums text-tinta">{{ numero(de) }}</b> a <b class="tabular-nums text-tinta">{{ numero(ate) }}</b> de <span class="tabular-nums">{{ numero(total) }}</span>
    </p>
    <div v-if="paginas > 1" class="flex items-center gap-1">
      <button type="button" class="botao-pagina" :disabled="pagina <= 1 || carregando" aria-label="Página anterior" @click="ir(pagina - 1)">
        <ChevronLeft :size="17" :stroke-width="2.2" aria-hidden="true" /><span class="hidden sm:inline">Anterior</span>
      </button>
      <ol class="m-0 hidden list-none items-center gap-1 p-0 sm:flex">
        <li v-for="(n, i) in numeros" :key="`${n}-${i}`">
          <span v-if="n === '...'" class="px-1 text-texto-3" aria-hidden="true">...</span>
          <button v-else type="button" class="botao-pagina numero" :aria-current="n === pagina ? 'page' : undefined" :aria-label="`Página ${n}`" :disabled="carregando" @click="ir(n)">{{ n }}</button>
        </li>
      </ol>
      <span class="px-2 text-[13.5px] text-texto-2 sm:hidden">Página <b class="tabular-nums text-tinta">{{ pagina }}</b> de {{ paginas }}</span>
      <button type="button" class="botao-pagina" :disabled="pagina >= paginas || carregando" aria-label="Próxima página" @click="ir(pagina + 1)">
        <span class="hidden sm:inline">Próxima</span><ChevronRight :size="17" :stroke-width="2.2" aria-hidden="true" />
      </button>
    </div>
  </nav>
</template>

<style scoped>
.botao-pagina {
  display: inline-flex;
  min-width: 36px;
  height: 36px;
  align-items: center;
  justify-content: center;
  gap: 4px;
  border: 1px solid var(--borda-forte);
  border-radius: 10px;
  background: var(--folha);
  padding: 0 10px;
  color: var(--tinta);
  font: inherit;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: border-color 0.15s, background 0.15s, transform 0.12s var(--ease-saida);
}
.botao-pagina:hover:not(:disabled) {
  border-color: var(--acento);
  transform: translateY(-1px);
}
.botao-pagina:disabled {
  opacity: 0.45;
  cursor: default;
}
.botao-pagina.numero {
  padding: 0 6px;
  font-variant-numeric: tabular-nums;
}
.botao-pagina[aria-current='page'] {
  border-color: var(--acento);
  background: var(--acento);
  color: var(--sobre-acento);
}
.botao-pagina[aria-current='page']:disabled {
  opacity: 1;
}
</style>
