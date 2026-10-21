<script setup>
// Jeito "Outra IA" em três passos de verdade: copiar o pedido, colar na IA que a pessoa usa e trazer a resposta.
// A resposta é conferida enquanto a pessoa cola (o que está errado e onde); ao salvar, o servidor confere de novo.
import { Check, CircleAlert, CircleCheck, ClipboardPaste, Copy, ExternalLink, MessagesSquare, TriangleAlert } from '@lucide/vue'

const props = defineProps({
  pedido: { type: String, default: '' },
  carregando: { type: Boolean, default: false },
  resposta: { type: String, default: '' },
  conferencia: { type: Object, default: null },
  copiado: { type: Boolean, default: false },
  jaCopiou: { type: Boolean, default: false },
  salvando: { type: Boolean, default: false },
  aviso: { type: String, default: '' },
  erroServidor: { type: Object, default: null },
})
const emit = defineEmits(['copiar', 'salvar', 'update:resposta'])
const id = useId()

const IAS = [
  { nome: 'ChatGPT', url: 'https://chatgpt.com/' },
  { nome: 'Gemini', url: 'https://gemini.google.com/app' },
  { nome: 'Claude', url: 'https://claude.ai/new' },
]
const palavras = computed(() => (props.pedido.match(/\S+/g) ?? []).length)
const temResposta = computed(() => !!props.resposta.trim())
const conf = computed(() => props.conferencia)
const problemas = computed(() => props.erroServidor?.problemas ?? conf.value?.problemas ?? [])
const motivoErro = computed(() => props.erroServidor?.motivo || (temResposta.value && conf.value && !conf.value.ok ? conf.value.motivo : ''))
const prontas = computed(() => (conf.value?.ok ? conf.value.aprovadas.length : 0))

const passos = computed(() => [
  { feito: props.jaCopiou },
  { feito: props.jaCopiou && temResposta.value },
  { feito: prontas.value > 0 && !props.erroServidor },
])
// O campo balança quando o servidor recusa.
const treme = ref(false)
watch(() => props.erroServidor, (e) => {
  if (!e) return
  treme.value = false
  requestAnimationFrame(() => (treme.value = true))
})
</script>

