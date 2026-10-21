<script setup>
// Primeiros passos em versão curta: quantos já foram, a barra e os próximos dois, cada um dizendo o que libera.
// Some quando todos estão feitos. "Ver todos" abre a lista inteira.
import { Check, Circle, Footprints } from '@lucide/vue'

const props = defineProps({ passos: { type: Object, required: true } })
const todos = ref(false)
const visiveis = computed(() => (todos.value ? props.passos.itens : props.passos.itens.filter((i) => !i.feito).slice(0, 2)))
const largura = computed(() => `${Math.round((props.passos.feitos / Math.max(1, props.passos.total)) * 100)}%`)
</script>

<template>
  <section class="cartao" aria-labelledby="titulo-passos-inicio">
    <div class="flex items-center justify-between gap-3">
      <h2 id="titulo-passos-inicio" class="titulo-cartao m-0 flex items-center gap-2">
        <Footprints :size="18" :stroke-width="2" class="text-texto-2" aria-hidden="true" />
        <span>Primeiros passos</span>
      </h2>
      <span class="text-[14px] text-texto-2"><Fracao :valor="passos.feitos" :total="passos.total" /></span>
    </div>
    <div class="barra fina mt-3" aria-hidden="true"><i :style="{ width: largura }" /></div>
    <TransitionGroup name="lista" tag="ul" class="m-0 mt-2 flex list-none flex-col p-0">
      <li v-for="p in visiveis" :key="p.id" class="flex items-start gap-3 py-2.5">
        <span
          class="mt-0.5 grid size-6 shrink-0 place-items-center rounded-full"
          :class="p.feito ? 'bg-ok-suave text-ok' : p.id === passos.proximo?.id ? 'bg-acento-suave text-acento' : 'text-texto-3'"
          aria-hidden="true"
        >
          <Check v-if="p.feito" :size="14" :stroke-width="2.6" />
          <Circle v-else :size="12" :stroke-width="2.4" />
        </span>
        <span class="min-w-0 flex-1">
          <span class="block text-[14.5px]" :class="p.feito ? 'text-texto-2 line-through decoration-texto-3' : 'font-semibold'">
            {{ p.texto }}<span class="so-leitor">{{ p.feito ? ', feito' : p.id === passos.proximo?.id ? ', próximo passo' : '' }}</span>
          </span>
          <span v-if="!p.feito && p.libera" class="block text-[13px] text-texto-3">{{ p.libera }}</span>
        </span>
      </li>
    </TransitionGroup>
    <button type="button" class="link mt-1 text-[14px]" :aria-expanded="todos" @click="todos = !todos">
      {{ todos ? 'Mostrar só os próximos' : 'Ver todos' }}
    </button>
  </section>
</template>
