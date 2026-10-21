<script setup>
// O que tem no PGC, em blocos de tamanhos diferentes (cada um no formato do que mostra): os 17 tipos de questão, a
// prova com cartão-resposta, a Agenda com o plano até a prova, o guia com as 12 expressões, as paletas
// (clicar troca a cor desta página, só para ver) e o resto em lista. Os números saem das regras do sistema.
import { Library, Monitor, Trophy } from '@lucide/vue'
import { TIPOS } from '#shared/regras/questoes.js'
import { FORMATOS } from '#shared/regras/provas.js'
import { EXPRESSOES, GUIAS_PRONTOS } from '#shared/regras/guias.js'
import { PALETAS } from '#shared/regras/perfil.js'

// Guia: a imagem só carrega quando o bloco chega perto da tela (é a mais pesada da página). Só o guia padrão
// aparece aqui, porque a página é pública; os outros ficam para a escolha dentro do sistema.
const blocoGuias = ref(null)
const pertoDosGuias = ref(false)
let observador = null
onMounted(() => {
  if (!('IntersectionObserver' in window)) {
    pertoDosGuias.value = true
    return
  }
  observador = new IntersectionObserver(([e]) => {
    if (e.isIntersecting) {
      pertoDosGuias.value = true
      observador.disconnect()
    }
  }, { rootMargin: '400px 0px' })
  if (blocoGuias.value) observador.observe(blocoGuias.value)
})

// Paletas: trocar aqui muda só esta página, até sair dela.
const paleta = ref('azul')
function provar(id) {
  paleta.value = id
  if (id === 'azul') delete document.documentElement.dataset.paleta
  else document.documentElement.dataset.paleta = id
}
onBeforeUnmount(() => {
  observador?.disconnect()
  delete document.documentElement.dataset.paleta
})

// Agenda de exemplo: um mês com a prova no dia 24 e os estudos do plano antes dela.
const DIAS = Array.from({ length: 35 }, (_, i) => i - 2)
const ESTUDO = new Set([6, 8, 10, 13, 15, 17, 20, 22])
const PROVA = 24
const BOLHAS = ['B', 'D', 'A', 'C', 'E', 'B']
</script>