<template>
  <ol class="caminho m-0 list-none p-0">
    <!-- 1. Copiar -->
    <li class="passo" :data-feito="passos[0].feito">
      <span class="marco" aria-hidden="true">
        <Check v-if="passos[0].feito" :size="16" :stroke-width="2.8" />
        <Copy v-else :size="16" :stroke-width="2.2" />
      </span>
      <div class="min-w-0 flex-1 pb-7">
        <h3 class="titulo-cartao">Copie o pedido</h3>
        <p class="m-0 mt-1 text-[14px] text-texto-2">Ele leva tudo o que você escolheu nesta página e o formato exato que o PGC entende.</p>
        <div class="relative mt-3">
          <div v-if="carregando && !pedido" class="flex flex-col gap-2 rounded-[12px] bg-folha-2 p-4" aria-hidden="true">
            <span v-for="i in 6" :key="i" class="esqueleto h-3 rounded" :style="{ width: `${90 - (i % 3) * 18}%` }" />
          </div>
          <pre
            v-else
            :id="`${id}-pedido`"
            tabindex="0"
            class="pedido m-0 max-h-[300px] overflow-auto whitespace-pre-wrap break-words rounded-[12px] bg-folha-2 p-4 font-mono text-[12.5px] leading-[1.6] text-texto-2"
            aria-label="Pedido para a outra IA"
          >{{ pedido || 'Escolha a matéria e os tipos para montar o pedido.' }}</pre>
        </div>
        <div class="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
          <button type="button" class="botao botao-p" :class="copiado && 'copiado'" :disabled="!pedido" @click="emit('copiar')">
            <Transition name="troca" mode="out-in">
              <Check v-if="copiado" key="sim" :size="16" :stroke-width="2.8" aria-hidden="true" />
              <Copy v-else key="nao" :size="16" :stroke-width="2.2" aria-hidden="true" />
            </Transition>
            {{ copiado ? 'Copiado' : 'Copiar pedido' }}
          </button>
          <span v-if="pedido" class="text-[13px] text-texto-3 tabular-nums">{{ palavras.toLocaleString('pt-BR') }} palavras</span>
          <span class="sr-only" aria-live="polite">{{ copiado ? 'Pedido copiado.' : '' }}</span>
        </div>
        <p v-if="aviso" class="m-0 mt-3 flex max-w-[600px] items-start gap-2 text-[13.5px] text-texto-2">
          <TriangleAlert :size="16" :stroke-width="2.1" class="mt-[2px] shrink-0 text-aviso" aria-hidden="true" />{{ aviso }}
        </p>
      </div>
    </li>

    <!-- 2. Colar na IA -->
    <li class="passo" :data-feito="passos[1].feito">
      <span class="marco" aria-hidden="true">
        <Check v-if="passos[1].feito" :size="16" :stroke-width="2.8" />
        <MessagesSquare v-else :size="16" :stroke-width="2.2" />
      </span>
      <div class="min-w-0 flex-1 pb-7">
        <h3 class="titulo-cartao">Cole na IA que você usa</h3>
        <p class="m-0 mt-1 text-[14px] text-texto-2">Abra uma conversa nova, cole o pedido e espere a resposta inteira.</p>
        <div class="mt-3 flex flex-wrap gap-2">
          <a v-for="x in IAS" :key="x.nome" :href="x.url" target="_blank" rel="noopener noreferrer" class="botao-secundario botao-p no-underline">
            {{ x.nome }}
            <ExternalLink :size="15" :stroke-width="2.2" aria-hidden="true" />
            <span class="sr-only">(abre em outra aba)</span>
          </a>
        </div>
      </div>
    </li>

    <!-- 3. Trazer a resposta -->
    <li class="passo" :data-feito="passos[2].feito">
      <span class="marco" aria-hidden="true">
        <Check v-if="passos[2].feito" :size="16" :stroke-width="2.8" />
        <ClipboardPaste v-else :size="16" :stroke-width="2.2" />
      </span>
      <div class="min-w-0 flex-1">
        <h3 class="titulo-cartao"><label :for="`${id}-resposta`">Cole a resposta da IA</label></h3>
        <p class="m-0 mt-1 text-[14px] text-texto-2">Copie a resposta inteira, do primeiro <code class="rounded-[5px] bg-folha-3 px-1 font-mono text-[12.5px]">{</code> ao último <code class="rounded-[5px] bg-folha-3 px-1 font-mono text-[12.5px]">}</code>.</p>
        <textarea
          :id="`${id}-resposta`"
          class="campo mt-3 min-h-[150px] resize-y py-3 font-mono text-[13px] leading-[1.55]"
          :class="[treme && 'treme', (motivoErro && temResposta) && 'invalido']"
          :value="resposta"
          rows="7"
          spellcheck="false"
          autocomplete="off"
          :aria-invalid="!!motivoErro && temResposta"
          :aria-describedby="`${id}-estado`"
          @input="emit('update:resposta', $event.target.value)"
          @animationend="treme = false"
        />

        <div :id="`${id}-estado`" class="mt-2.5" aria-live="polite">
          <template v-if="temResposta">
            <p v-if="motivoErro" class="erro-campo m-0 flex items-start gap-2">
              <CircleAlert :size="16" :stroke-width="2.2" class="mt-[2px] shrink-0" aria-hidden="true" />
              <span>{{ motivoErro }}</span>
            </p>
            <p v-if="conf?.trecho && !erroServidor" class="m-0 mt-2 overflow-x-auto rounded-[10px] bg-erro-suave px-3 py-2 font-mono text-[12.5px] text-tinta">
              <span class="text-erro">linha {{ conf.linha }}:</span> {{ conf.trecho }}
            </p>
            <p v-if="prontas && !erroServidor" class="m-0 flex items-center gap-2 text-[14.5px] font-semibold text-ok">
              <CircleCheck :size="17" :stroke-width="2.2" aria-hidden="true" />
              {{ prontas }} {{ prontas === 1 ? 'questão pronta' : 'questões prontas' }} para salvar
            </p>
            <p v-if="conf?.sobrando && !erroServidor" class="m-0 mt-1 text-[13.5px] text-texto-2">Vieram {{ conf.sobrando }} a mais que o pedido; o PGC salva só as primeiras.</p>
            <p v-if="prontas && conf.recebidas < conf.pedidas && !erroServidor" class="m-0 mt-1 max-w-[640px] text-[13.5px] text-texto-2">
              A outra IA mandou {{ conf.recebidas }} das {{ conf.pedidas }} pedidas. Para ter o resto, salve estas e peça na mesma conversa: "continue com as que faltam, no mesmo formato". Depois cole a nova resposta numa nova geração.
            </p>
            <div v-if="problemas.length" class="mt-3 rounded-[12px] bg-aviso-suave px-3.5 py-3">
              <p class="m-0 text-[13.5px] font-semibold text-tinta">{{ problemas.length === 1 ? 'Uma fica de fora' : `${problemas.length} ficam de fora` }}. Se quiser, peça para a IA corrigir:</p>
              <ul class="m-0 mt-2 flex list-none flex-col gap-1.5 p-0">
                <li v-for="p in problemas.slice(0, 6)" :key="p.numero" class="flex items-start gap-2 text-[13.5px] text-tinta">
                  <TriangleAlert :size="15" :stroke-width="2.1" class="mt-[3px] shrink-0 text-aviso" aria-hidden="true" />
                  <span><b>Questão {{ p.numero }}</b><template v-if="p.tipo"> ({{ p.tipo }})</template>: {{ p.motivos.join(' ') }}</span>
                </li>
              </ul>
              <p v-if="problemas.length > 6" class="m-0 mt-1.5 text-[13px] text-texto-2">E mais {{ problemas.length - 6 }} com problema.</p>
            </div>
          </template>
        </div>

        <button type="button" class="botao mt-4" :disabled="!prontas || salvando" :aria-busy="salvando" @click="emit('salvar')">
          <span v-if="salvando" class="rodando" aria-hidden="true" />
          <Check v-else :size="17" :stroke-width="2.4" aria-hidden="true" />
          {{ salvando ? 'Salvando' : prontas ? `Salvar ${prontas} ${prontas === 1 ? 'questão' : 'questões'}` : 'Salvar questões' }}
        </button>
      </div>
    </li>
  </ol>
