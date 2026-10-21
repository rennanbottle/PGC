<script setup>
// "Como ficam": quantas, estilo da prova, nível (um só ou misturado) e os tipos numa lista só.
// Sem IA, os tipos são os jeitos de tirar questões do texto (com quantas cada um dá) e o nível vem do texto.
import { Minus, Plus } from '@lucide/vue'
import { DESCRICAO_TIPO, ESTILO, ESTILOS, QUANTIDADES_RAPIDAS, TIPOS_GERAR, distribuir } from '#shared/regras/gerar.js'
import { nomeDoTipo } from '#shared/regras/questoes.js'

const props = defineProps({
  estado: { type: Object, required: true },
  modo: { type: String, required: true },
  maximo: { type: Number, required: true },
  tecnicas: { type: Array, default: null },
  carregando: { type: Boolean, default: false },
})
const emit = defineEmits(['tocou-tipos'])
const id = useId()
const semIa = computed(() => props.modo === 'local')

// ---------- Quantas ----------
const outro = ref(!QUANTIDADES_RAPIDAS.includes(props.estado.quantidade))
function escolherQuantidade(n) {
  outro.value = false
  props.estado.quantidade = n
}
function digitarQuantidade(v) {
  const n = Math.floor(Number(v))
  if (Number.isFinite(n) && n >= 1) props.estado.quantidade = Math.min(props.maximo, n)
}

// ---------- Nível ----------
const NIVEIS = [{ n: 1, nome: 'Fácil' }, { n: 2, nome: 'Normal' }, { n: 3, nome: 'Difícil' }]
const misturado = computed(() => props.estado.dificuldade.modo === 'distribuir')
const soma = computed(() => [1, 2, 3].reduce((s, n) => s + (props.estado.dificuldade.contas[n] ?? 0), 0))
function escolherNivel(n) {
  props.estado.dificuldade.modo = 'uma'
  props.estado.dificuldade.nivel = n
}
function misturar() {
  props.estado.dificuldade.modo = 'distribuir'
  const [a, b, c] = distribuir(props.estado.quantidade, [20, 50, 30])
  props.estado.dificuldade.contas = { 1: a, 2: b, 3: c }
}
watch(() => props.estado.quantidade, (q) => {
  if (!misturado.value || soma.value === q) return
  const atuais = [1, 2, 3].map((n) => props.estado.dificuldade.contas[n] ?? 0)
  const [a, b, c] = distribuir(q, atuais.some((x) => x > 0) ? atuais : [20, 50, 30])
  props.estado.dificuldade.contas = { 1: a, 2: b, 3: c }
})
// Mudar uma conta muda o total (dentro do máximo do jeito escolhido).
function mudarConta(n, passo) {
  const novas = { ...props.estado.dificuldade.contas, [n]: Math.max(0, (props.estado.dificuldade.contas[n] ?? 0) + passo) }
  const total = novas[1] + novas[2] + novas[3]
  if (total < 1 || total > props.maximo) return
  props.estado.dificuldade.contas = novas
  props.estado.quantidade = total
  outro.value = !QUANTIDADES_RAPIDAS.includes(total)
}
const TOM = { 1: 'color-mix(in oklab, var(--acento) 32%, var(--folha))', 2: 'color-mix(in oklab, var(--acento) 62%, var(--folha))', 3: 'var(--acento)' }

// ---------- Estilo ----------
const opcoesEstilo = ESTILOS.map((e) => ({ valor: e.id, texto: e.nome, descricao: e.descricao }))
watch(() => props.estado.estilo, (e) => {
  if (ESTILO[e]?.tipos) {
    props.estado.tipos = [...ESTILO[e].tipos]
    emit('tocou-tipos')
  }
})

// ---------- Tipos ----------
const DESCRICAO_TECNICA = {
  lacuna: 'Frases do texto com o termo-chave escondido.',
  cartao: 'Termo na frente, definição no verso.',
  numerica: 'Contas novas com as fórmulas do texto.',
  associar: 'Ligar cada termo à sua definição.',
  ordenar: 'Passos de uma lista, na ordem certa.',
  classificar: 'Separar itens nos grupos do texto.',
  cronologia: 'Acontecimentos com ano, em ordem.',
}
function alternar(lista, valor) {
  const i = lista.indexOf(valor)
  if (i >= 0) lista.splice(i, 1)
  else lista.push(valor)
}
function alternarTipo(t) {
  alternar(props.estado.tipos, t)
  emit('tocou-tipos')
}
const marcados = computed(() => (semIa.value ? props.estado.tecnicas.length : props.estado.tipos.length))
</script>

