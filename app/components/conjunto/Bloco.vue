<script setup>
// Um bloco do conjunto, como cartão que abre e fecha. Fechado: tipo, nome, uma linha sobre o que ele faz e quantas
// questões tem de verdade (da prévia do servidor). Aberto: assuntos, de onde vêm as questões, quantas,
// dificuldade, formatos e como o bloco funciona (ordem, nível, dicas, fórmulas, cronômetro, correção, avançar,
// repetir). O bloco é um objeto reativo do conjunto: as mudanças aqui já valem lá.
import { ChevronDown, ChevronUp, Copy, Lock, RotateCcw, Target, Trash2, TriangleAlert } from '@lucide/vue'
import { CORRECOES, ORIGENS_BLOCO, TIPOS_BLOCO, resumoDoBloco } from '#shared/regras/conjuntos.js'
import { niveisAlvo } from '#shared/regras/revisoes.js'
import { NIVEIS, TIPOS, nomeDoNivel } from '#shared/regras/questoes.js'
import { distribuir } from '#shared/regras/gerar.js'

const props = defineProps({
  bloco: { type: Object, required: true },
  numero: { type: Number, required: true },
  aberto: { type: Boolean, default: false },
  primeiro: { type: Boolean, default: false },
  ultimo: { type: Boolean, default: false },
  podeDuplicar: { type: Boolean, default: true },
  info: { type: Object, required: true }, // { [assuntoId]: { nome, cor } }
  arvore: { type: Array, required: true },
  previa: { type: Object, default: null },
  maxNivel: { type: Number, default: 3 },
  disfarcarLiberado: { type: Boolean, default: false },
  cota: { type: Object, default: () => ({ usadas: 0, limite: 30 }) },
})
const emit = defineEmits(['alternar', 'subir', 'descer', 'duplicar', 'remover'])
const b = props.bloco
const id = useId()
const janelaAssuntos = ref(null)
const verTipos = ref(false)

const nomes = computed(() => Object.fromEntries(Object.entries(props.info).map(([k, v]) => [k, v.nome])))
const resumo = computed(() => resumoDoBloco(b, nomes.value))
const deErros = computed(() => b.origem === 'erros_conjunto')
const Icone = computed(() => (b.tipo === 'pratica' ? Target : RotateCcw))
const somaPesos = computed(() => b.assuntos.reduce((s, a) => s + a.peso, 0))
const pct = (a) => (somaPesos.value ? Math.round((a.peso / somaPesos.value) * 100) : 0)

const qtdTexto = computed(() => {
  const p = props.previa
  if (!p) return `${b.quantidade} ${b.quantidade === 1 ? 'questão' : 'questões'}`
  if (p.adiado) return `até ${b.quantidade}, ${p.minutos} min`
  return `${p.total} ${p.total === 1 ? 'questão' : 'questões'}, ${p.minutos} min`
})
const aviso = computed(() => {
  const p = props.previa
  if (!p || p.adiado || !p.faltam) return null
  if (p.podeCompletar) return { texto: `Você pediu ${p.pedidas} e o banco tem ${p.total}.`, sub: 'O PGC tenta completar com o que você marcou ao começar.' }
  if (b.tipo === 'revisao' && b.origem === 'vencidas' && !b.completarNovas) return { texto: `Você pediu ${p.pedidas} e há ${p.total} já respondidas.`, sub: 'Completar com novas do banco ou ficar com essas?', acao: 'novas' }
  if (b.tipo === 'pratica' && !b.completarMaterial) return { texto: `Você pediu ${p.pedidas} e há ${p.total} novas.`, sub: 'Completar com questões do material, sem IA?', acao: 'material' }
  return { texto: `Você pediu ${p.pedidas} e há ${p.total}.`, sub: 'O bloco vai com as que existem.' }
})
function resolver(acao) {
  if (acao === 'novas') b.completarNovas = true
  if (acao === 'material') b.completarMaterial = true
}

// Origem e tipo: opções que não valem para o tipo somem.
function mudarOrigem(o) {
  b.origem = o
  if (o === 'erros_conjunto') b.repetir = true
}

