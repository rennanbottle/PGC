<script setup>
// Resumo da página "Gerar questões" (fixo ao lado no computador; numa folha que sobe de baixo no celular):
// quantas saem, de quê, a divisão por nível e por tipo, quem escreve e a cota, o tempo, uma amostra do tipo
// principal, os avisos e o botão principal. Tudo vem pronto da página em "r".
import { Check, CircleAlert, Clock3, Copy, FileText, Info, ListPlus, TriangleAlert } from '@lucide/vue'
import { textoNiveis } from '#shared/regras/gerar.js'

const props = defineProps({
  r: { type: Object, required: true },
  rotulo: { type: String, required: true },
  botao: { type: String, default: 'ia' }, // ia | local | copiar | salvar
  bloqueado: { type: Boolean, default: false },
  ocupado: { type: Boolean, default: false },
  copiado: { type: Boolean, default: false },
  naJanela: { type: Boolean, default: false },
})
const emit = defineEmits(['acao'])

const NIVEIS = [{ n: 1, nome: 'Fácil' }, { n: 2, nome: 'Normal' }, { n: 3, nome: 'Difícil' }]
const TOM_NIVEL = { 1: 'color-mix(in oklab, var(--acento) 32%, var(--folha))', 2: 'color-mix(in oklab, var(--acento) 62%, var(--folha))', 3: 'var(--acento)' }
// Tons para os tipos, do mais forte ao mais claro (a legenda diz o nome; a cor só agrupa).
const TONS_TIPO = ['var(--tinta)', 'var(--acento)', 'color-mix(in oklab, var(--acento) 55%, var(--folha))', 'color-mix(in oklab, var(--tinta) 45%, var(--folha))', 'color-mix(in oklab, var(--acento) 28%, var(--folha))', 'color-mix(in oklab, var(--tinta) 22%, var(--folha))']
const tom = (i) => TONS_TIPO[i % TONS_TIPO.length]
const somaNiv = computed(() => (props.r.niveis ? props.r.niveis[1] + props.r.niveis[2] + props.r.niveis[3] : 0))
const descNiveis = computed(() => (props.r.niveis ? `Por nível: ${textoNiveis(props.r.niveis)}.` : ''))
const descTipos = computed(() => `Por tipo: ${props.r.porTipo.map((t) => `${t.n} ${t.nome}`).join(', ')}.`)
const ICONE_AVISO = { erro: CircleAlert, aviso: TriangleAlert, info: Info }
const COR_AVISO = { erro: 'text-erro', aviso: 'text-aviso', info: 'text-texto-2' }
</script>