</template>

<style scoped>
.passo {
  position: relative;
  display: flex;
  gap: 14px;
}
/* Linha do caminho entre os marcos. */
.passo:not(:last-child)::before {
  content: '';
  position: absolute;
  top: 36px;
  bottom: 4px;
  left: 15px;
  width: 2px;
  border-radius: 2px;
  background: var(--borda);
  transition: background-color 0.3s;
}
.passo[data-feito='true']:not(:last-child)::before {
  background: color-mix(in oklab, var(--ok-vivo) 55%, var(--borda));
}
.marco {
  display: grid;
  flex-shrink: 0;
  place-items: center;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: var(--acento-suave);
  color: var(--acento);
  transition: background-color 0.3s, color 0.3s, transform 0.3s var(--ease-saida);
}
.passo[data-feito='true'] .marco {
  background: var(--ok-vivo);
  color: var(--folha);
  animation: marca 0.4s var(--ease-saida);
}
@keyframes marca {
  40% {
    transform: scale(1.18);
  }
}
.campo.invalido {
  border-color: var(--erro);
}
.troca-enter-active,
.troca-leave-active {
  transition: transform 0.18s var(--ease-saida), opacity 0.18s;
}
.troca-enter-from {
  transform: scale(0.4) rotate(-30deg);
  opacity: 0;
}
.troca-leave-to {
  transform: scale(0.4);
  opacity: 0;
}
.copiado {
  animation: pulo 0.35s var(--ease-saida);
}
@keyframes pulo {
  40% {
    transform: translateY(-2px) scale(1.03);
  }
}
@media (prefers-reduced-motion: reduce) {
  .marco,
  .copiado,
  .passo[data-feito='true'] .marco {
    animation: none;
    transition: none;
  }
}
:global(:root.menos-movimento) .marco,
:global(:root.menos-movimento) .copiado {
  animation: none !important;
}
</style>
