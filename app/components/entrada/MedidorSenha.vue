<script setup>
// Força da senha: barra de 3 partes, nome escrito e requisitos com marcação (nunca só cor).
import { Check, Circle } from '@lucide/vue'
import { avaliarSenha } from '#shared/regras/senha.js'

const props = defineProps({
  senha: { type: String, default: '' },
  id: { type: String, default: 'requisitos-senha' },
})
const avaliacao = computed(() => avaliarSenha(props.senha))
const corBarra = computed(() => ['var(--borda)', 'var(--acento)', 'var(--marcador)', 'var(--ok)'][avaliacao.value.nivel])
</script>

<template>
  <div>
    <div class="mt-2.5 flex items-center gap-2.5">
      <div class="flex flex-1 gap-1" aria-hidden="true">
        <span
          v-for="i in 3"
          :key="i"
          class="h-1 flex-1 rounded-sm transition-colors duration-300"
          :style="{ background: avaliacao.nivel >= i ? corBarra : 'var(--borda)' }"
        />
      </div>
      <span class="min-w-[78px] text-right text-[12.5px] font-semibold text-texto-2" aria-live="polite">{{ avaliacao.nome }}</span>
    </div>
    <ul :id="id" class="mt-2 flex list-none flex-wrap gap-x-3.5 gap-y-1 p-0 text-[13px]">
      <li
        v-for="r in avaliacao.requisitos"
        :key="r.id"
        class="flex items-center gap-[5px] transition-colors"
        :class="r.ok ? 'text-ok' : 'text-texto-2'"
      >
        <Check v-if="r.ok" :size="14" :stroke-width="2.6" aria-hidden="true" />
        <Circle v-else :size="11" :stroke-width="2" aria-hidden="true" />
        <span>{{ r.texto }}<span class="so-leitor">: {{ r.ok ? 'atendido' : 'falta' }}</span></span>
      </li>
    </ul>
  </div>
</template>
