<script setup>
// Mapa de conceitos da abertura: a marca do PGC no meio, as matérias em volta e, mais longe, os conceitos de cada
// uma, ligados por linhas (no lugar da "parede de palavras" do VI, como pedia a direção visual). De tempos em tempos um
// conceito acende com "volta hoje" e a linha até ele corre: é o PGC trazendo de volta o que está para ser esquecido.
// Ao abrir, a marca aparece, as matérias entram em cascata e as linhas se desenham. Depois tudo flutua devagar, segue
// o mouse de leve (as camadas mais longe andam mais) e, ao rolar, a camada de fora sobe mais devagar (parallax).
// Com "menos movimento", fica parado e com um conceito aceso. O desenho para quando sai da tela ou a aba fica oculta.
// As linhas são desenhadas num <canvas> a cada quadro (mais leve que mexer em dezenas de linhas de SVG): só os nós
// são elementos da página, e eles andam só com transform, sem recalcular o layout.
// Os conceitos são exemplos de conteúdo do ensino médio, não dados de alguém.
const props = defineProps({
  compacto: { type: Boolean, default: false }, // celular: menos conceitos
})

// Lugares feitos à mão (fração da largura e da altura), para nenhum nome encostar no outro. "c" é o lugar no celular;
// conceito sem "c" não aparece no celular.
const MATERIAS = [
  { id: 'mat', nome: 'Matemática', cor: 'azul', p: [0.5, 0.23], c: [0.5, 0.2], conceitos: [
    { texto: 'Δ = b² − 4ac', p: [0.24, 0.09], c: [0.5, 0.04] },
    { texto: 'xᵥ = −b/2a', p: [0.71, 0.08] },
  ] },
  { id: 'bio', nome: 'Biologia', cor: 'verde', p: [0.83, 0.31], c: [0.8, 0.33], conceitos: [{ texto: 'Fotossíntese', p: [0.87, 0.16] }] },
  { id: 'his', nome: 'História', cor: 'laranja', p: [0.84, 0.57], c: [0.8, 0.62], conceitos: [{ texto: 'Revolução Francesa', p: [0.77, 0.73] }] },
  { id: 'qui', nome: 'Química', cor: 'roxo', p: [0.55, 0.8], c: [0.56, 0.82], conceitos: [{ texto: 'Ligação iônica', p: [0.5, 0.95] }] },
  { id: 'fis', nome: 'Física', cor: 'vermelho', p: [0.24, 0.73], c: [0.22, 0.76], conceitos: [{ texto: 'F = m · a', p: [0.13, 0.88], c: [0.26, 0.95] }] },
  { id: 'por', nome: 'Português', cor: 'rosa', p: [0.14, 0.5], c: [0.15, 0.5], conceitos: [{ texto: 'Crase', p: [0.07, 0.35] }] },
  { id: 'pro', nome: 'Programação', cor: 'cinza', p: [0.21, 0.24], c: [0.2, 0.28], conceitos: [] },
]
// Monta os nós (marca, matérias e conceitos) e as ligações: marca com matéria, matéria com conceito.
const montado = computed(() => {
  const nos = [{ id: 'pgc', nivel: 0, x: 0.5, y: 0.5 }]
  const linhas = []
  MATERIAS.forEach((m, i) => {
    const [x, y] = props.compacto ? m.c : m.p
    nos.push({ id: m.id, nivel: 1, texto: m.nome, cor: m.cor, x, y, fase: i * 1.7 })
    linhas.push({ de: 'pgc', para: m.id })
    m.conceitos.forEach((c, k) => {
      const lugar = props.compacto ? c.c : c.p
      if (!lugar) return
      const id = `${m.id}-${k}`
      nos.push({ id, nivel: 2, texto: c.texto, cor: m.cor, x: lugar[0], y: lugar[1], fase: i * 2.3 + k })
      linhas.push({ de: m.id, para: id })
    })
  })
  return { nos, linhas }
})
const conceitos = computed(() => montado.value.nos.filter((n) => n.nivel === 2))