<template>
  <section class="mx-auto max-w-[1160px] px-4 py-16 sm:px-8 lg:py-24" aria-labelledby="titulo-tem">
    <h2 id="titulo-tem" v-revelar class="titulo-parte">O que tem no PGC</h2>
    <p v-revelar="1" class="m-0 mt-3 max-w-[36em] text-[16px] leading-[1.6] text-texto-2">Tudo o que está aqui já funciona hoje, no computador e no celular.</p>

    <div class="mt-10 grid gap-4 lg:grid-cols-6">
      <!-- 17 tipos -->
      <article v-revelar class="cartao lg:col-span-4">
        <p class="m-0 flex items-baseline gap-2.5">
          <span class="numero-grande"><NumeroAnimado :valor="TIPOS.length" /></span>
          <span class="font-titulo text-[21px] font-semibold">tipos de questão</span>
        </p>
        <p class="m-0 mt-2 max-w-[36em] text-[15px] leading-[1.55] text-texto-2">Da múltipla escolha ao código, com correção na hora e o motivo de cada alternativa errada.</p>
        <ul class="m-0 mt-5 flex list-none flex-wrap gap-1.5 p-0">
          <li v-for="(t, i) in TIPOS" :key="t.id" class="tipo-chip" :style="{ animationDelay: `${i * 40 + 200}ms` }">{{ t.nome }}</li>
        </ul>
      </article>

      <!-- Prova -->
      <article v-revelar="1" class="cartao flex flex-col lg:col-span-2">
        <h3 class="m-0 font-titulo text-[20px] font-bold tracking-[-0.01em]">Prova com cartão-resposta</h3>
        <p class="m-0 mt-1.5 text-[14.5px] leading-[1.55] text-texto-2">Cronômetro, gabarito no fim e {{ FORMATOS.length }} formatos: {{ FORMATOS.map((f) => f.nome).join(', ').replace(/, ([^,]*)$/, ' e $1') }}.</p>
        <ol class="m-0 mt-auto list-none p-0 pt-4" aria-hidden="true">
          <li v-for="(b, i) in BOLHAS" :key="i" class="flex items-center gap-1.5 py-[3px] text-[11.5px]">
            <b class="w-5 tabular-nums text-texto-3">{{ String(i + 1).padStart(2, '0') }}</b>
            <span v-for="l in 'ABCDE'" :key="l" class="bolha" :class="l === b && 'cheia'" :style="{ animationDelay: `${i * 110 + 300}ms` }">{{ l }}</span>
          </li>
        </ol>
      </article>

      <!-- Agenda -->
      <article v-revelar class="cartao lg:col-span-2">
        <h3 class="m-0 font-titulo text-[20px] font-bold tracking-[-0.01em]">Agenda até a prova</h3>
        <p class="m-0 mt-1.5 text-[14.5px] leading-[1.55] text-texto-2">Marque a data da prova e o PGC monta o plano de estudo até o dia.</p>
        <div class="mt-4" aria-hidden="true">
          <div class="grid grid-cols-7 gap-1 text-center text-[11px] font-semibold text-texto-3">
            <span v-for="(d, i) in ['D', 'S', 'T', 'Q', 'Q', 'S', 'S']" :key="i">{{ d }}</span>
          </div>
          <div class="mt-1 grid grid-cols-7 gap-1">
            <span v-for="(d, i) in DIAS" :key="i" class="dia-mini" :class="{ fora: d < 1 || d > 30, estudo: ESTUDO.has(d), prova: d === PROVA }" :style="{ animationDelay: `${i * 14 + 150}ms` }">{{ d >= 1 && d <= 30 ? d : '' }}</span>
          </div>
          <p class="m-0 mt-2.5 flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-texto-2"><span class="flex items-center gap-1.5"><span class="legenda-estudo" />estudo do plano</span><span class="flex items-center gap-1.5"><span class="legenda-prova" />prova</span></p>
        </div>
      </article>

      <!-- Guias: só o Bartolomeu (o guia padrão), com as 12 expressões -->
      <article ref="blocoGuias" v-revelar="1" class="cartao lg:col-span-4">
        <h3 class="m-0 font-titulo text-[20px] font-bold tracking-[-0.01em]">Um guia acompanha você</h3>
        <p class="m-0 mt-1.5 max-w-[38em] text-[14.5px] leading-[1.55] text-texto-2">
          Ele explica as telas, comemora o resultado e ajuda quando dá erro. São {{ GUIAS_PRONTOS.length }} guias para escolher, ou a imagem
          que você enviar, cada um com {{ EXPRESSOES.length }} expressões. Este é o {{ GUIAS_PRONTOS[0].nome }}:
        </p>
        <ul class="m-0 mt-5 grid list-none grid-cols-4 gap-x-2 gap-y-3 p-0 sm:grid-cols-6">
          <li v-for="(e, i) in EXPRESSOES" :key="e.id" class="expressao" :style="{ animationDelay: `${i * 45 + 150}ms` }">
            <GuiaPersonagem v-if="pertoDosGuias" :imagem="GUIAS_PRONTOS[0].arquivo" :humor="e.id" :tamanho="64" />
            <span v-else class="inline-block size-16 rounded-[28%] bg-acento-suave" aria-hidden="true" />
            <span class="mt-1 block truncate text-[12.5px] font-semibold text-texto-2">{{ e.nome }}</span>
          </li>
        </ul>
      </article>

      <!-- Paletas -->
      <article v-revelar class="cartao lg:col-span-3">
        <h3 class="m-0 font-titulo text-[20px] font-bold tracking-[-0.01em]">Do seu jeito</h3>
        <p class="m-0 mt-1.5 text-[14.5px] leading-[1.55] text-texto-2">{{ PALETAS.length }} paletas, tema claro, escuro ou o do sistema, e a opção de menos movimento. Toque numa cor para ver esta página com ela.</p>
        <div class="mt-4 flex flex-wrap gap-2.5" role="radiogroup" aria-label="Ver esta página com outra paleta">
          <button
            v-for="p in PALETAS"
            :key="p.id"
            type="button"
            role="radio"
            class="amostra-paleta"
            :aria-checked="paleta === p.id"
            @click="provar(p.id)"
          >
            <span class="bolinha-paleta" :style="{ background: p.cor }" aria-hidden="true" />{{ p.nome }}
          </button>
        </div>
        <div class="mt-5 flex flex-wrap items-center gap-3 border-t border-borda pt-4">
          <span class="text-[14px] font-semibold text-texto-2">Tema</span>
          <SeletorTema />
        </div>
      </article>

      <!-- O resto -->
      <article v-revelar="1" class="cartao lg:col-span-3">
        <ul class="m-0 list-none p-0">
          <li class="flex gap-3.5 border-b border-borda pb-4">
            <Library :size="21" :stroke-width="1.9" class="mt-0.5 shrink-0 text-acento" aria-hidden="true" />
            <div><h3 class="m-0 text-[16.5px] font-semibold">Biblioteca com os seus textos</h3><p class="m-0 mt-0.5 text-[14.5px] leading-[1.55] text-texto-2">PDF, DOCX ou texto colado. Fórmulas copiadas da internet ficam legíveis.</p></div>
          </li>
          <li class="flex gap-3.5 border-b border-borda py-4">
            <Trophy :size="21" :stroke-width="1.9" class="mt-0.5 shrink-0 text-acento" aria-hidden="true" />
            <div><h3 class="m-0 text-[16.5px] font-semibold">Pontos e ranking opcional</h3><p class="m-0 mt-0.5 text-[14.5px] leading-[1.55] text-texto-2">Pontos medem esforço, não nota. No ranking aparece só o apelido, e só se você quiser.</p></div>
          </li>
          <li class="flex gap-3.5 pt-4">
            <Monitor :size="21" :stroke-width="1.9" class="mt-0.5 shrink-0 text-acento" aria-hidden="true" />
            <div><h3 class="m-0 text-[16.5px] font-semibold">Pronto para o computador da escola</h3><p class="m-0 mt-0.5 text-[14.5px] leading-[1.55] text-texto-2">Abre no navegador, sem instalar nada, e sai sozinho depois de 30 minutos parado.</p></div>
          </li>
        </ul>
      </article>
    </div>
  </section>
