<script setup>
// Caminho da matéria: assuntos, textos (opcional), questões e estudar. Cada passo mostra o estado real
// (feito, próximo, depois) e a ação dele. Só o próximo passo ganha o botão principal.
import { Brain, Check, FileText, ListTree, Plus, Sparkles } from '@lucide/vue'
import { MINIMO_ESTUDO, faltaParaEstudar } from '#shared/regras/materias.js'

const props = defineProps({
  materiaId: { type: String, required: true },
  passos: { type: Array, required: true },
  numeros: { type: Object, required: true },
  // Há sugestões do catálogo logo abaixo: o passo "assuntos" só aponta para elas.
  comSugestoes: { type: Boolean, default: false },
})
defineEmits(['adicionar-assunto'])

const ICONES = { assuntos: ListTree, textos: FileText, questoes: Sparkles, estudar: Brain }
const NOMES = { assuntos: 'Assuntos', textos: 'Textos', questoes: 'Questões', estudar: 'Estudar' }
const estado = (id) => props.passos.find((p) => p.id === id)?.estado
const plural = (n, um, varios) => `${n} ${n === 1 ? um : varios}`
const falta = computed(() => faltaParaEstudar(props.numeros.noBanco))
const DESCRICAO = { feito: 'Feito', agora: 'Próximo passo', depois: 'Depois', opcional: 'Opcional' }
</script>

<template>
  <ol class="caminho m-0 list-none p-0" aria-label="Caminho da matéria">
    <li v-for="(p, i) in passos" :key="p.id" class="passo" :data-estado="p.estado" :style="{ '--i': i }" :data-guia="p.id === 'questoes' ? 'materia-questoes' : p.id === 'estudar' ? 'materia-estudar' : undefined">
      <span class="bola" aria-hidden="true">
        <Check v-if="p.estado === 'feito'" :size="18" :stroke-width="2.6" />
        <component :is="ICONES[p.id]" v-else :size="18" :stroke-width="2.1" />
      </span>
      <div class="min-w-0">
        <h3 class="m-0 flex items-center gap-2 text-[15px] font-bold">
          {{ NOMES[p.id] }}
          <span class="so-leitor">: {{ DESCRICAO[p.estado] }}</span>
          <span v-if="p.estado === 'opcional'" class="selo h-[21px] px-[7px] text-[11.5px]">opcional</span>
        </h3>

        <!-- Assuntos -->
        <template v-if="p.id === 'assuntos'">
          <p class="texto">{{ numeros.assuntos ? plural(numeros.assuntos, 'assunto', 'assuntos') : comSugestoes ? 'Escolha abaixo os assuntos que você vai estudar.' : 'Adicione as partes da matéria.' }}</p>
          <button v-if="!numeros.assuntos && !comSugestoes" type="button" class="botao botao-p mt-2.5" @click="$emit('adicionar-assunto')">
            <Plus :size="16" :stroke-width="2.2" aria-hidden="true" />Adicionar assunto
          </button>
        </template>

        <!-- Textos -->
        <template v-else-if="p.id === 'textos'">
          <p class="texto">{{ numeros.textos ? plural(numeros.textos, 'texto', 'textos') : 'As questões podem sair só do assunto.' }}</p>
          <NuxtLink :to="`/materiais?adicionar=1&materia=${materiaId}`" class="botao-fantasma botao-p mt-1.5 -ml-2.5">
            <Plus :size="16" :stroke-width="2.2" aria-hidden="true" />Adicionar texto
          </NuxtLink>
        </template>

        <!-- Questões -->
        <template v-else-if="p.id === 'questoes'">
          <p class="texto">
            <template v-if="p.estado === 'depois'">Depois dos assuntos.</template>
            <template v-else-if="numeros.noBanco >= MINIMO_ESTUDO">{{ plural(numeros.noBanco, 'questão', 'questões') }} no banco</template>
            <template v-else><Fracao :valor="numeros.noBanco" :total="MINIMO_ESTUDO" /> no banco para estudar</template>
          </p>
          <BotaoIa v-if="p.estado === 'agora'" tamanho="p" class="mt-2.5" @click="navigateTo(`/questoes/gerar?materia=${materiaId}`)">Gerar questões</BotaoIa>
          <NuxtLink v-else-if="p.estado === 'feito'" :to="`/questoes/gerar?materia=${materiaId}`" class="botao-fantasma botao-p mt-1.5 -ml-2.5">
            <Sparkles :size="16" :stroke-width="2.1" aria-hidden="true" />Gerar mais
          </NuxtLink>
        </template>

        <!-- Estudar -->
        <template v-else>
          <p :id="`falta-estudar-${materiaId}`" class="texto">{{ falta || 'Tudo pronto para estudar.' }}</p>
          <NuxtLink v-if="!falta" :to="`/revisar/nova?materia=${materiaId}`" class="botao botao-p mt-2.5">
            <Brain :size="16" :stroke-width="2.1" aria-hidden="true" />Estudar esta matéria
          </NuxtLink>
          <button v-else type="button" class="botao-secundario botao-p mt-2.5" disabled :aria-describedby="`falta-estudar-${materiaId}`">
            <Brain :size="16" :stroke-width="2.1" aria-hidden="true" />Estudar esta matéria
          </button>
        </template>
      </div>
    </li>
  </ol>
