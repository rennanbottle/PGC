<script setup>
// O desenho de cada passo do ciclo na apresentação (material, questões, estudo, progresso e prova), feito com as
// mesmas peças da interface. Os números são de exemplo e a figura diz isso. As animações rodam quando o desenho
// aparece; com "menos movimento" ficam paradas no fim.
import { CircleCheck, Clock, FileText } from '@lucide/vue'

defineProps({
  passo: { type: Number, required: true },
})
const LINHAS = [92, 78, 88, 64, 95, 70, 84, 58]
const USADAS = new Set([1, 2, 5])
const BOLHAS = ['B', 'D', 'A', 'C', 'B', 'E', 'A', 'D', 'C', 'B']
</script>

<template>
  <div class="visual-ciclo relative">
    <p class="m-0 mb-3 text-[12.5px] font-semibold text-texto-3">Exemplo</p>

    <!-- 1. Material -->
    <div v-if="passo === 0" class="cartao-p folha-doc">
      <div class="flex items-center gap-3">
        <span class="grid size-10 place-items-center rounded-[12px] bg-acento-suave text-acento"><FileText :size="20" :stroke-width="2" aria-hidden="true" /></span>
        <div class="min-w-0">
          <p class="m-0 truncate text-[15px] font-semibold">Funções do 2º grau.pdf</p>
          <p class="m-0 text-[12.5px] text-texto-2">12 páginas, Matemática</p>
        </div>
        <span class="selo ml-auto" data-tipo="ok"><CircleCheck :size="13" :stroke-width="2.4" aria-hidden="true" />Conferido</span>
      </div>
      <div class="mt-4 flex flex-col gap-2">
        <span v-for="(l, i) in LINHAS" :key="i" class="linha-doc" :class="USADAS.has(i) && 'usada'" :style="{ width: `${l}%`, '--i': i }" />
      </div>
      <p class="m-0 mt-4 text-[13px] text-texto-2"><span class="marcador-usado" aria-hidden="true" /> Trechos que viram questão</p>
    </div>

    <!-- 2. Questões -->
    <div v-else-if="passo === 1" class="leque">
      <div class="cartao-p carta" style="--i: 0; --giro: -6deg; --x: -18px">
        <p class="m-0 text-[12.5px] font-semibold text-texto-2">Lacuna digitada</p>
        <TextoRico class="mt-1.5 text-[15px] font-semibold" texto="O discriminante é $\Delta = b^2 - $ ______." />
      </div>
      <div class="cartao-p carta" style="--i: 1; --giro: 3deg; --x: 14px">
        <p class="m-0 text-[12.5px] font-semibold text-texto-2">Verdadeiro ou falso</p>
        <p class="m-0 mt-1.5 text-[15px] font-semibold">Se a &lt; 0, a parábola tem concavidade para cima.</p>
      </div>
      <div class="cartao-p carta" style="--i: 2; --giro: -1.5deg; --x: 0px">
        <p class="m-0 text-[12.5px] font-semibold text-texto-2">Múltipla escolha</p>
        <TextoRico class="mt-1.5 text-[15px] font-semibold" texto="Qual é o $x_v$ de $f(x) = 2x^2 - 16x + 7$?" />
        <div class="mt-2.5 grid grid-cols-4 gap-1.5 text-center text-[14px] font-semibold">
          <span v-for="(a, i) in ['8', '4', '−4', '16']" :key="a" class="rounded-[10px] border py-1.5" :class="i === 1 ? 'border-acento bg-acento-suave text-acento' : 'border-borda'">{{ a }}</span>
        </div>
      </div>
    </div>

    <!-- 3. Estudo -->
    <div v-else-if="passo === 2" class="cartao-p">
      <div class="flex items-center gap-3 text-[13px] text-texto-2">
        <span class="font-semibold text-tinta">Questão 7 de 10</span>
        <span class="barra fina flex-1"><i class="barra-anda" style="width: 70%" /></span>
      </div>
      <TextoRico class="mt-4 text-[17px] font-semibold leading-snug" texto="Se $a = 1$, $b = -4$ e $c = 3$, quanto vale $\Delta$?" />
      <div class="mt-3 flex flex-col gap-2">
        <span v-for="(a, i) in ['4', '−8', '16', '28']" :key="a" class="alternativa-mini" :class="i === 0 && 'certa'" :style="{ '--i': i }">
          <b class="letra-mini">{{ 'ABCD'[i] }}</b>{{ a }}
          <span v-if="i === 0" class="ml-auto flex items-center gap-1 text-[12.5px] font-semibold text-ok"><CircleCheck :size="14" :stroke-width="2.4" aria-hidden="true" />Certa</span>
        </span>
      </div>
      <p class="pontos-mini m-0 mt-3 text-right text-[14px] font-bold text-energia-texto">+12 pontos</p>
    </div>

    <!-- 4. Progresso -->
    <div v-else-if="passo === 3" class="cartao-p">
      <p class="m-0 flex items-center justify-between text-[14px]"><b>Funções do 2º grau</b><span class="selo" data-tipo="ok"><CircleCheck :size="13" :stroke-width="2.4" aria-hidden="true" />Proficiente</span></p>
      <div class="relative mt-5 h-6">
        <span class="absolute inset-x-0 top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-folha-3" />
        <span class="absolute left-0 top-1/2 h-1.5 w-[20%] -translate-y-1/2 rounded-l-full bg-erro-suave" />
        <span class="rastro-prof absolute top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-acento" />
        <span class="absolute top-1/2 size-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-acento bg-folha" style="left: 24%" />
        <span class="ponto-prof absolute top-1/2 size-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-acento ring-[3px] ring-folha" />
      </div>
      <p class="m-0 mt-1 flex justify-between text-[11.5px] font-semibold text-texto-3"><span>300</span><span>800</span></p>
      <p class="m-0 mt-2 text-[14px] tabular-nums">420 para <b>604</b> <span class="font-semibold text-ok">(+184)</span> em duas semanas</p>
      <div class="mt-4 flex h-20 items-end gap-1.5 border-b border-borda">
        <span v-for="(v, i) in [30, 45, 40, 62, 55, 70, 82]" :key="i" class="barra-cresce flex-1 rounded-t-[5px]" :style="{ height: `${v}%`, background: i === 6 ? 'var(--acento)' : 'color-mix(in oklab, var(--acento) 38%, var(--folha-3))', animationDelay: `${i * 60 + 200}ms` }" />
      </div>
      <p class="m-0 mt-1.5 text-[12.5px] text-texto-2">Acerto nos últimos 7 estudos</p>
    </div>

    <!-- 5. Prova -->
    <div v-else class="cartao-p">
      <div class="flex items-center justify-between gap-3">
        <p class="m-0 text-[15px] font-semibold">Simulado ENEM, Matemática</p>
        <span class="flex items-center gap-1.5 text-[13px] font-semibold tabular-nums text-texto-2"><Clock :size="14" :stroke-width="2.2" aria-hidden="true" />27:40</span>
      </div>
      <ol class="m-0 mt-3 grid list-none grid-cols-2 gap-x-5 gap-y-1.5 p-0">
        <li v-for="(b, i) in BOLHAS" :key="i" class="flex items-center gap-1.5 text-[12px]">
          <b class="w-5 tabular-nums text-texto-3">{{ String(i + 1).padStart(2, '0') }}</b>
          <span v-for="l in 'ABCDE'" :key="l" class="bolha" :class="l === b && 'cheia'" :style="{ '--i': i }">{{ l }}</span>
        </li>
      </ol>
      <p class="m-0 mt-3 border-t border-borda pt-3 text-[14px]">Nota <b class="text-[18px]">75%</b> <span class="text-texto-2">15 de 20 certas</span></p>
    </div>
  </div>