</template>

<style scoped>
.titulo-parte {
  margin: 0;
  font-family: var(--font-titulo);
  font-size: clamp(28px, 3.4vw, 40px);
  font-weight: 750;
  line-height: 1.08;
  letter-spacing: -0.03em;
}
.tipo-chip {
  padding: 5px 11px;
  border: 1px solid var(--borda);
  border-radius: 999px;
  font-size: 13.5px;
  color: var(--texto-2);
  animation: pop 0.4s var(--ease-mola) backwards;
  transition: border-color 0.15s, color 0.15s, background 0.15s;
}
.tipo-chip:hover {
  border-color: var(--acento);
  background: var(--acento-suave);
  color: var(--acento);
}
.bolha {
  display: inline-grid;
  width: 18px;
  height: 18px;
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
}
.dia-mini {
  display: grid;
  aspect-ratio: 1;
  place-items: center;
  border-radius: 8px;
  font-size: 11.5px;
  font-weight: 600;
  color: var(--texto-2);
  animation: aparece 0.3s ease backwards;
}
.dia-mini.fora {
  visibility: hidden;
}
.dia-mini.estudo {
  background: var(--acento-suave);
  color: var(--acento);
}
.dia-mini.prova {
  background: var(--energia);
  color: #fff;
  font-weight: 800;
  animation: pop 0.5s var(--ease-mola) 0.7s backwards;
}
.legenda-estudo,
.legenda-prova {
  display: inline-block;
  width: 12px;
  height: 12px;
  border-radius: 4px;
  background: var(--acento-suave);
  border: 1px solid var(--acento);
}
.legenda-prova {
  background: var(--energia);
  border-color: var(--energia);
}
.expressao {
  text-align: center;
  animation: pop 0.4s var(--ease-mola) backwards;
  transition: transform 0.25s var(--ease-mola);
}
.expressao:hover {
  transform: translateY(-4px) scale(1.06);
}
.amostra-paleta {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  min-height: 38px;
  padding: 6px 12px 6px 7px;
  border: 1.5px solid var(--borda-forte);
  border-radius: 999px;
  background: var(--folha);
  color: var(--tinta);
  font: inherit;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: border-color 0.15s, transform 0.15s var(--ease-saida);
}
.amostra-paleta:hover {
  transform: translateY(-2px);
}
.amostra-paleta[aria-checked='true'] {
  border-color: var(--acento);
  box-shadow: 0 0 0 3px var(--acento-suave);
}
.bolinha-paleta {
  width: 24px;
  height: 24px;
  border-radius: 999px;
}
@media (prefers-reduced-motion: reduce) {
  .tipo-chip,
  .bolha.cheia,
  .dia-mini,
  .dia-mini.prova,
  .expressao {
    animation: none;
  }
}
</style>