// Dificuldade
const MODOS_DIF = [['fixa', 'Fixa'], ['curva', 'Curva'], ['aleatoria', 'Aleatória'], ['distribuir', 'Distribuir'], ['adaptativa', 'Adaptativa']]
const niveisLiberados = computed(() => NIVEIS.filter((n) => n.valor <= props.maxNivel))
const curva = computed(() => niveisAlvo({ ...b.dificuldade, modo: 'curva' }, Math.min(b.quantidade, 30), () => 0.5))
function modoDif(m) {
  b.dificuldade.modo = m
  if (m === 'distribuir') {
    const [x, y, z] = distribuir(b.quantidade, [0, 40, 60])
    b.dificuldade.contas = { 1: x, 2: y, 3: z, 4: 0, 5: 0 }
  }
  if (m === 'aleatoria' && !b.dificuldade.niveis?.length) b.dificuldade.niveis = [2, 3]
}
const somaContas = computed(() => [1, 2, 3, 4, 5].reduce((s, n) => s + (b.dificuldade.contas?.[n] ?? 0), 0))
function mudarConta(n, v) {
  b.dificuldade.contas = { ...b.dificuldade.contas, [n]: v }
  b.quantidade = Math.max(1, Math.min(60, somaContas.value))
}
function alternarLista(lista, v) {
  const i = lista.indexOf(v)
  if (i >= 0) lista.splice(i, 1)
  else lista.push(v)
}
const nomesTipos = computed(() => TIPOS.filter((t) => b.tipos.includes(t.id)).map((t) => t.nome.toLowerCase()))

// Quadro "de onde saem as N".
const fonte = computed(() => {
  const p = props.previa
  if (!p || p.adiado) return null
  const banco = p.total - (p.completadasComNovas ?? 0)
  return { banco, novas: p.completadasComNovas ?? 0, faltam: p.faltam, excluidas: p.excluidas }
})
</script>