</template>

<style scoped>
.folha-doc {
  animation: aparece 0.4s ease backwards;
}
.linha-doc {
  display: block;
  height: 9px;
  border-radius: 5px;
  background: var(--folha-3);
  transform-origin: left center;
  animation: cresce-x 0.6s var(--ease-saida) backwards;
  animation-delay: calc(var(--i) * 60ms);
}
.linha-doc.usada {
  background: color-mix(in oklab, var(--acento) 35%, var(--folha-3));
}
.marcador-usado {
  display: inline-block;
  width: 22px;
  height: 8px;
  margin-right: 4px;
  border-radius: 4px;
  background: color-mix(in oklab, var(--acento) 35%, var(--folha-3));
  vertical-align: middle;
}
.leque {
  display: grid;
}
.carta {
  grid-area: 1 / 1;
  transform: translateX(var(--x)) rotate(var(--giro));
  animation: carta-entra 0.55s var(--ease-mola) backwards;
  animation-delay: calc(var(--i) * 140ms);
}
.carta:nth-child(1) {
  margin-top: 0;
  margin-bottom: 150px;
}
.carta:nth-child(2) {
  margin-top: 70px;
  margin-bottom: 80px;
}
.carta:nth-child(3) {
  margin-top: 140px;
}
@keyframes carta-entra {
  from {
    opacity: 0;
    transform: translate(var(--x), 40px) rotate(0deg) scale(0.94);
  }
}
.alternativa-mini {
  display: flex;
  align-items: center;
  gap: 10px;
  border: 1.5px solid var(--borda);
  border-radius: 12px;
  padding: 7px 10px;
  font-size: 15px;
  font-weight: 600;
  animation: aparece 0.3s ease backwards;
  animation-delay: calc(var(--i) * 80ms + 150ms);
}
.alternativa-mini.certa {
  border-color: var(--ok);
  background: var(--ok-suave);
}
.letra-mini {
  display: grid;
  width: 22px;
  height: 22px;
  place-items: center;
  border: 1.5px solid var(--borda-forte);
  border-radius: 999px;
  font-size: 11.5px;
}
.pontos-mini {
  animation: pop 0.5s var(--ease-mola) 0.7s backwards;
}
.barra-anda {
  transform-origin: left center;
  animation: cresce-x 0.9s var(--ease-saida) backwards;
}
.rastro-prof {
  left: 24%;
  width: 37%;
  transform-origin: left center;
  animation: cresce-x 1.2s var(--ease-saida) 0.3s backwards;
}
.ponto-prof {
  left: 61%;
  animation: anda-prof 1.2s var(--ease-saida) 0.3s backwards;
}
@keyframes anda-prof {
  from {
    left: 24%;
  }
}
.bolha {
  display: inline-grid;
  width: 17px;
  height: 17px;
  place-items: center;
  border: 1px solid var(--borda-forte);
  border-radius: 999px;
  font-size: 9.5px;
  font-weight: 700;
  color: var(--texto-3);
}
.bolha.cheia {
  border-color: var(--tinta);
  background: var(--tinta);
  color: var(--folha);
  animation: pop 0.35s var(--ease-mola) backwards;
  animation-delay: calc(var(--i) * 90ms + 200ms);
}
@media (prefers-reduced-motion: reduce) {
  .visual-ciclo * {
    animation: none !important;
  }
}
:global(:root.menos-movimento) .visual-ciclo * {
  animation: none !important;
}
</style>
