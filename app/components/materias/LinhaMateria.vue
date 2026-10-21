<script setup>
// Uma matéria na lista: marcador da cor, nome, área, assuntos, questões, barra de domínio e a situação de hoje.
// A linha inteira abre a matéria; o menu de três pontinhos fica por cima do link.
import { Check, Clock, FileQuestion, ListPlus } from '@lucide/vue'
import { assuntosAtivos, contarGrupos, nomeDaArea, situacaoDaMateria } from '#shared/regras/materias.js'
import { tempoRelativo } from '#shared/regras/tempo.js'

const props = defineProps({
  materia: { type: Object, required: true },
  numeros: { type: Object, default: () => ({}) },
  estados: { type: Object, default: () => ({}) },
  acoes: { type: Array, required: true },
})
defineEmits(['acao'])

const ativos = computed(() => assuntosAtivos(props.materia))
const grupos = computed(() => contarGrupos(ativos.value, props.estados))
const questoes = computed(() => props.numeros?.questoes ?? 0)
const situacao = computed(() => situacaoDaMateria({ assuntos: ativos.value.length, questoes: questoes.value, vencidas: props.numeros?.vencidas ?? 0 }))
const ICONE = { sem_assuntos: ListPlus, sem_questoes: FileQuestion, revisar: Clock, em_dia: Check }
const plural = (n, um, varios) => `${n} ${n === 1 ? um : varios}`
const arquivada = computed(() => !!props.materia.arquivada_em)
const iconeArea = computed(() => ICONES_AREA[props.materia.area] ?? ICONES_AREA.outra)
</script>

<template>
  <article class="linha group relative grid items-center gap-x-6 gap-y-3 px-4 py-4 sm:px-5" :aria-labelledby="`materia-${materia.id}`">
    <div class="flex min-w-0 items-center gap-3.5">
      <span class="marcador" :style="{ background: `${corMateria(materia.cor)}` }" aria-hidden="true" />
      <div class="min-w-0">
        <h3 :id="`materia-${materia.id}`" class="m-0 truncate font-titulo text-[18px] font-semibold leading-tight tracking-[-0.01em]">
          <NuxtLink :to="`/materias/${materia.id}`" class="link-linha">{{ materia.nome }}</NuxtLink>
        </h3>
        <p class="m-0 mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[13.5px] text-texto-2">
          <span class="inline-flex items-center gap-1.5">
            <component :is="iconeArea" :size="15" :stroke-width="2" aria-hidden="true" class="text-texto-3" />
            {{ nomeDaArea(materia.area) }}
          </span>
          <span>{{ plural(ativos.length, 'assunto', 'assuntos') }}</span>
          <span>{{ plural(questoes, 'questão', 'questões') }}</span>
        </p>
      </div>
    </div>

    <div v-if="arquivada" class="text-[13.5px] text-texto-3 sm:col-span-2">Arquivada {{ tempoRelativo(materia.arquivada_em) }}</div>
    <template v-else>
      <div class="dominio min-w-0">
        <MateriasBarraEstados :grupos="grupos" />
        <p class="m-0 mt-1.5 text-[12.5px] text-texto-3">
          <template v-if="ativos.length"><Fracao :valor="grupos.bem" :total="ativos.length" sem-animacao /> assuntos bem</template>
          <template v-else>Sem assuntos ainda</template>
        </p>
      </div>
      <div class="situacao">
        <span class="selo" :data-tipo="situacao.tipo || undefined">
          <component :is="ICONE[situacao.id]" :size="14" :stroke-width="2.2" aria-hidden="true" />
          {{ situacao.texto }}
        </span>
      </div>
    </template>

    <div class="menu relative z-[2] justify-self-end">
      <MenuAcoes :rotulo="`Ações de ${materia.nome}`" :itens="acoes" @escolher="$emit('acao', $event)" />
    </div>
  </article>
</template>

<style scoped>
.linha {
  grid-template-columns: minmax(0, 1fr) auto;
  grid-template-areas: 'nome menu' 'dominio situacao';
  transition: background-color 0.18s;
}
.linha > :first-child { grid-area: nome; }
.dominio { grid-area: dominio; }
.situacao { grid-area: situacao; justify-self: end; }
@media (min-width: 768px) {
  .situacao { justify-self: start; }
}
.menu { grid-area: menu; }
@media (min-width: 768px) {
  .linha {
    grid-template-columns: minmax(0, 1fr) minmax(150px, 210px) 150px auto;
    grid-template-areas: 'nome dominio situacao menu';
  }
}
.linha:hover {
  background: var(--folha-2);
}
.marcador {
  flex-shrink: 0;
  width: 6px;
  height: 40px;
  border-radius: 999px;
}
.link-linha {
  color: inherit;
  text-decoration: none;
}
.link-linha::after {
  content: '';
  position: absolute;
  inset: 0;
  z-index: 1;
}
.link-linha:focus-visible {
  outline: none;
}
.link-linha:focus-visible::after {
  outline: 2px solid var(--acento);
  outline-offset: -2px;
  border-radius: inherit;
}
.linha:hover .link-linha {
  color: var(--acento);
}
</style>