<template>
  <section class="rounded-[14px] bg-campo p-4" :class="aberto ? 'border-[1.5px] border-tinta' : 'border border-borda'" :aria-labelledby="`${id}-nome`">
    <!-- Cabeçalho -->
    <div class="flex items-start gap-3" :class="aberto && 'border-b border-borda pb-4'">
      <span class="mt-0.5 grid size-7 shrink-0 place-items-center rounded-full border border-borda-campo text-[13px] font-bold tabular-nums" aria-hidden="true">{{ numero }}</span>
      <div class="min-w-0 flex-1">
        <div class="flex flex-wrap items-center gap-2">
          <span class="inline-flex h-7 shrink-0 items-center gap-1.5 rounded-[7px] border border-borda-campo px-2.5 text-[13px] font-semibold"><component :is="Icone" :size="14" :stroke-width="2.1" aria-hidden="true" />{{ TIPOS_BLOCO[b.tipo].nome }}</span>
          <input v-if="aberto" :id="`${id}-nome`" v-model="b.nome" class="min-w-0 flex-1 border-0 border-b border-borda-campo bg-transparent px-0 py-0.5 text-[16.5px] font-semibold text-tinta outline-none focus:border-tinta" maxlength="60" :aria-label="`Nome do bloco ${numero}`">
          <b v-else :id="`${id}-nome`" class="text-[16.5px]">{{ b.nome }}</b>
        </div>
        <p class="m-0 mt-1 text-[13.5px] leading-snug text-texto-2">{{ resumo }}</p>
        <p v-if="aviso && !aberto" class="m-0 mt-2 flex items-start gap-2 text-[13px]">
          <TriangleAlert :size="15" :stroke-width="2" class="mt-0.5 shrink-0" aria-hidden="true" />
          <span>{{ aviso.texto }} <span class="text-texto-2">{{ aviso.sub }}</span> <button v-if="aviso.acao" type="button" class="link cursor-pointer border-0 bg-transparent p-0 text-[13px]" @click="resolver(aviso.acao)">Completar</button></span>
        </p>
      </div>
      <b class="shrink-0 whitespace-nowrap pt-1 text-[14px] tabular-nums">{{ qtdTexto }}</b>
      <MenuAcoes
        v-if="!aberto"
        :rotulo="`Ações do bloco ${numero}`"
        :itens="[
          { id: 'subir', texto: 'Subir', desativado: primeiro },
          { id: 'descer', texto: 'Descer', desativado: ultimo },
          { id: 'duplicar', texto: 'Duplicar', desativado: !podeDuplicar },
          { id: 'remover', texto: 'Remover bloco', perigo: true, separar: true },
        ]"
        @escolher="emit($event)"
      />
      <button type="button" class="grid size-9 shrink-0 cursor-pointer place-items-center rounded-full border border-borda bg-transparent text-tinta" :aria-expanded="aberto" :aria-label="aberto ? `Fechar o bloco ${numero}` : `Abrir o bloco ${numero}`" @click="emit('alternar')">
        <ChevronUp v-if="aberto" :size="18" :stroke-width="2" aria-hidden="true" /><ChevronDown v-else :size="18" :stroke-width="2" aria-hidden="true" />
      </button>
    </div>

    <template v-if="aberto">
      <div class="mt-4 grid gap-6 md:grid-cols-2">
        <!-- Conteúdo e quantidade -->
        <div class="min-w-0">
          <p class="m-0 mb-2 text-[13.5px] font-semibold">Assuntos</p>
          <p v-if="deErros" class="m-0 text-[14px] text-texto-2">Usa os assuntos dos outros blocos.</p>
          <div v-else class="flex flex-wrap items-center gap-2">
            <span v-for="a in b.assuntos" :key="a.id" class="inline-flex h-9 items-center gap-2 rounded-[9px] border border-borda-campo bg-campo px-3 text-[14px] font-semibold">
              <span class="size-2 shrink-0 rounded-full" :style="{ background: `${corMateria(info[a.id]?.cor ?? 'cinza')}` }" aria-hidden="true" />{{ info[a.id]?.nome ?? 'Assunto apagado' }}<span class="font-normal tabular-nums text-texto-2">{{ pct(a) }}%</span>
            </span>
            <span v-if="!b.assuntos.length" class="text-[14px] text-texto-2">Nenhum marcado.</span>
            <button type="button" class="link cursor-pointer border-0 bg-transparent p-0 text-[14px]" @click="janelaAssuntos?.abrir()">{{ b.assuntos.length ? 'Trocar assuntos' : 'Escolher assuntos' }}</button>
          </div>

          <div class="mt-5 flex flex-wrap items-center gap-3">
            <p class="m-0 text-[13.5px] font-semibold">Quantas</p>
            <EntradaContador v-model="b.quantidade" :min="1" :max="60" :rotulo="`Quantas questões no bloco ${numero}`" />
            <span class="text-[12.5px] text-texto-2">{{ deErros ? 'no máximo' : 'de 1 a 60' }}</span>
          </div>

          <fieldset class="m-0 mt-5 min-w-0 border-0 p-0">
            <legend class="mb-2 flex w-full flex-wrap items-baseline justify-between gap-2">
              <span class="text-[13.5px] font-semibold">Dificuldade</span>
              <span class="flex flex-wrap gap-x-3.5 gap-y-1 text-[13px]">
                <button v-for="[m, n] in MODOS_DIF" :key="m" type="button" class="cursor-pointer border-0 border-b-2 bg-transparent px-0 pb-0.5 font-semibold" :class="b.dificuldade.modo === m ? 'border-tinta text-tinta' : 'border-transparent text-texto-2 hover:text-tinta'" :aria-pressed="b.dificuldade.modo === m" @click="modoDif(m)">{{ n }}</button>
              </span>
            </legend>
            <div v-if="b.dificuldade.modo === 'fixa'" class="flex flex-wrap gap-2">
              <label v-for="n in NIVEIS" :key="n.valor" class="pilula" :class="n.valor > maxNivel && 'opacity-55'">
                <input v-model.number="b.dificuldade.nivel" type="radio" :name="`${id}-nivel`" :value="n.valor" class="so-leitor" :disabled="n.valor > maxNivel">
                <Lock v-if="n.valor > maxNivel" :size="13" :stroke-width="2" aria-hidden="true" />{{ n.nome }}
              </label>
            </div>
            <div v-else-if="b.dificuldade.modo === 'curva'">
              <div class="flex flex-wrap gap-2">
                <label v-for="[f, n] in [['crescente', 'Crescente'], ['decrescente', 'Decrescente'], ['ondas', 'Em ondas'], ['misturada', 'Misturada']]" :key="f" class="pilula">
                  <input v-model="b.dificuldade.forma" type="radio" :name="`${id}-forma`" :value="f" class="so-leitor">{{ n }}
                </label>
              </div>
              <div class="mt-3 flex flex-wrap items-center gap-2 text-[14px]">
                de <span class="w-[160px]"><Selecao v-model="b.dificuldade.de" :opcoes="niveisLiberados.map((n) => ({ valor: n.valor, texto: n.nome }))" :rotulo="`Nível inicial do bloco ${numero}`" :busca="false" /></span>
                até <span class="w-[160px]"><Selecao v-model="b.dificuldade.ate" :opcoes="niveisLiberados.map((n) => ({ valor: n.valor, texto: n.nome }))" :rotulo="`Nível final do bloco ${numero}`" :busca="false" /></span>
              </div>
              <div class="mt-3 flex h-[36px] items-end gap-[2px] border-b border-borda" aria-hidden="true">
                <span v-for="(n, i) in curva" :key="i" class="flex-1 rounded-t-[2px]" :style="{ height: `${n * 7}px`, background: n >= 3 ? 'var(--tinta)' : 'var(--borda-campo)' }" />
              </div>
              <p class="m-0 mt-1 flex justify-between text-[12px] text-texto-2"><span>começa no {{ nomeDoNivel(curva[0]) }}</span><span>termina no {{ nomeDoNivel(curva.at(-1)) }}</span></p>
            </div>
            <div v-else-if="b.dificuldade.modo === 'aleatoria'" class="flex flex-wrap gap-2">
              <label v-for="n in niveisLiberados" :key="n.valor" class="pilula">
                <input type="checkbox" class="so-leitor" :checked="b.dificuldade.niveis.includes(n.valor)" @change="alternarLista(b.dificuldade.niveis, n.valor)">{{ n.nome }}
              </label>
              <p class="m-0 w-full text-[12.5px] text-texto-2">Cada questão sorteia um dos níveis marcados.</p>
            </div>
            <div v-else-if="b.dificuldade.modo === 'distribuir'" class="flex flex-col gap-2">
              <div v-for="n in niveisLiberados" :key="n.valor" class="grid grid-cols-[100px_1fr_auto] items-center gap-3 text-[14px]">
                <span>{{ n.nome }}</span>
                <span class="h-2 rounded-full bg-borda" aria-hidden="true"><span class="block h-full rounded-full bg-tinta" :style="{ width: `${somaContas ? ((b.dificuldade.contas[n.valor] ?? 0) / somaContas) * 100 : 0}%` }" /></span>
                <EntradaContador :model-value="b.dificuldade.contas[n.valor] ?? 0" :min="0" :max="60" :pode-mais="somaContas < 60" :rotulo="`Questões no nível ${n.nome}`" @update:model-value="mudarConta(n.valor, $event)" />
              </div>
            </div>
            <p v-else class="m-0 text-[14px] leading-[1.5] text-texto-2">A próxima questão é a que você tem perto de 70% de chance de acertar.</p>
            <p v-if="maxNivel < 5" class="m-0 mt-2 text-[12.5px] text-texto-2">{{ maxNivel < 4 ? 'Muito difícil abre com o primeiro assunto proficiente.' : 'Desafio extremo abre com o primeiro assunto dominado.' }}</p>
          </fieldset>

          <div class="mt-5">
            <div class="flex items-baseline justify-between gap-3">
              <p class="m-0 text-[13.5px] font-semibold">Formatos</p>
              <button type="button" class="link cursor-pointer border-0 bg-transparent p-0 text-[13.5px]" :aria-expanded="verTipos" @click="verTipos = !verTipos">{{ verTipos ? 'Fechar' : 'Escolher' }}</button>
            </div>
            <p v-if="!verTipos" class="m-0 mt-1 text-[14px] leading-snug"><span class="first-letter:uppercase">{{ nomesTipos.join(', ') || 'Nenhum' }}</span>. <span class="text-texto-2"><Fracao :valor="b.tipos.length" :total="TIPOS.length" sem-animacao /></span></p>
            <div v-else class="mt-1 grid gap-x-2 sm:grid-cols-2">
              <label v-for="t in TIPOS" :key="t.id" class="linha-opcao items-center py-1.5">
                <input type="checkbox" class="so-leitor" :checked="b.tipos.includes(t.id)" @change="alternarLista(b.tipos, t.id)">
                <span class="caixa mt-0" aria-hidden="true" /><span class="text-[14px]">{{ t.nome }}</span>
              </label>
            </div>
          </div>
        </div>

        <!-- De onde vêm -->
        <div class="min-w-0">
          <fieldset class="m-0 min-w-0 border-0 p-0">
            <legend class="mb-1.5 text-[13.5px] font-semibold">De onde vêm as questões</legend>
            <label v-for="o in ORIGENS_BLOCO[b.tipo]" :key="o.id" class="linha-opcao">
              <input type="radio" :name="`${id}-origem`" :value="o.id" :checked="b.origem === o.id" class="so-leitor" :disabled="o.id === 'erros_conjunto' && primeiro" @change="mudarOrigem(o.id)">
              <span class="bolinha" aria-hidden="true" />
              <span class="min-w-0 flex-1"><span class="flex items-center gap-2"><b class="text-[14px]">{{ o.nome }}</b><span class="marca-ia">sem IA</span></span><span class="block text-[12.5px] leading-snug text-texto-2">{{ o.id === 'erros_conjunto' && primeiro ? 'Precisa de outro bloco antes.' : o.descricao }}</span></span>
            </label>
          </fieldset>
          <template v-if="b.tipo === 'revisao' && b.origem === 'vencidas'">
            <p class="m-0 mb-1 mt-3 px-3 text-[12.5px] font-semibold text-texto-2">Se faltar</p>
            <label class="linha-opcao">
              <input v-model="b.completarNovas" type="checkbox" class="so-leitor"><span class="caixa" aria-hidden="true" />
              <span class="min-w-0 flex-1"><span class="flex items-center gap-2"><b class="text-[14px]">Completar com novas do banco</b><span class="marca-ia">sem IA</span></span><span class="block text-[12.5px] text-texto-2">Questões que você ainda não respondeu.</span></span>
            </label>
          </template>
          <template v-if="b.tipo === 'pratica'">
            <p class="m-0 mb-1 mt-3 px-3 text-[12.5px] font-semibold text-texto-2">Se o banco não tiver o bastante</p>
            <label class="linha-opcao">
              <input v-model="b.completarMaterial" type="checkbox" class="so-leitor"><span class="caixa" aria-hidden="true" />
              <span class="min-w-0 flex-1"><span class="flex items-center gap-2"><b class="text-[14px]">Do material</b><span class="marca-ia">sem IA</span></span><span class="block text-[12.5px] text-texto-2">Geradas do texto conferido dos assuntos que faltarem.</span></span>
            </label>
            <label class="linha-opcao">
              <input v-model="b.completarIa" type="checkbox" class="so-leitor"><span class="caixa" aria-hidden="true" />
              <span class="min-w-0 flex-1"><span class="flex items-center gap-2"><b class="text-[14px]">Gerar com IA</b><span class="marca-ia" data-ia="true">usa IA</span></span><span class="block text-[12.5px] text-texto-2">Só se o banco e o material não bastarem. Hoje: <Fracao :valor="cota.usadas" :total="cota.limite" sem-animacao />.</span></span>
            </label>
          </template>

          <div class="mt-3 rounded-[10px] border border-borda px-3.5 py-3">
            <template v-if="previa?.adiado">
              <p class="m-0 text-[13px]"><b>Montado quando você chegar nele.</b></p>
              <p class="m-0 mt-1 text-[12.5px] text-texto-2">Entram as que você errar nos blocos anteriores. Reserva para completar: {{ previa.reserva }} {{ previa.reserva === 1 ? 'errada' : 'erradas' }} dos últimos 14 dias.</p>
            </template>
            <template v-else-if="fonte">
              <p class="m-0 text-[13px]"><b>De onde saem as {{ previa.total }}</b> <span class="text-texto-2">{{ b.repetir ? 'pode repetir as de outros blocos' : 'sem repetir as de outros blocos' }}</span></p>
              <div class="mt-2 flex gap-[2px]" aria-hidden="true">
                <span v-if="fonte.banco" class="h-2.5 rounded-[2px] bg-tinta" :style="{ flex: fonte.banco }" />
                <span v-if="fonte.novas" class="h-2.5 rounded-[2px] bg-borda-campo" :style="{ flex: fonte.novas }" />
                <span v-if="fonte.faltam" class="h-2.5 rounded-[2px] bg-folha-3" :style="{ flex: fonte.faltam }" />
              </div>
              <ul class="m-0 mt-1.5 flex list-none flex-wrap gap-x-4 gap-y-1 p-0 text-[12.5px]">
                <li class="flex items-center gap-1.5"><span class="h-2 w-3 rounded-[2px] bg-tinta" aria-hidden="true" />{{ fonte.banco }} {{ b.tipo === 'pratica' ? 'novas do banco' : 'já respondidas' }}</li>
                <li v-if="fonte.novas" class="flex items-center gap-1.5"><span class="h-2 w-3 rounded-[2px] bg-borda-campo" aria-hidden="true" />{{ fonte.novas }} novas para completar</li>
                <li v-if="fonte.faltam" class="flex items-center gap-1.5 text-texto-2"><span class="h-2 w-3 rounded-[2px] bg-folha-3" aria-hidden="true" />faltam {{ fonte.faltam }}{{ previa.podeCompletar ? ', o PGC tenta completar' : '' }}</li>
              </ul>
              <p v-if="fonte.excluidas" class="m-0 mt-2 text-[12.5px] text-texto-2">{{ fonte.excluidas }} {{ fonte.excluidas === 1 ? 'questão desses assuntos já está' : 'questões desses assuntos já estão' }} em outro bloco e não {{ fonte.excluidas === 1 ? 'entra' : 'entram' }} aqui.</p>
            </template>
            <p v-else class="m-0 text-[12.5px] text-texto-2">A conta aparece quando o bloco tem assunto e formato.</p>
          </div>
        </div>
      </div>

      <!-- Durante o bloco -->
      <div class="mt-6 border-t border-borda pt-3">
        <p class="m-0 mb-1 text-[13.5px] font-semibold">Durante o bloco</p>
        <div class="grid items-center gap-x-4 gap-y-1.5 border-b border-borda py-2.5 sm:grid-cols-[170px_1fr]">
          <b class="text-[14px]">Ordem</b>
          <span class="flex flex-wrap gap-1.5">
            <label class="pilula"><input v-model="b.ordem" type="radio" :name="`${id}-ordem`" value="intercalada" class="so-leitor">Misturar assuntos</label>
            <label class="pilula"><input v-model="b.ordem" type="radio" :name="`${id}-ordem`" value="assunto" class="so-leitor">Por assunto</label>
          </span>
        </div>
        <div class="grid items-center gap-x-4 gap-y-1.5 border-b border-borda py-2.5 sm:grid-cols-[170px_1fr]">
          <b class="text-[14px]">Nível na questão</b>
          <span class="flex flex-wrap gap-1.5">
            <label v-for="[v, n] in [['mostrar', 'Mostrar'], ['esconder', 'Esconder'], ['disfarcar', 'Disfarçar']]" :key="v" class="pilula" :class="v === 'disfarcar' && !disfarcarLiberado && 'opacity-55'">
              <input v-model="b.nivelNaQuestao" type="radio" :name="`${id}-nivelq`" :value="v" class="so-leitor" :disabled="v === 'disfarcar' && !disfarcarLiberado">
              <Lock v-if="v === 'disfarcar' && !disfarcarLiberado" :size="13" :stroke-width="2" aria-hidden="true" />{{ n }}
            </label>
          </span>
        </div>
        <div class="grid items-center gap-x-4 gap-y-1.5 border-b border-borda py-2.5 sm:grid-cols-[170px_1fr]">
          <span><b class="block text-[14px]">Dicas</b><span class="block text-[12px] text-texto-2">Fácil 3, Normal 2, Difícil 1, acima nenhuma.</span></span>
          <span class="flex flex-wrap gap-1.5">
            <label v-for="[v, n] in [[3, 'Conforme o nível'], [0, 'Desligadas']]" :key="v" class="pilula"><input v-model.number="b.dicas" type="radio" :name="`${id}-dicas`" :value="v" class="so-leitor">{{ n }}</label>
          </span>
        </div>
        <div class="grid items-center gap-x-4 gap-y-1.5 border-b border-borda py-2.5 sm:grid-cols-[170px_1fr]">
          <span><b class="block text-[14px]">Fórmulas</b><span class="block text-[12px] text-texto-2">As aprovadas do material, ao lado.</span></span>
          <label class="linha-opcao w-fit items-center py-1"><input v-model="b.formulario" type="checkbox" class="so-leitor"><span class="caixa mt-0" aria-hidden="true" /><span class="text-[14px]">Mostrar</span></label>
        </div>
        <div class="grid items-center gap-x-4 gap-y-1.5 border-b border-borda py-2.5 sm:grid-cols-[170px_1fr]">
          <span><b class="block text-[14px]">Cronômetro</b><span class="block text-[12px] text-texto-2">Tempo nunca dá ponto.</span></span>
          <span class="flex flex-wrap items-center gap-1.5">
            <label v-for="[v, n] in [['sem', 'Sem'], ['sessao', 'Por bloco'], ['questao', 'Por questão']]" :key="v" class="pilula"><input v-model="b.cronometro.modo" type="radio" :name="`${id}-crono`" :value="v" class="so-leitor">{{ n }}</label>
            <span v-if="b.cronometro.modo === 'sessao'" class="flex items-center gap-1.5 text-[14px]"><input v-model.number="b.cronometro.minutos" class="campo h-9 w-[72px] px-2 text-center text-[14px]" type="number" min="1" max="240" :aria-label="`Minutos do bloco ${numero}`">min</span>
            <span v-if="b.cronometro.modo === 'questao'" class="flex items-center gap-1.5 text-[14px]"><input v-model.number="b.cronometro.segundos" class="campo h-9 w-[72px] px-2 text-center text-[14px]" type="number" min="10" max="900" :aria-label="`Segundos por questão no bloco ${numero}`">s</span>
          </span>
        </div>
        <div class="grid items-center gap-x-4 gap-y-1.5 border-b border-borda py-2.5 sm:grid-cols-[170px_1fr]">
          <b class="text-[14px]">Correção</b>
          <span class="flex flex-wrap gap-1.5">
            <label v-for="[v, n] in CORRECOES" :key="v" class="pilula"><input v-model="b.correcao" type="radio" :name="`${id}-corr`" :value="v" class="so-leitor">{{ n }}</label>
          </span>
        </div>
        <div class="grid items-center gap-x-4 gap-y-1.5 py-2.5 sm:grid-cols-[170px_1fr]" :class="!deErros && 'border-b border-borda'">
          <span><b class="block text-[14px]">Avançar sozinho</b><span class="block text-[12px] text-texto-2">Depois de um acerto.</span></span>
          <label class="linha-opcao w-fit items-center py-1"><input v-model="b.avancar" type="checkbox" class="so-leitor"><span class="caixa mt-0" aria-hidden="true" /><span class="text-[14px]">Avançar</span></label>
        </div>
        <div v-if="!deErros" class="grid items-center gap-x-4 gap-y-1.5 py-2.5 sm:grid-cols-[170px_1fr]">
          <span><b class="block text-[14px]">Repetir questões</b><span class="block text-[12px] text-texto-2">De outros blocos deste estudo.</span></span>
          <label class="linha-opcao w-fit items-center py-1"><input v-model="b.repetir" type="checkbox" class="so-leitor"><span class="caixa mt-0" aria-hidden="true" /><span class="text-[14px]">Pode repetir</span></label>
        </div>
      </div>

      <div class="mt-3 flex flex-wrap items-center gap-2 border-t border-borda pt-3.5">
        <button type="button" class="botao-secundario h-9 gap-1.5 px-3 text-[13.5px]" :disabled="primeiro" @click="emit('subir')"><ChevronUp :size="15" :stroke-width="2" aria-hidden="true" />Subir</button>
        <button type="button" class="botao-secundario h-9 gap-1.5 px-3 text-[13.5px]" :disabled="ultimo" @click="emit('descer')"><ChevronDown :size="15" :stroke-width="2" aria-hidden="true" />Descer</button>
        <button type="button" class="botao-secundario h-9 gap-1.5 px-3 text-[13.5px]" :disabled="!podeDuplicar" @click="emit('duplicar')"><Copy :size="15" :stroke-width="2" aria-hidden="true" />Duplicar</button>
        <button type="button" class="botao-secundario ml-auto h-9 gap-1.5 px-3 text-[13.5px]" @click="emit('remover')"><Trash2 :size="15" :stroke-width="2" aria-hidden="true" />Remover bloco</button>
      </div>
    </template>

    <ConjuntoAssuntos ref="janelaAssuntos" v-model="b.assuntos" :arvore="arvore" :titulo="`Assuntos do bloco ${numero}`" />
  </section>
</template>
