<script setup>
// Botão "Ver o gráfico" nas correções: aparece quando o enunciado tem uma função de 1º ou 2º grau
// ("f(x) = x² - 6x + 5") e a explicação ainda não traz o gráfico. Abre o desenho com raízes, vértice e eixo y.
// Uso: <GraficoDaQuestao :enunciado="q.enunciado" :explicacao="c.explicacao" />
import { ChartSpline } from '@lucide/vue'
import { acharFuncao } from '#shared/regras/grafico.js'

const props = defineProps({
  enunciado: { type: String, default: '' },
  explicacao: { type: String, default: '' },
})
const funcao = computed(() => (/```\s*grafico/.test(props.explicacao ?? '') ? null : acharFuncao(props.enunciado ?? '')))
const aberto = ref(false)
const id = useId()
</script>

<template>
  <div v-if="funcao" class="mt-3">
    <button type="button" class="botao-fantasma botao-p" :aria-expanded="aberto" :aria-controls="id" @click="aberto = !aberto">
      <ChartSpline :size="16" :stroke-width="2" aria-hidden="true" />{{ aberto ? 'Esconder o gráfico' : `Ver o gráfico de ${funcao.split('=')[0].trim()}` }}
    </button>
    <div v-if="aberto" :id="id" class="mt-2 max-w-[560px]">
      <GraficoFuncao :texto="funcao" />
    </div>
  </div>
</template>
