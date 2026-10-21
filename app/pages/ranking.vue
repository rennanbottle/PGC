<script setup>
// Ranking: a parte "Você" (o desempenho da própria pessoa, que era a tela Desempenho) e a parte "Geral" (pontos de
// quem escolheu participar, só pelo apelido). Endereço: /ranking?aba=voce|geral (o /desempenho vem para cá).
// Trava da tela: 3 estudos concluídos (regra "desempenho"). A parte Geral tem a própria trava, que vem do banco
// (ranking_periodo devolve "liberado": 3 estudos com 5 questões ou mais).
import { Trophy, UserRound } from '@lucide/vue'
import { avaliarDesbloqueios } from '#shared/regras/desbloqueios.js'
import { conquistas } from '#shared/regras/ranking.js'

useHead({ title: 'Ranking | PGC' })

const route = useRoute()
const estatisticas = useEstatisticas()
const { data: estudo, status: statusEstudo } = useResumoEstudo()
const { data: desempenho, status: statusDesempenho, error: erroDesempenho, refresh } = useDesempenho()
const { data: perfil } = usePerfil()

const trava = computed(() => avaliarDesbloqueios(estatisticas.value).find((d) => d.id === 'desempenho'))
const esperando = computed(() => ['idle', 'pending'].includes(statusEstudo.value))
const desempenhoPronto = computed(() => statusDesempenho.value === 'success' || (desempenho.value?.semanas?.length ?? 0) > 0)

const ABAS = [
  { valor: 'voce', texto: 'Você', icone: UserRound, guia: 'ranking-voce' },
  { valor: 'geral', texto: 'Geral', icone: Trophy, guia: 'ranking-geral' },
]
const aba = ref(route.query.aba === 'geral' ? 'geral' : 'voce')
watch(aba, (v) => {
  if (route.query.aba !== v) navigateTo({ query: { ...route.query, aba: v } }, { replace: true })
})
watch(() => route.query.aba, (v) => {
  if (v === 'voce' || v === 'geral') aba.value = v
})

const listaConquistas = computed(() => conquistas(desempenho.value, estudo.value))
</script>

<template>
  <div class="mx-auto w-full max-w-[1120px]">
    <div v-if="esperando" class="flex flex-col gap-5" aria-busy="true">
      <div class="esqueleto h-[64px] max-w-[420px] rounded-[16px]" />
      <div class="esqueleto h-[280px] rounded-[20px]" />
    </div>

    <TelaBloqueada
      v-else-if="trava && !trava.liberado"
      nome="Ranking"
      resumo="Seu desempenho ao longo do tempo e, se quiser, a comparação com colegas pelo apelido."
      :requisitos="trava.requisitos"
    />

    <template v-else>
      <CabecalhoPagina titulo="Ranking" descricao="Como você está indo e, se quiser, como está entre os colegas.">
        <template #acoes>
          <RankingAbas v-model="aba" :abas="ABAS" rotulo="Partes do ranking" id-base="ranking" class="w-full sm:w-[272px]" />
        </template>
      </CabecalhoPagina>

      <Transition name="desliza" mode="out-in">
        <div :id="`ranking-painel-${aba}`" :key="aba" role="tabpanel" :aria-labelledby="`ranking-aba-${aba}`" class="mt-6">
          <template v-if="aba === 'voce'">
            <div v-if="erroDesempenho" class="cartao flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p class="m-0 text-[14.5px] text-erro">Não deu para carregar os seus números. Confira a internet e tente de novo.</p>
              <button type="button" class="botao-secundario botao-p" @click="refresh()">Tentar de novo</button>
            </div>
            <div v-else-if="!desempenhoPronto" class="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)]" aria-busy="true">
              <div class="esqueleto h-[260px] rounded-[20px]" />
              <div class="esqueleto h-[260px] rounded-[20px]" />
            </div>
            <RankingVoce v-else :desempenho="desempenho" :estudo="estudo" :conquistas="listaConquistas" />
          </template>
          <RankingGeral v-else :perfil="perfil" :estatisticas="estatisticas" @ver-voce="aba = 'voce'" />
        </div>
      </Transition>
    </template>
  </div>
</template>