<template>
  <div class="flex flex-col gap-6">
    <div class="grid gap-x-8 gap-y-6 md:grid-cols-[auto_minmax(0,320px)]">
      <!-- Quantas -->
      <div role="group" :aria-labelledby="`${id}-q`">
        <p :id="`${id}-q`" class="rotulo">Quantas questões</p>
        <div class="flex flex-wrap items-center gap-2">
          <button
            v-for="n in QUANTIDADES_RAPIDAS"
            :key="n"
            type="button"
            class="pilula min-w-[52px] tabular-nums disabled:cursor-not-allowed disabled:opacity-45"
            :aria-pressed="!outro && estado.quantidade === n"
            :disabled="n > maximo"
            @click="escolherQuantidade(n)"
          >
            {{ n }}
          </button>
          <button type="button" class="pilula" :aria-pressed="outro" @click="outro = true">Outro</button>
          <Transition name="desliza">
            <span v-if="outro" class="flex items-center gap-2">
              <label class="sr-only" :for="`${id}-n`">Número de questões</label>
              <input
                :id="`${id}-n`"
                class="campo campo-p w-[76px] text-center tabular-nums"
                type="number"
                inputmode="numeric"
                min="1"
                :max="maximo"
                :value="estado.quantidade"
                @input="digitarQuantidade($event.target.value)"
              >
            </span>
          </Transition>
        </div>
        <p class="ajuda">
          <template v-if="modo === 'ia' || modo === 'misto'">A IA do PGC escreve até 20, em lotes de 10.</template>
          <template v-else-if="semIa">O texto decide quantas dá; o PGC pega até esse número.</template>
          <template v-else>Até {{ maximo }} por pedido.</template>
        </p>
      </div>

      <!-- Estilo -->
      <div v-if="!semIa" class="min-w-0">
        <label class="rotulo" :for="`${id}-estilo`">Estilo</label>
        <Selecao :id="`${id}-estilo`" v-model="estado.estilo" :opcoes="opcoesEstilo" :descrito="`${id}-estilo-ajuda`" />
        <p :id="`${id}-estilo-ajuda`" class="ajuda">{{ ESTILO[estado.estilo]?.descricao }}</p>
      </div>
    </div>

    <!-- Nível -->
    <div v-if="!semIa" role="group" :aria-labelledby="`${id}-nivel`">
      <p :id="`${id}-nivel`" class="rotulo">Nível</p>
      <div class="flex flex-wrap gap-2">
        <button v-for="x in NIVEIS" :key="x.n" type="button" class="pilula" :aria-pressed="!misturado && estado.dificuldade.nivel === x.n" @click="escolherNivel(x.n)">{{ x.nome }}</button>
        <button type="button" class="pilula" :aria-pressed="misturado" @click="misturar">Misturar</button>
      </div>
      <Transition name="abre">
        <div v-if="misturado">
          <div class="painel mt-3 max-w-[520px]">
            <div class="flex h-2.5 gap-[2px] overflow-hidden rounded-full" aria-hidden="true">
              <span v-for="x in NIVEIS" v-show="estado.dificuldade.contas[x.n] > 0" :key="x.n" class="faixa rounded-[3px]" :style="{ flexGrow: estado.dificuldade.contas[x.n], background: TOM[x.n] }" />
            </div>
            <div class="mt-3 grid grid-cols-3 gap-2">
              <div v-for="x in NIVEIS" :key="x.n" class="flex flex-col items-center gap-1.5">
                <span class="flex items-center gap-1.5 text-[13px] font-semibold text-texto-2">
                  <span class="size-2.5 rounded-[3px]" :style="{ background: TOM[x.n] }" aria-hidden="true" />{{ x.nome }}
                </span>
                <span class="flex items-center gap-1">
                  <button type="button" class="botao-icone pequeno" :aria-label="`Menos questões ${x.nome.toLowerCase()}`" :disabled="!estado.dificuldade.contas[x.n] || soma <= 1" @click="mudarConta(x.n, -1)">
                    <Minus :size="15" :stroke-width="2.4" aria-hidden="true" />
                  </button>
                  <b class="w-7 text-center font-titulo text-[19px] tabular-nums" aria-live="polite">{{ estado.dificuldade.contas[x.n] }}</b>
                  <button type="button" class="botao-icone pequeno" :aria-label="`Mais questões ${x.nome.toLowerCase()}`" :disabled="soma >= maximo" @click="mudarConta(x.n, 1)">
                    <Plus :size="15" :stroke-width="2.4" aria-hidden="true" />
                  </button>
                </span>
              </div>
            </div>
          </div>
        </div>
      </Transition>
    </div>
    <p v-else class="painel m-0 max-w-[520px] text-[14px] text-texto-2">Sem IA, o nível de cada questão vem do próprio texto.</p>

    <!-- Tipos -->
    <div role="group" :aria-labelledby="`${id}-tipos`">
      <p :id="`${id}-tipos`" class="rotulo flex items-baseline justify-between gap-3">
        <span>{{ semIa ? 'Jeitos de tirar do texto' : 'Tipos de questão' }}</span>
        <span class="font-medium text-texto-3">{{ marcados }} {{ marcados === 1 ? 'marcado' : 'marcados' }}</span>
      </p>

      <template v-if="semIa">
        <div v-if="!tecnicas" class="grid gap-1 sm:grid-cols-2" aria-hidden="true">
          <span v-for="i in 4" :key="i" class="esqueleto h-[58px] rounded-[12px]" />
        </div>
        <div v-else class="grid gap-1 sm:grid-cols-2">
          <label v-for="t in tecnicas" :key="t.id" class="linha-opcao">
            <input
              type="checkbox"
              class="marcar mt-[2px]"
              :checked="estado.tecnicas.includes(t.id)"
              :disabled="!t.quantidade"
              @change="alternar(estado.tecnicas, t.id)"
            >
            <QuestoesIconeTipo :tipo="t.id" class="mt-[2px] shrink-0 text-texto-2" />
            <span class="min-w-0 flex-1">
              <span class="flex items-center justify-between gap-2 text-[14.5px] font-semibold">
                {{ t.nome }}
                <span class="shrink-0 text-[12.5px] font-semibold tabular-nums" :class="t.quantidade ? 'text-ok' : 'text-texto-3'">{{ t.quantidade ? `${t.quantidade} no texto` : 'nenhuma' }}</span>
              </span>
              <span class="mt-0.5 block text-[13px] leading-[1.4] text-texto-2">{{ t.quantidade ? (DESCRICAO_TECNICA[t.id] ?? t.descricao) : (t.motivo || DESCRICAO_TECNICA[t.id]) }}</span>
            </span>
          </label>
        </div>
      </template>

      <template v-else>
        <div class="grid gap-1 sm:grid-cols-2">
          <label v-for="t in TIPOS_GERAR" :key="t" class="linha-opcao">
            <input type="checkbox" class="marcar mt-[2px]" :checked="estado.tipos.includes(t)" @change="alternarTipo(t)">
            <QuestoesIconeTipo :tipo="t" class="mt-[2px] shrink-0 text-texto-2" />
            <span class="min-w-0 flex-1">
              <span class="block text-[14.5px] font-semibold">{{ nomeDoTipo(t) }}</span>
              <span class="mt-0.5 block text-[13px] leading-[1.4] text-texto-2">{{ DESCRICAO_TIPO[t] }}</span>
            </span>
          </label>
        </div>
        <p v-if="modo === 'misto'" class="ajuda">Do texto também podem sair cartões, ordenar e associar.</p>
      </template>
    </div>
  </div>
</template>

<style scoped>
.faixa {
  transition: flex-grow 0.35s var(--ease-saida);
}
@media (prefers-reduced-motion: reduce) {
  .faixa {
    transition: none;
  }
}
:global(:root.menos-movimento) .faixa {
  transition: none;
}
</style>
