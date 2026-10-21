<script setup>
// Pilha de avisos no canto de baixo (no celular, acima da barra de baixo). Cada um tem ícone e texto (nunca só cor),
// some sozinho e pode ter uma ação. Leitores de tela ouvem o texto.
import { CircleAlert, CircleCheck, Info, X } from '@lucide/vue'

const { lista, fechar } = useAvisos()
const ICONES = { ok: CircleCheck, erro: CircleAlert, info: Info }
const CORES = { ok: 'text-ok', erro: 'text-erro', info: 'text-acento' }
function fazer(aviso) {
  aviso.acao?.fazer?.()
  fechar(aviso.id)
}
</script>

<template>
  <div class="pointer-events-none fixed bottom-[calc(84px+env(safe-area-inset-bottom))] right-4 z-[80] flex flex-col items-end gap-2.5 lg:bottom-6 lg:right-6" aria-live="polite" aria-atomic="false">
    <TransitionGroup name="avisos">
      <div v-for="a in lista" :key="a.id" class="aviso-flutuante" :role="a.tipo === 'erro' ? 'alert' : 'status'">
        <component :is="ICONES[a.tipo] ?? Info" :size="19" :stroke-width="2.2" class="mt-px shrink-0" :class="CORES[a.tipo]" aria-hidden="true" />
        <p class="m-0 min-w-0 flex-1 font-medium">{{ a.texto }}</p>
        <button v-if="a.acao" type="button" class="link shrink-0 text-[14px]" @click="fazer(a)">{{ a.acao.texto }}</button>
        <button type="button" class="botao-icone -my-1 -mr-1 size-7 shrink-0 rounded-lg" aria-label="Fechar o aviso" @click="fechar(a.id)">
          <X :size="15" :stroke-width="2.2" aria-hidden="true" />
        </button>
      </div>
    </TransitionGroup>
  </div>
</template>
