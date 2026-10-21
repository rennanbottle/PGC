<script setup>
// O ciclo do PGC em cinco passos (material, questões, estudo, progresso e prova). No computador, a parte fica presa na
// tela enquanto a pessoa rola: a linha da esquerda enche e o desenho da direita troca a cada passo (é o parallax da
// apresentação, preso só a esta parte). Clicar num passo leva até ele. No celular e com "menos movimento" na tela
// pequena, os passos ficam um embaixo do outro, cada um com o seu desenho.
const PASSOS = [
  { titulo: 'Junte o material', texto: 'Cole um texto ou envie PDF e DOCX na Biblioteca. Você confere o texto antes de ele virar questão. Também dá para começar só com o nome do assunto.' },
  { titulo: 'Tenha as questões', texto: 'Até 20 por vez, em 17 tipos. Pela IA do PGC, por outra IA que você já usa ou importando uma prova antiga. Você confere cada uma antes de estudar.' },
  { titulo: 'Estude um pouco por dia', texto: 'Cada estudo junta o que venceu com o que é novo. A correção sai na hora, com dicas e o motivo de cada alternativa errada.' },
  { titulo: 'Veja o que já domina', texto: 'Cada assunto tem uma nota de 300 a 800 que sobe com o que você acerta. O que você erra volta mais cedo, até ficar firme.' },
  { titulo: 'Treine com prova', texto: 'Simulados com cronômetro e cartão-resposta nos formatos ENEM, Vestibular, Certo ou errado e Escola. As erradas viram um estudo.' },
]