// O conceito aceso e o caminho até a marca.
const aceso = ref('')
const caminho = computed(() => {
  if (!aceso.value) return new Set()
  const materia = aceso.value.split('-')[0]
  return new Set([`pgc>${materia}`, `${materia}>${aceso.value}`])
})
const ativa = (l) => caminho.value.has(`${l.de}>${l.para}`)
const porId = computed(() => new Map(montado.value.nos.map((n) => [n.id, n])))

const area = ref(null)
const tela = ref(null)
const elNos = new Map()
const guardarNo = (id) => (el) => {
  if (el) elNos.set(id, el)
  else elNos.delete(id)
}
let ctx = null
let dpr = 1
let inicio = 0
let caixa = null
const cores = { trilho: 'rgb(201, 206, 216)', acento: 'rgb(47, 91, 255)' }
// Cores do tema atual (mudam com claro, escuro e a cor do PGC). Uma variável CSS pode ser "color-mix(...)", que o
// canvas não entende: a cor passa por um elemento escondido, e o navegador devolve em rgb.
const sonda = ref(null)
function lerCores() {
  const el = sonda.value
  if (!el) return
  el.style.color = 'var(--borda-forte)'
  cores.trilho = getComputedStyle(el).color || cores.trilho
  el.style.color = 'var(--acento)'
  cores.acento = getComputedStyle(el).color || cores.acento
}
const suave = (x) => 1 - (1 - x) ** 3

let largura = 0
let altura = 0
let quadro = 0
let relogio = null
let visivel = true
const mouse = { x: 0, y: 0, alvoX: 0, alvoY: 0 }
const AMPLITUDE = [0, 5, 9]
const PROFUNDIDADE = [0.25, 0.6, 1]

// Quanto o nó sai do lugar dele (flutuar e seguir o mouse). O lugar vem em porcentagem, já no HTML do servidor.
function desvio(no, t) {
  const amp = AMPLITUDE[no.nivel]
  const prof = PROFUNDIDADE[no.nivel]
  const fase = no.fase ?? 0
  return {
    x: Math.sin(t * 0.00042 + fase) * amp + mouse.x * 14 * prof,
    y: Math.cos(t * 0.00035 + fase * 1.3) * amp + mouse.y * 10 * prof,
  }
}
function desenhar(t) {
  mouse.x += (mouse.alvoX - mouse.x) * 0.06
  mouse.y += (mouse.alvoY - mouse.y) * 0.06
  const pontos = new Map()
  for (const no of montado.value.nos) {
    const d = desvio(no, t)
    pontos.set(no.id, { x: no.x * largura + d.x, y: no.y * altura + d.y })
    const el = elNos.get(no.id)
    if (el) el.style.transform = `translate(-50%, -50%) translate3d(${d.x.toFixed(1)}px, ${d.y.toFixed(1)}px, 0)`
  }
  if (!ctx) return
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  ctx.clearRect(0, 0, largura, altura)
  ctx.lineCap = 'round'
  const tempo = t - inicio
  montado.value.linhas.forEach((l, i) => {
    const a = pontos.get(l.de)
    const b = pontos.get(l.para)
    if (!a || !b) return
    // A linha se desenha ao abrir, uma depois da outra.
    const p = quieto.value ? 1 : suave(Math.max(0, Math.min(1, (tempo - (i * 45 + 450)) / 900)))
    if (p <= 0) return
    const x2 = a.x + (b.x - a.x) * p
    const y2 = a.y + (b.y - a.y) * p
    const acesa = ativa(l)
    ctx.setLineDash([])
    ctx.lineWidth = 1.4
    ctx.strokeStyle = cores.trilho
    ctx.beginPath()
    ctx.moveTo(a.x, a.y)
    ctx.lineTo(x2, y2)
    ctx.stroke()
    if (acesa) {
      ctx.globalAlpha = 0.45
      ctx.strokeStyle = cores.acento
      ctx.stroke()
      ctx.globalAlpha = 1
    }
    // No caminho aceso, tracinhos correm da marca até o conceito.
    if (acesa && p === 1) {
      ctx.strokeStyle = cores.acento
      ctx.lineWidth = 2.2
      ctx.setLineDash([7, 9])
      ctx.lineDashOffset = quieto.value ? 0 : -((tempo / 1200) * 32) % 16
      ctx.beginPath()
      ctx.moveTo(a.x, a.y)
      ctx.lineTo(b.x, b.y)
      ctx.stroke()
    }
  })
}
function laco(t) {
  desenhar(t)
  quadro = visivel && !document.hidden ? requestAnimationFrame(laco) : 0
}
function ligar() {
  if (!quadro) quadro = requestAnimationFrame(laco)
}
const semMovimento = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches || document.documentElement.classList.contains('menos-movimento')