<template>
  <div class="resumo" :class="naJanela ? '' : 'cartao flex max-h-[calc(100dvh-48px)] flex-col overflow-hidden p-0'">
    <!-- O meio rola sozinho quando a tela é baixa; avisos e botão ficam sempre à vista. -->
    <div :class="naJanela ? '' : 'min-h-0 flex-1 overflow-y-auto overscroll-contain'">
    <!-- Quantas e de quê -->
    <div :class="naJanela ? 'pb-4' : 'p-5 pb-4'">
      <p class="m-0 text-[13.5px] font-medium text-texto-2">Vão sair</p>
      <p class="m-0 flex items-baseline gap-2">
        <span class="numero-grande tabular-nums"><NumeroAnimado :valor="r.total" /></span>
        <span class="text-[17px] font-semibold">{{ r.total === 1 ? 'questão' : 'questões' }}</span>
      </p>
      <p v-if="r.materia" class="m-0 mt-2 flex min-w-0 items-center gap-2 text-[14px]">
        <span class="size-2.5 shrink-0 rounded-full" :style="{ background: `${corMateria(r.materia.cor ?? 'cinza')}` }" aria-hidden="true" />
        <b class="shrink-0 font-semibold">{{ r.materia.nome }}</b>
        <span class="min-w-0 truncate text-texto-2">{{ r.assuntos }}</span>
      </p>
      <p class="m-0 mt-1.5 flex min-w-0 items-center gap-2 text-[13.5px] text-texto-2">
        <FileText :size="15" :stroke-width="2" class="shrink-0" aria-hidden="true" />
        <span class="truncate">{{ r.textos.length ? r.textos.join(', ') : 'Sem texto de base' }}</span>
      </p>
    </div>
    <hr class="divisoria">

    <!-- Divisão -->
    <div class="flex flex-col gap-4" :class="naJanela ? 'py-4' : 'p-5'">
      <div v-if="r.niveis && somaNiv">
        <p class="m-0 flex justify-between gap-3 text-[13px]"><b class="font-semibold">Por nível</b><span class="text-texto-2">{{ textoNiveis(r.niveis) }}</span></p>
        <div class="mt-2 flex h-2.5 gap-[2px] overflow-hidden rounded-full" role="img" :aria-label="descNiveis">
          <span v-for="x in NIVEIS" v-show="r.niveis[x.n] > 0" :key="x.n" class="parte rounded-[3px]" :style="{ flexGrow: r.niveis[x.n], background: TOM_NIVEL[x.n] }" />
        </div>
      </div>
      <div v-if="r.porTipo.length">
        <p class="m-0 flex justify-between gap-3 text-[13px]"><b class="font-semibold">Por tipo</b><span v-if="r.notaTipos" class="text-texto-2">{{ r.notaTipos }}</span></p>
        <div class="mt-2 flex h-2.5 gap-[2px] overflow-hidden rounded-full" role="img" :aria-label="descTipos">
          <span v-for="(t, i) in r.porTipo" :key="t.tipo" class="parte rounded-[3px]" :style="{ flexGrow: t.n, background: tom(i) }" />
        </div>
        <ul class="m-0 mt-2.5 flex list-none flex-col gap-1.5 p-0">
          <li v-for="(t, i) in r.porTipo" :key="t.tipo" class="flex min-w-0 items-center gap-2 text-[13px]">
            <span class="size-2 shrink-0 rounded-[2px]" :style="{ background: tom(i) }" aria-hidden="true" />
            <QuestoesIconeTipo :tipo="t.tipo" :tamanho="14" class="shrink-0 text-texto-2" />
            <span class="min-w-0 truncate">{{ t.nome }}</span>
            <b class="ml-auto shrink-0 tabular-nums">{{ t.n }}</b>
          </li>
        </ul>
      </div>
    </div>
    <hr class="divisoria">

    <!-- Quem escreve, cota e tempo -->
    <div class="flex flex-col gap-3 text-[14px]" :class="naJanela ? 'py-4' : 'p-5'">
      <div class="flex items-start gap-2.5">
        <component :is="r.autor.icone" :size="17" :stroke-width="2" class="mt-[2px] shrink-0 text-texto-2" aria-hidden="true" />
        <div class="min-w-0 flex-1">
          <p class="m-0 font-semibold">{{ r.autor.nome }}</p>
          <p v-if="r.autor.linha" class="m-0 text-[13.5px] text-texto-2">{{ r.autor.linha }}</p>
          <template v-if="r.autor.cota">
            <p class="m-0 mt-1 flex items-center justify-between gap-2 text-[13.5px] text-texto-2">
              <span>Cota de hoje</span>
              <span class="text-tinta"><Fracao :valor="r.autor.cota.depois" :total="r.autor.cota.limite" /></span>
            </p>
            <div class="barra fina mt-1.5" aria-hidden="true">
              <i :style="{ width: `${Math.min(100, (r.autor.cota.depois / r.autor.cota.limite) * 100)}%` }" />
            </div>
            <p class="m-0 mt-1 text-[12.5px] text-texto-3">{{ r.autor.cota.texto }}</p>
          </template>
        </div>
      </div>
      <div class="flex items-start gap-2.5">
        <Clock3 :size="17" :stroke-width="2" class="mt-[2px] shrink-0 text-texto-2" aria-hidden="true" />
        <p class="m-0 text-[13.5px]"><span class="font-semibold">Pronto {{ r.tempo.gerar === 'na hora' ? 'na hora' : r.tempo.gerar === 'depende da outra IA' ? 'quando a outra IA responder' : `em ${r.tempo.gerar}` }}.</span> <span class="text-texto-2">Estudar leva cerca de {{ r.tempo.estudarMin }} min.</span></p>
      </div>
    </div>

    <!-- Amostra do tipo principal -->
    <template v-if="r.exemplo">
      <hr class="divisoria">
      <details class="amostra group" :class="naJanela ? 'py-3' : 'px-5 py-3'">
        <summary class="flex cursor-pointer list-none items-center gap-2 py-1 text-[13.5px] font-semibold text-texto-2">
          <QuestoesIconeTipo :tipo="r.exemplo.tipo" :tamanho="15" />
          Como fica uma questão de {{ r.exemplo.nome.toLowerCase() }}
          <span class="ml-auto text-[12.5px] font-medium text-acento group-open:hidden">Ver</span>
        </summary>
        <div class="painel mt-2 text-[13.5px] leading-[1.5]">
          <TextoRico :texto="r.exemplo.enunciado" />
          <p class="m-0 mt-2 flex items-start gap-1.5 text-[13px] font-semibold text-ok">
            <Check :size="14" :stroke-width="2.6" class="mt-[2px] shrink-0" aria-hidden="true" />
            <span>{{ r.exemplo.resposta }}</span>
          </p>
          <p class="m-0 mt-1.5 text-[12px] text-texto-3">Exemplo de formato. As suas questões são sobre o que você escolheu.</p>
        </div>
      </details>
    </template>

    </div>

    <!-- Avisos e botão -->
    <div :class="naJanela ? 'pt-2' : 'border-t border-borda p-5 pt-4'">
      <TransitionGroup v-if="r.avisos.length" name="lista" tag="ul" class="m-0 mb-4 flex list-none flex-col gap-2 p-0">
        <li v-for="a in r.avisos" :key="a.texto" class="flex items-start gap-2 text-[13.5px] leading-[1.45]">
          <component :is="ICONE_AVISO[a.tipo]" :size="16" :stroke-width="2.1" class="mt-[2px] shrink-0" :class="COR_AVISO[a.tipo]" aria-hidden="true" />
          <span :class="a.tipo === 'erro' ? 'text-erro' : 'text-tinta'">{{ a.texto }}</span>
        </li>
      </TransitionGroup>

      <BotaoIa v-if="botao === 'ia'" class="w-full" tamanho="g" :carregando="ocupado" :desativado="bloqueado" @click="emit('acao')">{{ rotulo }}</BotaoIa>
      <button v-else type="button" class="botao botao-g w-full" :disabled="bloqueado || ocupado" :aria-busy="ocupado" @click="emit('acao')">
        <span v-if="ocupado" class="rodando" aria-hidden="true" />
        <Check v-else-if="botao === 'salvar' || copiado" :size="18" :stroke-width="2.5" aria-hidden="true" />
        <Copy v-else-if="botao === 'copiar'" :size="18" :stroke-width="2.2" aria-hidden="true" />
        <ListPlus v-else :size="18" :stroke-width="2.2" aria-hidden="true" />
        {{ rotulo }}
      </button>
      <p v-if="r.dica" class="m-0 mt-2.5 text-center text-[13px] text-texto-2">{{ r.dica }}</p>
    </div>
  </div>
</template>

<style scoped>
.parte {
  min-width: 6px;
  transition: flex-grow 0.4s var(--ease-saida);
}
.amostra summary::-webkit-details-marker {
  display: none;
}
@media (prefers-reduced-motion: reduce) {
  .parte {
    transition: none;
  }
}
</style>