const secao = ref(null)
const lista = ref(null)
// Só o passo atual é reativo: a rolagem mexe num número comum, e a tela só redesenha quando o passo muda.
const atual = ref(0)
let quadro = 0
function medir() {
  quadro = 0
  const el = secao.value
  if (!el || !el.offsetParent) return
  const r = el.getBoundingClientRect()
  if (r.bottom < 0 || r.top > window.innerHeight) return
  const total = r.height - window.innerHeight
  const progresso = total > 0 ? Math.max(0, Math.min(0.9999, -r.top / total)) : 0
  const passo = Math.min(PASSOS.length - 1, Math.floor(progresso * PASSOS.length))
  if (passo !== atual.value) atual.value = passo
}
const agendar = () => {
  if (!quadro) quadro = requestAnimationFrame(medir)
}
// Vai até o meio do trecho de rolagem do passo.
function irPara(i) {
  const el = secao.value
  if (!el) return
  const r = el.getBoundingClientRect()
  const total = r.height - window.innerHeight
  const alvo = window.scrollY + r.top + total * ((i + 0.5) / PASSOS.length)
  window.scrollTo({ top: alvo, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' })
}
// A linha cheia vai até o círculo do passo atual (o texto aberto muda a altura, por isso mede de novo no fim).
// Ela cresce com transform (escala), que não obriga o navegador a refazer o layout a cada quadro.
const enche = ref(0)
function medirLinha() {
  const ol = lista.value
  const bola = ol?.querySelector('.passo-ciclo.atual .numero-ciclo')
  const trilho = (ol?.offsetHeight ?? 0) - 60
  if (!bola || trilho <= 0) return
  // Distância do topo da lista até o meio do círculo (o círculo fica dentro do item, que tem posição própria).
  const meio = bola.getBoundingClientRect().top - ol.getBoundingClientRect().top + bola.offsetHeight / 2
  enche.value = Math.min(1, Math.max(0, (meio - 30) / trilho))
}
watch(atual, () => {
  nextTick(medirLinha)
  setTimeout(medirLinha, 480)
})
onMounted(() => {
  nextTick(medirLinha)
  window.addEventListener('scroll', agendar, { passive: true })
  window.addEventListener('resize', agendar, { passive: true })
  medir()
})
onBeforeUnmount(() => {
  cancelAnimationFrame(quadro)
  window.removeEventListener('scroll', agendar)
  window.removeEventListener('resize', agendar)
})
</script>

<template>
  <section class="ciclo" aria-labelledby="titulo-ciclo">
    <!-- Computador: preso na tela ao rolar -->
    <div ref="secao" class="hidden lg:block" :style="{ height: `${PASSOS.length * 72 + 40}vh` }">
      <div class="sticky top-0 flex h-dvh items-center">
        <div class="mx-auto grid w-full max-w-[1160px] grid-cols-[minmax(0,1fr)_minmax(0,1fr)] items-center gap-16 px-8">
          <div>
            <h2 id="titulo-ciclo" class="titulo-parte">Do texto à prova</h2>
            <p class="m-0 mt-3 max-w-[30em] text-[16px] leading-[1.6] text-texto-2">O caminho de um assunto dentro do PGC, do material que você já tem até o simulado.</p>
            <ol ref="lista" class="trilha relative m-0 mt-8 list-none p-0" :style="{ '--enche': enche }">
              <li v-for="(p, i) in PASSOS" :key="p.titulo" class="passo-ciclo" :class="{ atual: i === atual, feito: i < atual }">
                <button type="button" class="flex w-full cursor-pointer items-start gap-4 border-0 bg-transparent p-0 py-2.5 text-left text-tinta" :aria-current="i === atual ? 'step' : undefined" @click="irPara(i)">
                  <span class="numero-ciclo">{{ i + 1 }}</span>
                  <span class="min-w-0 pt-1">
                    <span class="titulo-passo block font-titulo text-[20px] font-bold tracking-[-0.015em] transition-colors">{{ p.titulo }}</span>
                    <span class="texto-ciclo block text-[15px] leading-[1.6] text-texto-2">{{ p.texto }}</span>
                  </span>
                </button>
              </li>
            </ol>
          </div>
          <div class="grid">
            <Transition name="troca-ciclo">
              <ApresentacaoCicloVisual :key="atual" :passo="atual" class="relative mx-auto w-full max-w-[460px] [grid-area:1/1]" />
            </Transition>
          </div>
        </div>
      </div>
    </div>

    <!-- Celular e tela média: um passo embaixo do outro -->
    <div class="mx-auto max-w-[680px] px-4 py-16 sm:px-8 lg:hidden">
      <h2 class="titulo-parte">Do texto à prova</h2>
      <p class="m-0 mt-3 text-[16px] leading-[1.6] text-texto-2">O caminho de um assunto dentro do PGC, do material que você já tem até o simulado.</p>
      <ol class="m-0 mt-8 flex list-none flex-col gap-12 p-0">
        <li v-for="(p, i) in PASSOS" :key="p.titulo" v-revelar>
          <p class="m-0 flex items-center gap-3"><span class="numero-ciclo cheio">{{ i + 1 }}</span><span class="font-titulo text-[21px] font-bold tracking-[-0.015em]">{{ p.titulo }}</span></p>
          <p class="m-0 mt-2 text-[15.5px] leading-[1.6] text-texto-2">{{ p.texto }}</p>
          <ApresentacaoCicloVisual :passo="i" class="mt-5" />
        </li>
      </ol>
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
.trilha::before,
.trilha::after {
  content: '';
  position: absolute;
  z-index: 0;
  left: 19px;
  top: 30px;
  width: 2px;
  border-radius: 2px;
}
.trilha::before {
  bottom: 30px;
  background: var(--borda);
}
.trilha::after {
  bottom: 30px;
  background: var(--acento);
  transform: scaleY(var(--enche, 0));
  transform-origin: top center;
  transition: transform 0.5s var(--ease-saida);
}
.numero-ciclo {
  position: relative;
  z-index: 1;
  display: grid;
  width: 40px;
  height: 40px;
  flex-shrink: 0;
  place-items: center;
  border: 2px solid var(--borda-forte);
  border-radius: 999px;
  background: var(--mesa);
  font-family: var(--font-titulo);
  font-size: 17px;
  font-weight: 800;
  color: var(--texto-2);
  transition: border-color 0.3s, background 0.3s, color 0.3s, transform 0.3s var(--ease-mola);
}
.passo-ciclo.feito .numero-ciclo {
  border-color: var(--acento);
  color: var(--acento);
}
.passo-ciclo.atual .numero-ciclo,
.numero-ciclo.cheio {
  border-color: var(--acento);
  background: var(--acento);
  color: var(--sobre-acento);
}
.passo-ciclo.atual .numero-ciclo {
  transform: scale(1.1);
}
.passo-ciclo {
  position: relative;
  z-index: 1;
}
.passo-ciclo:not(.atual) .titulo-passo {
  color: var(--texto-2);
}
.passo-ciclo button:hover .titulo-passo {
  color: var(--tinta);
}
.texto-ciclo {
  display: grid;
  max-height: 0;
  overflow: hidden;
  opacity: 0;
  transition: max-height 0.45s var(--ease-saida), opacity 0.3s, margin 0.3s;
}
.passo-ciclo.atual .texto-ciclo {
  max-height: 120px;
  margin-top: 6px;
  opacity: 1;
}
.troca-ciclo-enter-active {
  transition: opacity 0.35s ease, transform 0.45s var(--ease-saida);
}
.troca-ciclo-leave-active {
  transition: opacity 0.18s ease, transform 0.2s ease;
}
.troca-ciclo-enter-from {
  opacity: 0;
  transform: translateY(24px) scale(0.98);
}
.troca-ciclo-leave-to {
  opacity: 0;
  transform: translateY(-14px);
}
@media (prefers-reduced-motion: reduce) {
  .troca-ciclo-enter-active,
  .troca-ciclo-leave-active,
  .trilha::after,
  .texto-ciclo {
    transition: none;
  }
}
</style>
