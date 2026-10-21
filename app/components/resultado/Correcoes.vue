<script setup>
// Questões e correções do resultado (estudo e prova). Em cima, o mapa: um quadrado por questão com o número e o
// ícone do resultado; clicar abre a correção daquela questão. Depois, as abas com a contagem (Erradas 12, Certas 7...)
// e a lista. Cada linha mostra o resultado, o tipo, o nível e o tempo; aberta, mostra a sua resposta e a certa lado a
// lado, por que errou, a explicação e o trecho do material, com um botão para abrir a próxima da lista.
// Cada correção chega já no formato daqui:
// { id, numero, enunciado, resultado ('correta' | 'parcial' | 'incorreta' | 'em_branco'), incerta, sua, certa, erro,
//   explicacao, trecho, tipo, nivel, segundos, pontos, dicas, assunto, questaoId, bloco }
import { BookOpen, ChevronDown, ChevronsDownUp, ChevronsUpDown, Circle, CircleAlert, CircleCheck, CircleX, Clock, Lightbulb, TriangleAlert } from '@lucide/vue'
import { nomeDoNivel, nomeDoTipo, trechoParaLista } from '#shared/regras/questoes.js'

const props = defineProps({
  correcoes: { type: Array, required: true },
  mapa: { type: Boolean, default: true },
  blocos: { type: Array, default: () => [] }, // [{ valor, texto, descricao }] quando o estudo tem mais de um bloco
  palavraParcial: { type: String, default: 'Parcial' },
})

const TOM = {
  correta: { tipo: 'ok', icone: CircleCheck, palavra: 'Certa', texto: 'text-ok' },
  parcial: { tipo: 'aviso', icone: CircleAlert, palavra: 'Parcial', texto: 'text-aviso' },
  incorreta: { tipo: 'erro', icone: CircleX, palavra: 'Errada', texto: 'text-erro' },
  em_branco: { tipo: 'branco', icone: Circle, palavra: 'Em branco', texto: 'text-texto-2' },
}
const tomDe = (c) => {
  const t = TOM[c.resultado] ?? TOM.em_branco
  return c.resultado === 'parcial' ? { ...t, palavra: props.palavraParcial } : t
}
const tempo = (seg) => {
  const s = Math.max(0, Math.round(Number(seg) || 0))
  if (!s) return ''
  return s >= 60 ? `${Math.floor(s / 60)} min${s % 60 ? ` ${s % 60} s` : ''}` : `${s} s`
}

// ---------- Abas ----------
const FILTROS = computed(() => {
  const l = props.correcoes
  return [
    { valor: 'erradas', texto: 'Erradas', n: l.filter((c) => c.resultado === 'incorreta').length },
    { valor: 'parciais', texto: props.palavraParcial === 'Parcial' ? 'Parciais' : 'Meio certas', n: l.filter((c) => c.resultado === 'parcial').length },
    { valor: 'branco', texto: 'Em branco', n: l.filter((c) => c.resultado === 'em_branco' || !c.resultado).length },
    { valor: 'incertas', texto: 'Certas, mas incertas', n: l.filter((c) => c.incerta && c.resultado === 'correta').length },
    { valor: 'certas', texto: 'Certas', n: l.filter((c) => c.resultado === 'correta').length },
    { valor: 'todas', texto: 'Todas', n: l.length },
  ].filter((f) => f.n || f.valor === 'todas')
})
const filtro = ref(FILTROS.value.some((f) => f.valor === 'erradas') ? 'erradas' : 'todas')
const bloco = ref(-1)
const passa = (c, f) => {
  if (f === 'erradas') return c.resultado === 'incorreta'
  if (f === 'parciais') return c.resultado === 'parcial'
  if (f === 'branco') return c.resultado === 'em_branco' || !c.resultado
  if (f === 'incertas') return c.incerta && c.resultado === 'correta'
  if (f === 'certas') return c.resultado === 'correta'
  return true
}
const visiveis = computed(() => props.correcoes.filter((c) => (bloco.value < 0 || c.bloco === bloco.value) && passa(c, filtro.value)))

