<script setup>
// Parte "Geral" do Ranking: pontos da semana (desde segunda), do mês (desde o dia 1) ou desde o começo, só de quem
// escolheu participar, e só o apelido e os pontos. Pódio animado para os 3 primeiros, lista com a posição de cada
// um e a linha da pessoa presa embaixo quando ela está fora da lista. Quem não participa vê o lugar que teria e
// liga a participação ali mesmo (sem apelido, vai para o Perfil criar um). Fechado: mostra quanto falta.
import { Brain, CalendarDays, ChevronDown, Lock, Trophy, UserRound } from '@lucide/vue'
import { avaliarDesbloqueios } from '#shared/regras/desbloqueios.js'
import { PERIODOS, diaMes, minhaLinhaFora, periodoValido, podio, posicaoSe } from '#shared/regras/ranking.js'
import { diaDe, nomeDoMes } from '#shared/regras/historico.js'

const props = defineProps({
  perfil: { type: Object, default: null },
  estatisticas: { type: Object, required: true },
})
const emit = defineEmits(['ver-voce'])

const route = useRoute()
const supabase = useSupabaseClient()
const usuario = useSupabaseUser()
const { avisar } = useAvisos()

const periodo = ref(periodoValido(route.query.periodo))
const { data: dados, status, refresh } = useRankingGeral(periodo)
const ABAS_PERIODO = PERIODOS.map((p) => ({ valor: p.valor, texto: p.texto }))
const NESTE = { semana: 'nesta semana', mes: 'neste mês', geral: 'desde o começo' }
const POR_VEZ = 10

const fmt = (n) => Number(n ?? 0).toLocaleString('pt-BR')
const lista = computed(() => dados.value?.lista ?? [])
const participa = computed(() => !!(dados.value?.participa ?? props.perfil?.ranking_participa))
const temApelido = computed(() => !!props.perfil?.apelido)
const meusPontos = computed(() => Number(dados.value?.eu?.pontos ?? 0))

const desde = computed(() => {
  const dia = diaDe(dados.value?.inicio)
  if (periodo.value === 'semana') return dia ? `Desde segunda-feira, ${diaMes(dia)}` : 'Desde segunda-feira'
  if (periodo.value === 'mes') return dia ? `Desde 1º de ${nomeDoMes(dia)}` : 'Desde o dia 1'
  return 'Desde o começo'
})
const pessoas = computed(() => {
  const n = Number(dados.value?.participantes ?? 0)
  return `${n} ${n === 1 ? 'pessoa' : 'pessoas'} no ranking`
})

// Pódio só quando alguém fez pontos; sem pontos no período, a lista fica sozinha com um recado.
const comPodio = computed(() => lista.value.length > 0 && Number(lista.value[0]?.pontos) > 0)
const degraus = computed(() => (comPodio.value ? podio(lista.value) : []))
const noPodio = computed(() => (comPodio.value ? Math.min(3, lista.value.length) : 0))
const verTodos = ref(false)
const resto = computed(() => lista.value.slice(noPodio.value, verTodos.value ? undefined : noPodio.value + POR_VEZ))
const escondidos = computed(() => (verTodos.value ? 0 : Math.max(0, lista.value.length - noPodio.value - POR_VEZ)))
const minhaFora = computed(() => minhaLinhaFora(lista.value, dados.value?.eu, verTodos.value ? lista.value.length : noPodio.value + POR_VEZ))
const soVoce = computed(() => participa.value && lista.value.length === 1 && lista.value[0]?.eu)
const lugarSe = computed(() => posicaoSe(lista.value, meusPontos.value))

watch(periodo, () => {
  verTodos.value = false
})

const trava = computed(() => avaliarDesbloqueios(props.estatisticas).find((d) => d.id === 'ranking'))
const requisito = computed(() => trava.value?.requisitos?.[0] ?? { atual: 0, meta: 3 })

const salvando = ref(false)
async function participar(evento) {
  const ligar = evento.target.checked
  if (ligar && !temApelido.value) {
    evento.target.checked = false
    return navigateTo('/perfil#conta')
  }
  salvando.value = true
  const { error } = await supabase.from('perfis').update({ ranking_participa: ligar }).eq('id', usuario.value?.sub)
  salvando.value = false
  if (error) {
    evento.target.checked = !ligar
    avisar({ texto: 'Não deu para salvar. Confira a internet e tente de novo.', tipo: 'erro' })
    return
  }
  avisar({ texto: ligar ? 'Você entrou no ranking.' : 'Você saiu do ranking.', tipo: 'ok' })
  await Promise.all([refreshNuxtData('perfil'), refresh()])
}
</script>