function medir() {
  const r = area.value?.getBoundingClientRect()
  if (!r) return
  caixa = r
  largura = r.width
  altura = r.height
  dpr = Math.min(2, window.devicePixelRatio || 1)
  if (tela.value) {
    tela.value.width = Math.round(largura * dpr)
    tela.value.height = Math.round(altura * dpr)
    ctx = tela.value.getContext('2d')
  }
  lerCores()
  desenhar(performance.now())
}
// A posição da área é guardada (medir de novo a cada movimento do mouse obriga o navegador a recalcular a página).
const aoRolarPagina = () => {
  caixa = null
}
function aoMover(e) {
  if (!caixa) caixa = area.value?.getBoundingClientRect() ?? null
  const r = caixa
  if (!r) return
  mouse.alvoX = Math.max(-1, Math.min(1, (e.clientX - (r.left + r.width / 2)) / (r.width / 2)))
  mouse.alvoY = Math.max(-1, Math.min(1, (e.clientY - (r.top + r.height / 2)) / (r.height / 2)))
}
watch(aceso, () => {
  if (quieto.value && import.meta.client) desenhar(performance.now())
})
// Acende um conceito por vez, numa ordem que passa por todas as matérias.
let vez = 0
function acenderProximo() {
  const lista = conceitos.value
  if (!lista.length) return
  vez = (vez + 3) % lista.length
  aceso.value = lista[vez].id
}

let observador = null
let medidor = null
let temas = null
const quieto = ref(true)
onMounted(() => {
  inicio = performance.now()
  medidor = new ResizeObserver(medir)
  medidor.observe(area.value)
  // Troca de tema ou de cor do PGC: lê as cores de novo e redesenha.
  temas = new MutationObserver(() => {
    lerCores()
    desenhar(performance.now())
  })
  temas.observe(document.documentElement, { attributes: true, attributeFilter: ['class', 'data-paleta', 'style'] })
  aceso.value = conceitos.value[0]?.id ?? ''
  if (semMovimento()) {
    medir()
    return
  }
  quieto.value = false
  medir()
  window.addEventListener('pointermove', aoMover, { passive: true })
  window.addEventListener('scroll', aoRolarPagina, { passive: true })
  observador = new IntersectionObserver(([e]) => {
    visivel = e.isIntersecting
    if (visivel) ligar()
  })
  observador.observe(area.value)
  document.addEventListener('visibilitychange', ligar)
  relogio = setInterval(acenderProximo, 2800)
  ligar()
})
onBeforeUnmount(() => {
  cancelAnimationFrame(quadro)
  clearInterval(relogio)
  medidor?.disconnect()
  observador?.disconnect()
  temas?.disconnect()
  window.removeEventListener('pointermove', aoMover)
  window.removeEventListener('scroll', aoRolarPagina)
  document.removeEventListener('visibilitychange', ligar)
})
</script>

