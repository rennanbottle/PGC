<script setup>
// Conquistas da parte "Você": ganhas (medalha cheia, com "Ganha") ou ainda não (anel com o progresso e 3/10).
// A conquista nova é comemorada uma vez: o guia aparece com o nome dela e a medalha pula. As já comemoradas ficam
// guardadas no navegador, por conta (localStorage dentro de try/catch: sem ele, a tela funciona igual e só não lembra).
import { Award, CalendarCheck, Check, CircleCheck, Crown, Flag, Flame, Layers, Mountain, Target, X } from '@lucide/vue'
import { conquistasNovas } from '#shared/regras/ranking.js'

const props = defineProps({
  lista: { type: Array, default: () => [] },
})

const ICONES = {
  primeiro_estudo: Flag, dez_estudos: Layers, cem_questoes: CircleCheck, mil_questoes: Mountain, sete_dias: Flame,
  trinta_dias: CalendarCheck, semana_afiada: Target, primeiro_dominado: Crown, nivel_5: Award,
}
// Uma lista por conta: na escola, o mesmo computador é usado por várias pessoas.
const usuario = useSupabaseUser()
const chave = () => `pgc-conquistas-vistas-${usuario.value?.sub ?? 'sem-conta'}`
const VOLTA = 2 * Math.PI * 21

const novas = ref([])
const fechada = ref(false)
const ganhas = computed(() => props.lista.filter((c) => c.ganha).length)
// Ganhas primeiro; entre as que faltam, a mais perto de sair vem antes.
const ordenadas = computed(() => [...props.lista].sort((a, b) =>
  Number(b.ganha) - Number(a.ganha) || (a.ganha ? 0 : b.atual / b.meta - a.atual / a.meta)))
// Até 3 nomes; com mais, os 2 primeiros e quantas faltam (a lista logo abaixo mostra todas).
const nomesNovas = computed(() => {
  const nomes = props.lista.filter((c) => novas.value.includes(c.id)).map((c) => c.nome)
  return nomes.length <= 3 ? `${nomes.join(', ')}.` : `${nomes.slice(0, 2).join(', ')} e mais ${nomes.length - 2}. Veja abaixo.`
})

function lerVistas() {
  try {
    const v = JSON.parse(localStorage.getItem(chave()) || '[]')
    return Array.isArray(v) ? v : []
  }
  catch {
    return []
  }
}
function avaliar() {
  const vistas = lerVistas()
  const agora = conquistasNovas(props.lista, vistas)
  if (!agora.length) return
  novas.value = [...new Set([...novas.value, ...agora])]
  fechada.value = false
  try {
    localStorage.setItem(chave(), JSON.stringify([...new Set([...vistas, ...agora])]))
  }
  catch {
    // Sem armazenamento: a comemoração volta na próxima visita, nada quebra.
  }
}
onMounted(() => {
  avaliar()
  watch(() => props.lista, avaliar)
})
</script>

<template>
  <section class="cartao" aria-labelledby="t-conquistas">
    <div class="flex items-baseline justify-between gap-3">
      <h2 id="t-conquistas" class="titulo-cartao m-0 flex items-center gap-2">
        <Award :size="18" :stroke-width="2.1" class="text-acento" aria-hidden="true" />
        Conquistas
      </h2>
      <span class="text-[13.5px] text-texto-3"><Fracao :valor="ganhas" :total="lista.length" /> ganhas</span>
    </div>

    <Transition name="abre">
      <div v-if="novas.length && !fechada" class="festa mt-4 flex items-center gap-3 rounded-[16px] bg-acento-suave py-2 pl-2 pr-3" role="status">
        <GuiaPersonagem humor="orgulhoso" :tamanho="58" class="shrink-0" />
        <p class="m-0 min-w-0 flex-1 text-[14.5px] leading-snug">
          <strong>{{ novas.length === 1 ? 'Conquista nova!' : `${novas.length} conquistas novas!` }}</strong>
          {{ nomesNovas }}
        </p>
        <button type="button" class="botao-icone pequeno shrink-0" data-dica="Fechar" data-dica-lado="baixo" aria-label="Fechar o aviso de conquista nova" @click="fechada = true">
          <X :size="16" :stroke-width="2.2" aria-hidden="true" />
        </button>
      </div>
    </Transition>

    <ul class="m-0 mt-5 grid list-none grid-cols-1 gap-x-6 gap-y-5 p-0 sm:grid-cols-2 lg:grid-cols-3">
      <li
        v-for="c in ordenadas"
        :key="c.id"
        class="conquista flex items-start gap-3"
        :class="{ ganha: c.ganha, nova: novas.includes(c.id) }"
      >
        <span class="medalha relative grid size-12 shrink-0 place-items-center" aria-hidden="true">
          <svg viewBox="0 0 48 48" class="absolute inset-0 size-12">
            <circle v-if="c.ganha" cx="24" cy="24" r="21" fill="var(--acento-suave)" />
            <circle cx="24" cy="24" r="21" fill="none" stroke="var(--folha-3)" stroke-width="3" />
            <circle
              v-if="c.atual > 0"
              class="anel"
              cx="24" cy="24" r="21" fill="none"
              :stroke="c.ganha ? 'var(--acento)' : 'var(--texto-3)'"
              stroke-width="3" stroke-linecap="round"
              :stroke-dasharray="`${(c.atual / c.meta) * VOLTA} ${VOLTA}`"
              transform="rotate(-90 24 24)"
            />
          </svg>
          <component :is="ICONES[c.id] ?? Award" :size="20" :stroke-width="2" class="relative" :class="c.ganha ? 'text-acento' : 'text-texto-3'" />
        </span>
        <div class="min-w-0">
          <p class="m-0 text-[14.5px] font-semibold" :class="!c.ganha && 'text-texto-2'">{{ c.nome }}</p>
          <p class="m-0 mt-0.5 text-[13px] leading-snug text-texto-3">{{ c.descricao }}</p>
          <p class="m-0 mt-1.5 text-[13px]">
            <span v-if="c.ganha" class="selo" data-tipo="ok"><Check :size="13" :stroke-width="2.4" aria-hidden="true" />Ganha</span>
            <span v-else class="text-texto-2"><Fracao :valor="c.atual" :total="c.meta" /></span>
          </p>
        </div>
      </li>
    </ul>
  </section>
</template>

<style scoped>
.anel {
  animation: desenha-anel 1s var(--ease-saida) 0.2s backwards;
}
@keyframes desenha-anel {
  from {
    stroke-dasharray: 0 132;
  }
}
.conquista.nova .medalha {
  animation: pop 0.6s var(--ease-mola) 0.5s backwards;
}
.conquista.nova .medalha::after {
  content: '';
  position: absolute;
  inset: -5px;
  border-radius: 999px;
  border: 2px solid var(--acento);
  opacity: 0;
  animation: onda 1.2s var(--ease-saida) 0.8s 2;
}
@keyframes onda {
  from {
    opacity: 0.7;
    transform: scale(0.85);
  }
  to {
    opacity: 0;
    transform: scale(1.35);
  }
}
@media (prefers-reduced-motion: reduce) {
  .anel,
  .conquista.nova .medalha,
  .conquista.nova .medalha::after {
    animation: none;
  }
}
:global(:root.menos-movimento) .anel,
:global(:root.menos-movimento) .conquista.nova .medalha,
:global(:root.menos-movimento) .conquista.nova .medalha::after {
  animation: none;
}
</style>
