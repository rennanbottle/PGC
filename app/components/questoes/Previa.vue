<script setup>
// Prévia da questão como ela aparece no Estudar (só leitura). Texto com código passa pelo <TextoRico>.
// Com "mostrar-gabarito", a resposta certa aparece marcada (cor, visto e a palavra "Certa", nunca só a cor).
// As alternativas aparecem na ordem gravada; no Estudar a ordem é sorteada.
import { Check, X } from '@lucide/vue'
import { LETRAS, OPCOES_ASSERCAO, RE_LACUNA, nomeDoNivel } from '#shared/regras/questoes.js'

const props = defineProps({
  questao: { type: Object, required: true },
  contexto: { type: String, default: '' },
  imagem: { type: String, default: '' },
  mostrarGabarito: { type: Boolean, default: false },
  linguagem: { type: String, default: '' },
  semNivel: { type: Boolean, default: false },
})
const c = computed(() => props.questao.conteudo ?? {})
const tipo = computed(() => props.questao.tipo)
const partesLacuna = computed(() => String(props.questao.enunciado ?? '').split(RE_LACUNA))
const vazio = (t) => !String(t ?? '').trim()
const embaralhar = (lista) => lista.map((x, i) => ({ x, k: (i * 7 + 3) % lista.length })).sort((a, b) => a.k - b.k).map((o) => o.x)
const colunaB = computed(() => embaralhar((c.value.pares ?? []).map((p) => p.b)))
const itensSoltos = computed(() => embaralhar((c.value.itens ?? []).filter((x) => !vazio(x))))
const todosDosGrupos = computed(() => embaralhar((c.value.grupos ?? []).flatMap((g) => g.itens ?? []).filter((x) => !vazio(x))))
const ehLacuna = computed(() => tipo.value === 'lacuna_digitada' || tipo.value === 'lacuna_opcoes')
const respostaVF = computed(() => (tipo.value === 'certo_errado' ? c.value.certo : c.value.verdadeira))
const textoLacuna = (i) => (tipo.value === 'lacuna_digitada'
  ? (c.value.lacunas?.[i]?.respostas ?? []).join(' ou ')
  : c.value.lacunas?.[i]?.opcoes?.[c.value.lacunas?.[i]?.certa] ?? '')
const certa = (ok) => props.mostrarGabarito && ok
</script>