</template>

<style scoped>
.caminho {
  display: grid;
  gap: 18px;
}
.passo {
  position: relative;
  display: grid;
  grid-template-columns: 36px minmax(0, 1fr);
  align-content: start;
  align-items: start;
  gap: 12px;
  animation: entra 0.45s var(--ease-saida) backwards;
  animation-delay: calc(120ms + var(--i) * 70ms);
}
/* Linha que liga os passos: vertical no celular (depois de cada passo), horizontal no computador. */
.passo:not(:last-child)::after {
  content: '';
  position: absolute;
  top: 42px;
  bottom: -14px;
  left: 17px;
  width: 2px;
  border-radius: 2px;
  background: var(--borda-forte);
}
.passo[data-estado='feito']:not(:last-child)::after {
  background: var(--ok-vivo);
}
.bola {
  display: grid;
  place-items: center;
  width: 36px;
  height: 36px;
  border-radius: 50%;
  border: 1.5px solid var(--borda-forte);
  background: var(--folha);
  color: var(--texto-3);
}
.passo[data-estado='feito'] .bola {
  border-color: var(--ok-vivo);
  background: var(--ok-vivo);
  color: var(--folha);
}
.passo[data-estado='agora'] .bola {
  border-color: var(--acento);
  background: var(--acento);
  color: var(--sobre-botao);
  animation: pulso 1.6s ease-out 0.6s 2;
}
.texto {
  margin: 3px 0 0;
  font-size: 14px;
  line-height: 1.45;
  color: var(--texto-2);
}
.passo[data-estado='depois'] h3 {
  color: var(--texto-2);
}
@media (min-width: 900px) {
  .caminho {
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 20px;
  }
  .passo {
    grid-template-columns: minmax(0, 1fr);
    gap: 12px;
  }
  .passo:not(:last-child)::after {
    display: none;
  }
  .passo + .passo::before {
    content: '';
    position: absolute;
    top: 17px;
    left: calc(-100% - 20px + 46px);
    width: calc(100% + 20px - 56px);
    height: 2px;
    border-radius: 2px;
    background: var(--borda-forte);
  }
  .passo[data-estado='feito'] + .passo::before {
    background: var(--ok-vivo);
  }
}
@media (prefers-reduced-motion: reduce) {
  .passo, .passo[data-estado='agora'] .bola { animation: none; }
}
:global(:root.menos-movimento) .passo,
:global(:root.menos-movimento) .passo[data-estado='agora'] .bola {
  animation: none;
}
</style>