// ---------- Abrir e fechar ----------
const abertas = ref(new Set())
const todasAbertas = computed(() => visiveis.value.length > 0 && visiveis.value.every((c) => abertas.value.has(c.id)))
function alternar(id) {
  const s = new Set(abertas.value)
  if (s.has(id)) s.delete(id)
  else s.add(id)
  abertas.value = s
}
function alternarTodas() {
  abertas.value = todasAbertas.value ? new Set() : new Set(visiveis.value.map((c) => c.id))
}
function rolarAte(id) {
  nextTick(() => document.getElementById(`correcao-linha-${id}`)?.scrollIntoView({ block: 'start', behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' }))
}
// Do mapa ou do cartão-resposta: troca a aba se a questão não estiver nela, abre e rola até ela.
function abrir(id) {
  const c = props.correcoes.find((x) => x.id === id)
  if (!c) return
  if (!visiveis.value.includes(c)) {
    bloco.value = -1
    filtro.value = 'todas'
  }
  abertas.value = new Set([...abertas.value, id])
  rolarAte(id)
}
// A próxima da lista atual: fecha esta, abre a seguinte.
function proxima(c) {
  const i = visiveis.value.indexOf(c)
  const seguinte = visiveis.value[i + 1]
  if (!seguinte) return
  const s = new Set(abertas.value)
  s.delete(c.id)
  s.add(seguinte.id)
  abertas.value = s
  rolarAte(seguinte.id)
}
defineExpose({ abrir })
</script>

<template>
  <div>
    <!-- Mapa -->
    <div v-if="mapa && correcoes.length > 1" class="cartao-p">
      <p class="m-0 text-[13.5px] font-semibold text-texto-2">Mapa das questões</p>
      <ol class="mapa-questoes m-0 mt-2.5 grid list-none gap-1.5 p-0" aria-label="Mapa das questões">
        <li v-for="(c, i) in correcoes" :key="c.id">
          <button
            type="button"
            class="quadro-questao"
            :data-tom="tomDe(c).tipo"
            :style="{ animationDelay: `${Math.min(i, 40) * 18 + 100}ms` }"
            :aria-label="`Questão ${c.numero}: ${tomDe(c).palavra.toLowerCase()}. Abrir a correção`"
            @click="abrir(c.id)"
          >
            <b class="tabular-nums">{{ c.numero }}</b>
            <component :is="tomDe(c).icone" :size="12" :stroke-width="2.6" aria-hidden="true" />
          </button>
        </li>
      </ol>
    </div>

    <!-- Abas -->
    <div class="mt-4 flex flex-wrap items-center justify-between gap-3">
      <div role="radiogroup" aria-label="Mostrar" class="flex flex-wrap gap-2">
        <button v-for="f in FILTROS" :key="f.valor" type="button" class="pilula" role="radio" :aria-checked="filtro === f.valor" @click="filtro = f.valor">
          {{ f.texto }}<span class="contagem-aba tabular-nums">{{ f.n }}</span>
        </button>
      </div>
      <div class="flex flex-wrap items-center gap-2">
        <Selecao v-if="blocos.length" v-model="bloco" variante="filtro" prefixo="Bloco" :opcoes="[{ valor: -1, texto: 'Todos' }, ...blocos]" />
        <button v-if="visiveis.length > 1" type="button" class="botao-fantasma gap-2 text-[14px]" @click="alternarTodas">
          <ChevronsDownUp v-if="todasAbertas" :size="16" :stroke-width="2.2" aria-hidden="true" /><ChevronsUpDown v-else :size="16" :stroke-width="2.2" aria-hidden="true" />{{ todasAbertas ? 'Fechar todas' : 'Abrir todas' }}
        </button>
      </div>
    </div>

    <!-- Lista -->
    <TransitionGroup name="lista" tag="ul" class="m-0 mt-3 flex list-none flex-col gap-2 p-0">
      <li v-if="!visiveis.length" key="vazio" class="cartao-p text-[14px] text-texto-2">Nenhuma questão nesta aba.</li>
      <li v-for="c in visiveis" :id="`correcao-linha-${c.id}`" :key="c.id" class="item-correcao" :data-tom="tomDe(c).tipo" :class="abertas.has(c.id) && 'aberto'">
        <button type="button" class="flex w-full cursor-pointer items-start gap-3.5 border-0 bg-transparent px-4 py-3.5 text-left text-tinta" :aria-expanded="abertas.has(c.id)" :aria-controls="`correcao-${c.id}`" @click="alternar(c.id)">
          <span class="quadro-questao grande shrink-0" :data-tom="tomDe(c).tipo" aria-hidden="true"><b class="tabular-nums">{{ c.numero }}</b></span>
          <span class="min-w-0 flex-1">
            <TextoRico :texto="trechoParaLista(c.enunciado, 160)" tag="span" class="block text-[15px] font-semibold leading-snug" />
            <span class="mt-1.5 flex flex-wrap items-center gap-x-3.5 gap-y-1 text-[13px] text-texto-2">
              <span class="selo" :data-tipo="tomDe(c).tipo === 'branco' ? undefined : tomDe(c).tipo"><component :is="tomDe(c).icone" :size="13" :stroke-width="2.4" aria-hidden="true" />{{ tomDe(c).palavra }}</span>
              <span v-if="c.incerta && c.resultado === 'correta'" class="font-semibold">Marcada como incerta</span>
              <span>{{ nomeDoTipo(c.tipo) }}</span>
              <span v-if="c.nivel">{{ nomeDoNivel(c.nivel) }}</span>
              <span v-if="tempo(c.segundos)" class="flex items-center gap-1"><Clock :size="13" :stroke-width="2.2" aria-hidden="true" /><span class="so-leitor">Tempo:</span>{{ tempo(c.segundos) }}</span>
              <span v-if="c.assunto" class="hidden md:inline">{{ c.assunto }}</span>
            </span>
          </span>
          <ChevronDown :size="18" :stroke-width="2" class="seta-correcao mt-1.5 shrink-0 text-texto-2" aria-hidden="true" />
        </button>
        <Transition name="abre">
          <div v-if="abertas.has(c.id)" :id="`correcao-${c.id}`">
            <div class="px-4 pb-4 sm:pl-[66px]">
              <TextoRico :texto="c.enunciado" class="text-[15.5px] leading-[1.6]" />

              <div class="mt-4 grid gap-3" :class="c.resultado !== 'correta' && 'sm:grid-cols-2'">
                <div class="caixa-resposta" :data-tom="tomDe(c).tipo">
                  <p class="m-0 flex items-center gap-1.5 text-[13px] font-semibold" :class="tomDe(c).texto"><component :is="tomDe(c).icone" :size="15" :stroke-width="2.4" aria-hidden="true" />{{ c.resultado === 'correta' ? 'Sua resposta, certa' : 'Sua resposta' }}</p>
                  <TextoRico :texto="c.sua || 'Em branco'" class="mt-1.5 text-[15px] font-semibold" />
                </div>
                <div v-if="c.resultado !== 'correta'" class="caixa-resposta" data-tom="ok">
                  <p class="m-0 flex items-center gap-1.5 text-[13px] font-semibold text-ok"><CircleCheck :size="15" :stroke-width="2.4" aria-hidden="true" />A certa</p>
                  <TextoRico :texto="c.certa" class="mt-1.5 text-[15px] font-semibold" />
                </div>
              </div>

              <div v-if="c.erro" class="mt-3 flex gap-2.5 rounded-[12px] bg-aviso-suave px-3.5 py-3 text-[14.5px] leading-[1.55]">
                <TriangleAlert :size="17" :stroke-width="2.2" class="mt-0.5 shrink-0 text-aviso" aria-hidden="true" />
                <div class="min-w-0"><b>Por que errou.</b> <TextoRico :texto="c.erro" tag="span" /></div>
              </div>

              <div v-if="c.explicacao" class="mt-4">
                <p class="m-0 flex items-center gap-2 text-[14px] font-semibold"><Lightbulb :size="16" :stroke-width="2.2" class="text-acento" aria-hidden="true" />Explicação</p>
                <TextoRico :texto="c.explicacao" class="mt-1.5 max-w-[760px] text-[15px] leading-[1.6]" />
              </div>
              <GraficoDaQuestao :enunciado="c.enunciado" :explicacao="c.explicacao" />

              <figure v-if="c.trecho" class="m-0 mt-4 border-l-[3px] border-borda-forte pl-3.5">
                <figcaption class="flex items-center gap-1.5 text-[13px] font-semibold text-texto-2"><BookOpen :size="14" :stroke-width="2.2" aria-hidden="true" />No material<template v-if="c.trecho.pagina">, página {{ c.trecho.pagina }}</template></figcaption>
                <blockquote class="m-0 mt-1 text-[14.5px] leading-[1.55] text-texto-2">{{ c.trecho.texto.slice(0, 320) }}{{ c.trecho.texto.length > 320 ? '...' : '' }}</blockquote>
              </figure>

              <div class="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-borda pt-3 text-[13px] text-texto-2">
                <span class="flex flex-wrap gap-x-3.5 gap-y-1">
                  <span v-if="c.dicas">{{ c.dicas }} {{ c.dicas === 1 ? 'dica usada' : 'dicas usadas' }}</span>
                  <span v-if="c.pontos !== undefined && c.pontos !== null">{{ c.pontos ? `+${c.pontos} ${c.pontos === 1 ? 'ponto' : 'pontos'}` : 'Sem pontos' }}</span>
                  <NuxtLink v-if="c.questaoId" :to="`/questoes/${c.questaoId}`" class="link">Abrir no banco de questões</NuxtLink>
                </span>
                <button v-if="visiveis.indexOf(c) < visiveis.length - 1" type="button" class="botao-secundario gap-2 text-[14px]" @click="proxima(c)">Abrir a próxima</button>
              </div>
            </div>
          </div>
        </Transition>
      </li>
    </TransitionGroup>
  </div>
</template>

<style scoped>
.mapa-questoes {
  grid-template-columns: repeat(auto-fill, minmax(44px, 1fr));
}
.quadro-questao {
  display: inline-flex;
  width: 100%;
  height: 44px;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 1px;
  border: 1px solid var(--borda-forte);
  border-radius: 10px;
  background: var(--folha);
  color: var(--texto-2);
  font: inherit;
  font-size: 13.5px;
  line-height: 1;
  cursor: pointer;
  animation: aparece 0.35s ease backwards;
  transition: transform 0.15s var(--ease-saida), box-shadow 0.15s;
}
button.quadro-questao:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 16px -10px color-mix(in oklab, var(--tinta) 40%, transparent);
}
.quadro-questao[data-tom='ok'] {
  border-color: color-mix(in oklab, var(--ok-vivo) 45%, var(--borda));
  background: var(--ok-suave);
  color: var(--ok);
}
.quadro-questao[data-tom='erro'] {
  border-color: color-mix(in oklab, var(--erro-vivo) 45%, var(--borda));
  background: var(--erro-suave);
  color: var(--erro);
}
.quadro-questao[data-tom='aviso'] {
  border-color: color-mix(in oklab, var(--aviso-vivo) 50%, var(--borda));
  background: var(--aviso-suave);
  color: var(--aviso);
}
.quadro-questao.grande {
  width: 38px;
  height: 38px;
  font-size: 14.5px;
  cursor: inherit;
  animation: none;
}
.item-correcao {
  scroll-margin-top: 88px;
  overflow: hidden;
  border: 1px solid var(--borda);
  border-radius: 16px;
  background: var(--folha);
  transition: border-color 0.2s, box-shadow 0.2s;
}
.item-correcao:hover {
  border-color: var(--borda-forte);
}
.item-correcao.aberto {
  border-color: var(--borda-forte);
  box-shadow: 0 14px 28px -22px color-mix(in oklab, var(--tinta) 45%, transparent);
}
.seta-correcao {
  transition: transform 0.25s var(--ease-saida), color 0.15s;
}
.item-correcao.aberto .seta-correcao {
  transform: rotate(180deg);
}
.item-correcao > button:hover .seta-correcao {
  color: var(--acento);
}
.caixa-resposta {
  border: 1px solid var(--borda);
  border-radius: 12px;
  background: var(--folha-2);
  padding: 11px 14px;
}
.caixa-resposta[data-tom='ok'] {
  border-color: color-mix(in oklab, var(--ok-vivo) 40%, var(--borda));
  background: var(--ok-suave);
}
.caixa-resposta[data-tom='erro'] {
  border-color: color-mix(in oklab, var(--erro-vivo) 40%, var(--borda));
  background: var(--erro-suave);
}
.caixa-resposta[data-tom='aviso'] {
  border-color: color-mix(in oklab, var(--aviso-vivo) 45%, var(--borda));
  background: var(--aviso-suave);
}
.contagem-aba {
  min-width: 22px;
  border-radius: 999px;
  background: var(--folha-3);
  padding: 1px 7px;
  font-size: 12px;
  font-weight: 700;
  color: var(--tinta);
  text-align: center;
}
@media (prefers-reduced-motion: reduce) {
  .quadro-questao,
  .seta-correcao {
    animation: none;
    transition: none;
  }
}
</style>