<template>
  <div class="previa">
    <p v-if="contexto || !semNivel" class="m-0 text-[12.5px] font-semibold text-texto-2">
      {{ contexto ? `${contexto}. ` : '' }}<template v-if="!semNivel">{{ nomeDoNivel(questao.nivel) }}</template>
    </p>

    <TextoRico v-if="tipo === 'texto_base' && !vazio(c.textoBase)" class="mt-2 block max-h-[240px] overflow-y-auto rounded-[12px] bg-folha-2 p-3.5 text-[15px] leading-[1.6]" :texto="c.textoBase" :linguagem="linguagem" />

    <img v-if="imagem" :src="imagem" alt="Imagem da questão" class="mt-3 max-h-[260px] max-w-full rounded-[12px] border border-borda">

    <!-- Enunciado (com as lacunas desenhadas) -->
    <p v-if="ehLacuna" class="m-0 mt-1.5 text-[16px] leading-[1.8]">
      <template v-for="(parte, i) in partesLacuna" :key="i">
        {{ parte }}<span
          v-if="i < partesLacuna.length - 1"
          class="mx-0.5 inline-block min-w-[86px] rounded-[6px] px-2 text-center text-[14px] font-semibold leading-[1.6]"
          :class="mostrarGabarito ? 'bg-ok-suave text-ok' : 'bg-folha-3 text-transparent'"
        >{{ textoLacuna(i) || 'lacuna' }}</span>
      </template>
    </p>
    <TextoRico v-else class="mt-1.5 block text-[16px] leading-[1.55]" :texto="vazio(questao.enunciado) ? 'O enunciado aparece aqui.' : questao.enunciado" :linguagem="linguagem" />

    <!-- Escolha -->
    <ul v-if="c.alternativas" class="m-0 mt-3 flex list-none flex-col gap-2 p-0">
      <li
        v-for="(a, i) in c.alternativas"
        :key="i"
        class="flex items-start gap-3 rounded-[12px] border px-3.5 py-2.5 text-[15px]"
        :class="certa(a.correta) ? 'border-ok bg-ok-suave' : 'border-borda'"
      >
        <b class="grid size-6 shrink-0 place-items-center rounded-full text-[12.5px]" :class="certa(a.correta) ? 'bg-ok-vivo text-folha' : 'bg-folha-2 text-texto-2'">
          <Check v-if="certa(a.correta)" :size="14" :stroke-width="3" aria-hidden="true" />
          <template v-else>{{ LETRAS[i] }}</template>
        </b>
        <span class="min-w-0 flex-1">
          <TextoRico :texto="vazio(a.texto) ? 'Alternativa sem texto' : a.texto" :linguagem="linguagem" :class="vazio(a.texto) && 'text-texto-2'" />
          <span v-if="mostrarGabarito && !a.correta && a.erro" class="mt-0.5 block text-[13px] text-texto-2">{{ a.erro }}</span>
        </span>
        <span v-if="certa(a.correta)" class="shrink-0 pt-0.5 text-[13px] font-semibold text-ok">Certa</span>
      </li>
      <li v-if="tipo === 'multipla_resposta'" class="text-[13px] text-texto-2">Marque todas as certas.</li>
    </ul>

    <div v-else-if="tipo === 'verdadeiro_falso' || tipo === 'certo_errado'" class="mt-3">
      <div class="flex flex-wrap gap-2">
        <span
          v-for="(n, i) in (tipo === 'certo_errado' ? ['Certo', 'Errado'] : ['Verdadeiro', 'Falso'])"
          :key="n"
          class="flex items-center gap-2 rounded-[12px] border px-3.5 py-2 text-[15px]"
          :class="certa((i === 0) === respostaVF) ? 'border-ok bg-ok-suave font-semibold text-ok' : 'border-borda'"
        >
          <Check v-if="certa((i === 0) === respostaVF)" :size="15" :stroke-width="2.6" aria-hidden="true" />{{ n }}
        </span>
      </div>
      <TextoRico v-if="mostrarGabarito && c.justificativa" class="mt-2 block text-[14px] text-texto-2" :texto="c.justificativa" :linguagem="linguagem" />
    </div>

    <div v-else-if="tipo === 'assercao_razao'" class="mt-3 flex flex-col gap-2 text-[15px] leading-[1.5]">
      <div class="flex gap-1.5"><b>I.</b> <TextoRico :texto="c.assercao || 'Primeira afirmação'" :linguagem="linguagem" /></div>
      <p class="m-0 text-[12.5px] font-bold text-texto-2">PORQUE</p>
      <div class="flex gap-1.5"><b>II.</b> <TextoRico :texto="c.razao || 'Segunda afirmação'" :linguagem="linguagem" /></div>
      <ul class="m-0 mt-1 flex list-none flex-col gap-1.5 p-0">
        <li
          v-for="o in OPCOES_ASSERCAO"
          :key="o.id"
          class="flex items-center gap-2 rounded-[12px] border px-3 py-2 text-[14px]"
          :class="certa(c.resposta === o.id) ? 'border-ok bg-ok-suave font-semibold text-ok' : 'border-borda'"
        >
          <Check v-if="certa(c.resposta === o.id)" :size="15" :stroke-width="2.6" aria-hidden="true" />{{ o.texto }}
        </li>
      </ul>
    </div>

    <div v-else-if="tipo === 'lacuna_opcoes'" class="mt-3 flex flex-col gap-1.5">
      <p v-for="(l, i) in c.lacunas ?? []" :key="i" class="m-0 text-[14px]"><b>Lacuna {{ i + 1 }}:</b> {{ (l.opcoes ?? []).filter((x) => !vazio(x)).join(', ') || 'sem opções' }}</p>
    </div>
    <div v-else-if="tipo === 'lacuna_digitada' && !mostrarGabarito" class="mt-3">
      <span class="campo flex h-11 max-w-[320px] items-center text-texto-3">Resposta</span>
    </div>

    <div v-else-if="tipo === 'associar'" class="mt-3 grid gap-2 text-[14.5px]" :class="mostrarGabarito ? 'grid-cols-1' : 'grid-cols-2'">
      <template v-if="mostrarGabarito">
        <span v-for="(p, i) in c.pares ?? []" :key="i" class="flex flex-wrap items-center gap-2 rounded-[12px] border border-borda px-3 py-2">
          <b>{{ p.a || 'Item' }}</b><span class="text-texto-3" aria-hidden="true">=</span><span class="sr-only">combina com</span>{{ p.b || 'Par' }}
        </span>
      </template>
      <template v-else>
        <div class="flex flex-col gap-2">
          <span v-for="(p, i) in c.pares ?? []" :key="i" class="flex gap-2 rounded-[12px] border border-borda px-3 py-2"><b class="text-texto-3">{{ i + 1 }}</b>{{ p.a || 'Item' }}</span>
        </div>
        <div class="flex flex-col gap-2">
          <span v-for="(b, i) in colunaB" :key="i" class="rounded-[12px] bg-folha-2 px-3 py-2">{{ b || 'Par' }}</span>
        </div>
      </template>
    </div>

    <ol v-else-if="tipo === 'ordenar'" class="m-0 mt-3 flex list-none flex-col gap-2 p-0">
      <li v-for="(x, i) in (mostrarGabarito ? c.itens : itensSoltos)" :key="i" class="flex gap-3 rounded-[12px] border border-borda px-3.5 py-2 text-[15px]">
        <b class="w-4 text-texto-3">{{ mostrarGabarito ? i + 1 : '' }}</b>{{ x }}
      </li>
    </ol>

    <div v-else-if="tipo === 'classificar'" class="mt-3">
      <div v-if="!mostrarGabarito" class="flex flex-wrap gap-2">
        <span v-for="(x, i) in todosDosGrupos" :key="i" class="rounded-[10px] bg-folha-2 px-3 py-1 text-[14px]">{{ x }}</span>
      </div>
      <div class="mt-3 grid gap-2 sm:grid-cols-2">
        <div v-for="(g, i) in c.grupos ?? []" :key="i" class="rounded-[12px] border border-borda px-3 py-2.5">
          <p class="m-0 text-[14px] font-semibold">{{ g.nome || `Grupo ${i + 1}` }}</p>
          <p v-if="mostrarGabarito" class="m-0 mt-1 text-[13.5px] text-texto-2">{{ (g.itens ?? []).filter((x) => !vazio(x)).join(', ') }}</p>
        </div>
      </div>
    </div>

    <div v-else-if="tipo === 'numerica' && (c.respostas ?? []).length >= 2" class="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2">
      <span v-for="(r, i) in c.respostas" :key="i" class="flex items-center gap-2">
        <TextoRico :texto="`$${r.rotulo || `x_${i + 1}`} =$`" tag="span" class="text-[17px]" />
        <span class="flex h-11 min-w-[90px] items-center rounded-[12px] border px-3.5 text-[15px]" :class="mostrarGabarito ? 'border-ok bg-ok-suave font-semibold text-ok' : 'border-borda-campo text-texto-3'">
          {{ mostrarGabarito && typeof r.valor === 'number' ? String(r.valor).replace('.', ',') : 'Número' }}
        </span>
      </span>
      <span v-if="c.unidade" class="text-[15px]">{{ c.unidade }}</span>
    </div>
    <div v-else-if="tipo === 'numerica'" class="mt-3 flex flex-wrap items-center gap-2">
      <TextoRico v-if="c.rotulo" :texto="`$${c.rotulo} =$`" tag="span" class="text-[17px]" />
      <span class="flex h-11 min-w-[140px] items-center rounded-[12px] border px-3.5 text-[15px]" :class="mostrarGabarito ? 'border-ok bg-ok-suave font-semibold text-ok' : 'border-borda-campo text-texto-3'">
        {{ mostrarGabarito && typeof c.resposta === 'number' ? String(c.resposta).replace('.', ',') : 'Número' }}
      </span>
      <span v-if="c.unidade" class="text-[15px]">{{ c.unidade }}</span>
      <span v-if="mostrarGabarito && Number(c.tolerancia) > 0" class="text-[13px] text-texto-2">aceita {{ String(c.tolerancia).replace('.', ',') }}% para mais ou para menos</span>
    </div>

    <ol v-else-if="tipo === 'encontrar_erro'" class="m-0 mt-3 flex list-none flex-col gap-2 p-0">
      <li
        v-for="(l, i) in c.linhas ?? []"
        :key="i"
        class="flex items-start gap-3 rounded-[12px] border px-3.5 py-2"
        :class="mostrarGabarito && c.errada === i ? 'border-erro bg-erro-suave' : 'border-borda'"
      >
        <b class="w-4 shrink-0 pt-0.5 text-[13px] text-texto-3">{{ i + 1 }}</b>
        <span class="min-w-0 flex-1">
          <span class="font-mono text-[14px]">{{ l || 'Passo' }}</span>
          <span v-if="mostrarGabarito && c.errada === i && c.correcao" class="mt-1 flex items-start gap-1.5 text-[13.5px] text-ok"><Check :size="14" :stroke-width="2.6" class="mt-0.5 shrink-0" aria-hidden="true" />{{ c.correcao }}</span>
        </span>
        <span v-if="mostrarGabarito && c.errada === i" class="flex shrink-0 items-center gap-1 pt-0.5 text-[13px] font-semibold text-erro"><X :size="14" :stroke-width="2.6" aria-hidden="true" />Passo errado</span>
      </li>
    </ol>

    <div v-else-if="tipo === 'cartao'" class="mt-3 rounded-[12px] bg-folha-2 p-4 text-[15px]">
      <TextoRico v-if="mostrarGabarito" :texto="c.verso || 'Verso vazio'" :linguagem="linguagem" />
      <span v-else class="text-texto-2">Escreva a resposta e depois vire o cartão.</span>
    </div>

    <div v-else-if="tipo === 'resposta_curta' || tipo === 'explicar'" class="mt-3">
      <span class="campo flex h-[84px] items-start py-3 text-texto-3">Sua resposta</span>
    </div>
  </div>
</template>