<template>
  <div class="flex flex-col gap-5">
    <div class="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
      <RankingAbas v-model="periodo" pequena :abas="ABAS_PERIODO" rotulo="Período do ranking" id-base="periodo" class="w-full sm:w-[330px]" />
      <p class="m-0 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[13.5px] text-texto-3">
        <CalendarDays :size="15" :stroke-width="2" aria-hidden="true" />
        <span>{{ desde }}.</span>
        <span v-if="dados?.liberado">{{ pessoas }}.</span>
      </p>
    </div>

    <div :id="`periodo-painel-${periodo}`" role="tabpanel" :aria-labelledby="`periodo-aba-${periodo}`" class="flex flex-col gap-5">
      <div v-if="!dados && status !== 'error'" class="flex flex-col gap-5" aria-busy="true">
        <div class="esqueleto h-[300px] rounded-[20px]" />
        <div class="esqueleto h-[180px] rounded-[20px]" />
      </div>

      <div v-else-if="status === 'error'" class="cartao flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p class="m-0 text-[14.5px] text-erro">Não deu para carregar o ranking. Confira a internet e tente de novo.</p>
        <button type="button" class="botao-secundario botao-p" @click="refresh()">Tentar de novo</button>
      </div>

      <!-- Fechado: 3 estudos com 5 questões ou mais (a mesma regra do banco). -->
      <section v-else-if="!dados.liberado" class="cartao grid gap-5 sm:grid-cols-[auto_minmax(0,1fr)] sm:items-center sm:gap-7" aria-labelledby="t-fechado">
        <GuiaPersonagem humor="pensando" :tamanho="96" class="justify-self-center" />
        <div class="min-w-0">
          <h2 id="t-fechado" class="titulo-cartao m-0 flex items-center gap-2">
            <Lock :size="18" :stroke-width="2.1" class="text-texto-2" aria-hidden="true" />
            O ranking geral ainda está fechado
          </h2>
          <p class="m-0 mt-1.5 max-w-[520px] text-[14.5px] leading-normal text-texto-2">
            Ele abre depois de 3 estudos com 5 questões ou mais. Assim, todo mundo é comparado por estudos de verdade.
          </p>
          <div class="mt-4 max-w-[380px]">
            <div class="flex items-baseline justify-between gap-3 text-[13.5px]">
              <span class="text-texto-2">Estudos com 5 questões ou mais</span>
              <Fracao :valor="Math.min(requisito.atual, requisito.meta)" :total="requisito.meta" />
            </div>
            <div class="barra mt-2"><i :style="{ width: `${Math.min(100, (requisito.atual / requisito.meta) * 100)}%` }" /></div>
            <p class="m-0 mt-1.5 text-[13px] text-texto-3">
              {{ requisito.meta - Math.min(requisito.atual, requisito.meta) === 1 ? 'Falta 1 estudo.' : `Faltam ${requisito.meta - Math.min(requisito.atual, requisito.meta)} estudos.` }}
            </p>
          </div>
          <div class="mt-5 flex flex-wrap items-center gap-3">
            <NuxtLink to="/revisar/nova" class="botao">
              <Brain :size="18" :stroke-width="2" aria-hidden="true" />
              Começar um estudo
            </NuxtLink>
            <button type="button" class="botao-fantasma" @click="emit('ver-voce')">
              <UserRound :size="18" :stroke-width="2" aria-hidden="true" />
              Ver o seu desempenho
            </button>
          </div>
        </div>
      </section>

      <template v-else>
        <!-- Fora do ranking: o lugar que teria e a chave ali mesmo. -->
        <section v-if="!participa" class="cartao-destaque flex flex-col gap-4 sm:flex-row sm:items-center" aria-labelledby="t-participar">
          <GuiaPersonagem humor="acenando" :tamanho="72" class="shrink-0" />
          <div class="min-w-0 flex-1">
            <h2 id="t-participar" class="titulo-cartao m-0">Você ainda não aparece no ranking</h2>
            <p class="m-0 mt-1 text-[14.5px] leading-normal text-texto-2">
              <template v-if="meusPontos > 0">Com {{ fmt(meusPontos) }} pontos {{ NESTE[periodo] }}, você ficaria em {{ lugarSe }}º lugar. </template>
              <template v-if="temApelido">Os outros veem só o seu apelido, <strong class="text-tinta">{{ perfil.apelido }}</strong>, e os seus pontos.</template>
              <template v-else>Para participar, crie um apelido no Perfil. Só ele e os seus pontos aparecem para os outros.</template>
            </p>
          </div>
          <label v-if="temApelido" class="flex min-h-[44px] shrink-0 cursor-pointer items-center gap-3 font-semibold">
            <input type="checkbox" class="alternador" role="switch" :checked="false" :disabled="salvando" @change="participar">
            Participar
          </label>
          <NuxtLink v-else to="/perfil#conta" class="botao shrink-0">
            <UserRound :size="18" :stroke-width="2" aria-hidden="true" />
            Criar apelido
          </NuxtLink>
        </section>

        <section v-if="comPodio" class="cartao overflow-hidden !pb-0" aria-labelledby="t-podio">
          <h2 id="t-podio" class="titulo-cartao m-0 flex items-center gap-2">
            <Trophy :size="18" :stroke-width="2.1" class="text-energia" aria-hidden="true" />
            Pódio {{ periodo === 'semana' ? 'da semana' : periodo === 'mes' ? 'do mês' : 'geral' }}
          </h2>
          <RankingPodio
            :key="periodo"
            class="mx-auto mt-2"
            :class="degraus.length === 1 ? 'max-w-[190px]' : degraus.length === 2 ? 'max-w-[380px]' : 'max-w-[560px]'"
            :degraus="degraus"
          />
        </section>
        <p v-if="soVoce" class="painel m-0 flex items-center gap-3 text-[14px] text-texto-2">
          <GuiaPersonagem humor="acenando" :tamanho="44" class="shrink-0" />
          Só você está no ranking por enquanto. Quando colegas ligarem "Participar do ranking" no Perfil, eles aparecem aqui.
        </p>
        <p v-else-if="lista.length && !comPodio" class="painel m-0 flex items-center gap-3 text-[14px] text-texto-2">
          <GuiaPersonagem humor="dormindo" :tamanho="44" class="shrink-0" />
          Ninguém fez pontos {{ NESTE[periodo] }}. Um estudo já coloca você na frente.
        </p>

        <section v-if="resto.length || minhaFora" class="cartao overflow-hidden !p-0" aria-labelledby="t-lista">
          <h2 id="t-lista" class="titulo-cartao m-0 px-5 pb-1 pt-4">{{ comPodio ? 'Depois do pódio' : 'Posições' }}</h2>
          <TransitionGroup tag="ol" name="lista" class="m-0 list-none p-0">
            <li
              v-for="l in resto"
              :key="l.apelido"
              class="linha-ranking flex min-h-[52px] items-center gap-3 px-5 py-2"
              :class="l.eu && 'eu'"
              :aria-current="l.eu ? 'true' : undefined"
            >
              <span class="w-8 shrink-0 text-right font-titulo text-[17px] font-bold tabular-nums text-texto-2">{{ l.posicao }}º</span>
              <AvatarPerfil :nome="l.apelido" :tamanho="32" />
              <span class="min-w-0 flex-1 truncate text-[14.5px] font-semibold">{{ l.apelido }}</span>
              <span v-if="l.eu" class="selo" data-tipo="acento">Você</span>
              <span class="shrink-0 text-[14px] tabular-nums"><strong>{{ fmt(l.pontos) }}</strong> <span class="text-texto-3">pontos</span></span>
            </li>
          </TransitionGroup>
          <button v-if="escondidos" type="button" class="mostrar flex min-h-[44px] w-full items-center justify-center gap-2 border-t border-borda text-[14px] font-semibold text-acento" @click="verTodos = true">
            <ChevronDown :size="17" :stroke-width="2.1" aria-hidden="true" />
            Mostrar mais {{ escondidos }}
          </button>
          <div v-if="minhaFora" class="linha-ranking eu flex min-h-[52px] items-center gap-3 border-t border-borda px-5 py-2" aria-label="A sua posição">
            <span class="w-8 shrink-0 text-right font-titulo text-[17px] font-bold tabular-nums">{{ minhaFora.posicao }}º</span>
            <AvatarPerfil :nome="perfil?.apelido || 'Você'" :tamanho="32" />
            <span class="min-w-0 flex-1 truncate text-[14.5px] font-semibold">{{ perfil?.apelido || 'Você' }}</span>
            <span class="selo" data-tipo="acento">Você</span>
            <span class="shrink-0 text-[14px] tabular-nums"><strong>{{ fmt(minhaFora.pontos) }}</strong> <span class="text-texto-3">pontos</span></span>
          </div>
        </section>

        <Vazio v-if="!lista.length && participa" titulo="Ninguém no ranking ainda" texto="Quando você e os colegas fizerem pontos, as posições aparecem aqui." humor="dormindo" compacto />

        <div v-if="participa" class="flex flex-col gap-3 px-1 text-[13.5px] text-texto-3 sm:flex-row sm:items-center sm:justify-between">
          <p class="m-0">Você aparece como <strong class="text-texto-2">{{ perfil?.apelido }}</strong>. Só o apelido e os pontos ficam visíveis.</p>
          <label class="flex min-h-[40px] shrink-0 cursor-pointer items-center gap-2.5 font-semibold text-texto-2">
            <input type="checkbox" class="alternador" role="switch" :checked="true" :disabled="salvando" @change="participar">
            Participar do ranking
          </label>
        </div>
      </template>
    </div>
  </div>
</template>

<style scoped>
.linha-ranking + .linha-ranking {
  border-top: 1px solid var(--borda);
}
.linha-ranking.eu {
  background: var(--acento-suave);
}
.linha-ranking.eu > span:first-child {
  color: var(--acento);
}
.mostrar {
  transition: background-color 0.15s;
}
.mostrar:hover {
  background: var(--folha-2);
}
.mostrar:focus-visible {
  outline: 2px solid var(--acento);
  outline-offset: -2px;
}
</style>
