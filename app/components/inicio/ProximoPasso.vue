<script setup>
// O cartão principal do Início: uma ação só, a mais útil agora (regra em shared/regras/inicio.js).
// Continuar o estudo pausado, revisar as questões vencidas, a prova de domínio de um assunto pronto, o próximo
// primeiro passo, a meta do dia ou "tudo feito".
import { BookOpen, Brain, ClipboardCheck, Footprints, Play, RotateCcw, Sparkles, Target, Trophy } from '@lucide/vue'
import { tempoRelativo } from '#shared/regras/tempo.js'
import { duracao } from '#shared/regras/provas.js'

const props = defineProps({
  passo: { type: Object, required: true },
  passos: { type: Object, default: null },
})

const ICONE_PASSO = { materia: BookOpen, questoes: Sparkles, estudo: Brain, tres_estudos: Brain }

const c = computed(() => {
  const p = props.passo
  if (p.tipo === 'prova') {
    const restante = Math.max(0, Math.round((new Date(p.prova.termina_em).getTime() - Date.now()) / 1000))
    return {
      humor: 'encorajador',
      icone: ClipboardCheck,
      rotulo: 'Prova em andamento',
      titulo: p.prova.titulo,
      texto: restante > 0 ? `Faltam ${duracao(restante)} no relógio, que continua correndo.` : 'O tempo acabou. Ela é entregue com o que estava marcado.',
      acao: { texto: restante > 0 ? 'Continuar a prova' : 'Ver a nota', para: `/prova/${p.prova.id}`, icone: Play },
    }
  }
  if (p.tipo === 'continuar') {
    const e = p.estudo
    const quando = e.pausada_em ?? e.atualizado_em
    return {
      humor: 'normal',
      icone: Play,
      rotulo: 'Continue de onde parou',
      titulo: e.titulo,
      progresso: { valor: e.respondidas ?? 0, total: e.total ?? 0 },
      nota: quando ? `${e.status === 'pausada' ? 'Pausado' : 'Começou'} ${tempoRelativo(quando)}` : '',
      acao: { texto: 'Continuar o estudo', para: `/revisar/${e.id}`, icone: Play },
      extra: { texto: 'Ver os estudos', para: '/revisar' },
    }
  }
  if (p.tipo === 'revisar') {
    const n = p.vencidas
    return {
      humor: 'pensando',
      icone: RotateCcw,
      rotulo: 'Revisão do dia',
      titulo: `${n} ${n === 1 ? 'questão espera' : 'questões esperam'} por você`,
      texto: 'Revisar no dia certo faz a matéria ficar na memória. Leva poucos minutos.',
      acao: { texto: 'Revisar agora', para: '/revisar', icone: Brain },
    }
  }
  if (p.tipo === 'dominio') {
    const mais = p.total - 1
    return {
      humor: 'empolgado',
      icone: Target,
      rotulo: 'Prova de domínio',
      titulo: `${p.assunto.nome} está pronto para a prova de domínio`,
      texto: `Passando, o assunto fica Dominado.${mais > 0 ? ` Mais ${mais} ${mais === 1 ? 'assunto está pronto' : 'assuntos estão prontos'} também.` : ''}`,
      acao: { texto: 'Ver a prova de domínio', para: `/assuntos/${p.assunto.id}`, icone: Target },
    }
  }
  if (p.tipo === 'passo') {
    const s = p.passo
    return {
      humor: 'acenando',
      icone: Footprints,
      rotulo: 'Próximo passo',
      titulo: s.texto,
      texto: s.libera,
      passos: props.passos ? { feitos: props.passos.feitos, total: props.passos.total } : null,
      acao: { texto: s.acao.texto, para: s.acao.caminho, icone: ICONE_PASSO[s.id] ?? Footprints },
      extra: s.acaoExtra ? { texto: s.acaoExtra.texto, para: s.acaoExtra.caminho } : null,
    }
  }
  if (p.tipo === 'meta') {
    return {
      humor: 'feliz',
      icone: Target,
      rotulo: 'Meta de hoje',
      titulo: `Faltam ${p.faltam} ${p.faltam === 1 ? 'questão' : 'questões'} para a meta`,
      texto: 'Um estudo curto já resolve.',
      acao: { texto: 'Estudar agora', para: '/revisar/nova', icone: Brain },
    }
  }
  return {
    humor: 'comemorando',
    icone: Trophy,
    rotulo: 'Meta de hoje',
    titulo: 'Meta batida. Bom trabalho.',
    texto: 'Quer ver como está indo? O ranking mostra a sua evolução.',
    acao: { texto: 'Ver o meu desempenho', para: '/ranking?aba=voce', icone: Trophy },
    extra: { texto: 'Planejar a semana', para: '/agenda' },
  }
})
const largura = computed(() => (c.value.progresso?.total ? `${Math.round((c.value.progresso.valor / c.value.progresso.total) * 100)}%` : '0%'))
</script>

<template>
  <section class="cartao-destaque relative" data-guia="inicio-proximo" aria-labelledby="titulo-proximo">
    <div class="flex items-start gap-6">
      <div class="min-w-0 flex-1">
        <p class="m-0 flex items-center gap-2 text-[14px] font-semibold text-acento">
          <component :is="c.icone" :size="17" :stroke-width="2.1" aria-hidden="true" />
          <span>{{ c.rotulo }}</span>
          <span v-if="c.passos" class="ml-1 font-medium text-texto-2"><Fracao :valor="c.passos.feitos" :total="c.passos.total" /></span>
        </p>
        <h2 id="titulo-proximo" class="m-0 mt-2.5 font-titulo text-[26px] font-semibold leading-[1.12] tracking-[-0.015em] sm:text-[31px]">{{ c.titulo }}</h2>
        <p v-if="c.texto" class="m-0 mt-2 max-w-[520px] text-[15px] leading-normal text-texto-2">{{ c.texto }}</p>

        <div v-if="c.progresso" class="mt-4 max-w-[380px]">
          <div class="flex items-baseline justify-between gap-3 text-[14px]">
            <span class="text-texto-2">Respondidas</span>
            <Fracao :valor="c.progresso.valor" :total="c.progresso.total" />
          </div>
          <div class="barra mt-1.5" aria-hidden="true"><i :style="{ width: largura }" /></div>
          <p v-if="c.nota" class="m-0 mt-1.5 text-[13px] text-texto-3">{{ c.nota }}</p>
        </div>

        <div class="mt-5 flex flex-wrap items-center gap-x-5 gap-y-3">
          <NuxtLink :to="c.acao.para" class="botao botao-g">
            <component :is="c.acao.icone" :size="19" :stroke-width="2.1" aria-hidden="true" />
            <span>{{ c.acao.texto }}</span>
          </NuxtLink>
          <NuxtLink v-if="c.extra" :to="c.extra.para" class="link text-[15px]">{{ c.extra.texto }}</NuxtLink>
        </div>
      </div>
      <GuiaPersonagem :humor="c.humor" :tamanho="100" class="mt-1 hidden shrink-0 sm:block" />
    </div>
  </section>
</template>