<template>
  <div ref="area" class="constelacao relative select-none" :class="quieto && 'quieto'" aria-hidden="true">
    <canvas ref="tela" class="absolute inset-0 h-full w-full" />
    <span ref="sonda" class="hidden" />
    <div
      v-for="(no, i) in montado.nos"
      :key="no.id"
      :ref="guardarNo(no.id)"
      class="no absolute"
      :data-nivel="no.nivel"
      :class="aceso === no.id && 'aceso'"
      :style="{ '--i': i, '--cor': no.cor ? `var(--marca-${no.cor})` : undefined, left: `${no.x * 100}%`, top: `${no.y * 100}%`, transform: 'translate(-50%, -50%)' }"
    >
      <span v-if="no.nivel === 0" class="marca-centro"><MarcaPgc so-icone /></span>
      <span v-else class="pilula-no">
        <span v-if="no.nivel === 1" class="ponto-no" />
        <span :class="no.nivel === 2 && 'font-mono-no'">{{ no.texto }}</span>
      </span>
      <span v-if="aceso === no.id" class="volta-hoje">volta hoje</span>
    </div>
  </div>
</template>

<style scoped>
.constelacao {
  contain: layout;
}
.no {
  will-change: transform;
}
.marca-centro {
  display: grid;
  width: 76px;
  height: 76px;
  place-items: center;
  border: 1px solid var(--borda);
  border-radius: 24px;
  background: var(--folha);
  box-shadow: 0 18px 36px -24px color-mix(in oklab, var(--tinta) 55%, transparent);
  font-size: 40px;
  animation: pop 0.6s var(--ease-mola) 0.1s backwards;
}
.pilula-no {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  white-space: nowrap;
  border: 1px solid var(--borda);
  border-radius: 999px;
  background: var(--folha);
  color: var(--tinta);
  transition: border-color 0.3s, box-shadow 0.3s, transform 0.3s var(--ease-saida);
  animation: pop 0.5s var(--ease-mola) backwards;
  animation-delay: calc(var(--i) * 70ms + 350ms);
}
.no[data-nivel='1'] .pilula-no {
  padding: 7px 13px;
  font-size: 14px;
  font-weight: 650;
  box-shadow: 0 10px 24px -18px color-mix(in oklab, var(--tinta) 50%, transparent);
}
.no[data-nivel='2'] .pilula-no {
  padding: 5px 11px;
  border-style: dashed;
  border-color: var(--borda-forte);
  background: color-mix(in oklab, var(--folha) 82%, transparent);
  font-size: 13px;
  color: var(--texto-2);
  animation-delay: calc(var(--i) * 70ms + 900ms);
}
@media (max-width: 640px) {
  .no[data-nivel='1'] .pilula-no {
    padding: 6px 10px;
    font-size: 13px;
  }
  .marca-centro {
    width: 64px;
    height: 64px;
    font-size: 34px;
  }
}
.font-mono-no {
  font-family: 'Cambria Math', 'STIX Two Math', var(--font-sans);
}
.ponto-no {
  width: 9px;
  height: 9px;
  border-radius: 999px;
  background: var(--cor);
}
.no.aceso .pilula-no {
  border-style: solid;
  border-color: var(--acento);
  color: var(--tinta);
  box-shadow: 0 0 0 4px var(--acento-suave);
  transform: scale(1.06);
}
.volta-hoje {
  position: absolute;
  left: 50%;
  top: calc(100% + 6px);
  transform: translateX(-50%);
  white-space: nowrap;
  border-radius: 8px;
  background: var(--acento);
  padding: 2px 8px;
  font-size: 11.5px;
  font-weight: 700;
  color: var(--sobre-acento);
  animation: aparece-desce 0.35s var(--ease-saida) backwards;
}
.quieto .pilula-no,
.quieto .marca-centro,
.quieto .volta-hoje {
  animation: none !important;
}
@media (prefers-reduced-motion: reduce) {
  .pilula-no,
  .marca-centro,
  .volta-hoje {
    animation: none !important;
  }
}
</style>
