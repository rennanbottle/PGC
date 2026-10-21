<script setup>
// Campos da resposta que mudam com o tipo da questão (menos os de escolha, que o editor mostra com
// <QuestoesAlternativasNaQuestao>). O enunciado fica fora, porque todo tipo tem.
// "conteudo" é o objeto do tipo (shared/regras/questoes.js, conteudoVazio); os campos mexem nele direto.
import { Plus, X } from '@lucide/vue'
import { OPCOES_ASSERCAO } from '#shared/regras/questoes.js'

const conteudo = defineModel({ type: Object, required: true })
defineProps({
  tipo: { type: String, required: true },
  importada: { type: Boolean, default: false },
})
const id = useId()

// Número com vírgula: guarda como número; o texto digitado fica como está até virar número válido.
const textoNumero = ref(conteudo.value.resposta === null || conteudo.value.resposta === undefined ? '' : String(conteudo.value.resposta).replace('.', ','))
watch(textoNumero, (t) => {
  const n = Number(String(t).trim().replace(/\./g, '').replace(',', '.'))
  conteudo.value.resposta = String(t).trim() && Number.isFinite(n) ? n : null
})

// Numérica com mais de um número (as duas raízes): cada um com o rótulo; "resposta" acompanha o primeiro.
const variosNumeros = computed(() => Array.isArray(conteudo.value.respostas) && conteudo.value.respostas.length >= 2)
function lerNumeroEditor(t) {
  const n = Number(String(t).trim().replace(/\./g, '').replace(',', '.'))
  return String(t).trim() && Number.isFinite(n) ? n : null
}
function ligarVarios() {
  conteudo.value.respostas = [{ rotulo: 'x_1', valor: conteudo.value.resposta ?? null }, { rotulo: 'x_2', valor: null }]
}
function desligarVarios() {
  conteudo.value.resposta = conteudo.value.respostas?.[0]?.valor ?? null
  textoNumero.value = conteudo.value.resposta === null ? '' : String(conteudo.value.resposta).replace('.', ',')
  delete conteudo.value.respostas
}
function mudarValorVarios(i, t) {
  conteudo.value.respostas[i].valor = lerNumeroEditor(t)
  if (i === 0) conteudo.value.resposta = conteudo.value.respostas[0].valor
}

// Lacuna digitada: respostas aceitas separadas por ponto e vírgula.
const respostasEmTexto = (l) => (l.respostas ?? []).join('; ')
function mudarRespostas(l, texto) {
  l.respostas = String(texto).split(';').map((x) => x.trim()).filter(Boolean)
}
function adicionarPar() {
  if (conteudo.value.pares.length < 8) conteudo.value.pares.push({ a: '', b: '' })
}
function adicionarGrupo() {
  if (conteudo.value.grupos.length < 4) conteudo.value.grupos.push({ nome: '', itens: ['', ''] })
}
const opcoesPasso = computed(() => (conteudo.value.linhas ?? []).map((_, i) => ({ valor: i, texto: `Passo ${i + 1}` })))
const VF = { verdadeiro_falso: [{ v: true, n: 'Verdadeira' }, { v: false, n: 'Falsa' }], certo_errado: [{ v: true, n: 'Certo' }, { v: false, n: 'Errado' }] }
</script>

<template>
  <div class="flex flex-col gap-5">
    <!-- V ou F, certo ou errado -->
    <template v-if="tipo === 'verdadeiro_falso' || tipo === 'certo_errado'">
      <fieldset class="m-0 min-w-0 border-0 p-0">
        <legend class="rotulo">{{ tipo === 'certo_errado' ? 'O item está' : 'A afirmação é' }}</legend>
        <div class="flex flex-wrap gap-2">
          <label v-for="op in VF[tipo]" :key="op.n" class="linha-opcao min-w-[150px] items-center border border-borda">
            <input
              type="radio"
              class="escolher"
              :name="`${id}-vf`"
              :checked="(tipo === 'certo_errado' ? conteudo.certo : conteudo.verdadeira) === op.v"
              @change="tipo === 'certo_errado' ? (conteudo.certo = op.v) : (conteudo.verdadeira = op.v)"
            >
            <b class="text-[15px]">{{ op.n }}</b>
          </label>
        </div>
      </fieldset>
      <div v-if="tipo === 'verdadeiro_falso'">
        <label class="rotulo" :for="`${id}-just`">Por que{{ importada ? ' (opcional)' : '' }}</label>
        <textarea :id="`${id}-just`" v-model="conteudo.justificativa" class="campo min-h-[84px] resize-y py-3 leading-[1.5]" maxlength="1500" />
        <p class="ajuda">Quem responde também explica o porquê. A correção compara com este texto.</p>
      </div>
    </template>

    <!-- Asserção e razão -->
    <template v-else-if="tipo === 'assercao_razao'">
      <div>
        <label class="rotulo" :for="`${id}-assercao`">Primeira afirmação</label>
        <textarea :id="`${id}-assercao`" v-model="conteudo.assercao" class="campo min-h-[72px] resize-y py-3 leading-[1.5]" maxlength="1500" />
      </div>
      <div>
        <label class="rotulo" :for="`${id}-razao`">Segunda afirmação, a que vem depois do PORQUE</label>
        <textarea :id="`${id}-razao`" v-model="conteudo.razao" class="campo min-h-[72px] resize-y py-3 leading-[1.5]" maxlength="1500" />
      </div>
      <fieldset class="m-0 min-w-0 border-0 p-0">
        <legend class="rotulo">Resposta certa</legend>
        <div class="flex flex-col gap-0.5">
          <label v-for="o in OPCOES_ASSERCAO" :key="o.id" class="linha-opcao">
            <input v-model="conteudo.resposta" type="radio" class="escolher" :name="`${id}-ar`" :value="o.id">
            <span class="text-[14.5px]">{{ o.texto }}</span>
          </label>
        </div>
      </fieldset>
    </template>

    <!-- Lacunas -->
    <template v-else-if="tipo === 'lacuna_digitada' || tipo === 'lacuna_opcoes'">
      <p v-if="!conteudo.lacunas.length" class="painel m-0 text-[14px] text-texto-2">
        Escreva três sublinhados (___) na pergunta onde fica cada lacuna. Os campos das respostas aparecem aqui.
      </p>
      <TransitionGroup name="lista" tag="div" class="flex flex-col gap-3">
        <div v-for="(l, i) in conteudo.lacunas" :key="i" class="painel">
          <p class="m-0 mb-2 text-[14px] font-semibold">Lacuna {{ i + 1 }}</p>
          <template v-if="tipo === 'lacuna_digitada'">
            <label class="text-[13px] font-semibold text-texto-2" :for="`${id}-lac-${i}`">Respostas aceitas, separadas por ponto e vírgula</label>
            <input :id="`${id}-lac-${i}`" class="campo mt-1 max-w-[460px]" type="text" maxlength="400" autocomplete="off" :value="respostasEmTexto(l)" @change="mudarRespostas(l, $event.target.value)">
            <p class="ajuda">Maiúsculas e acentos não contam na correção.</p>
          </template>
          <fieldset v-else class="m-0 min-w-0 border-0 p-0">
            <legend class="text-[13px] font-semibold text-texto-2">Opções: marque a certa</legend>
            <div class="mt-1.5 flex flex-col gap-2">
              <div v-for="(_, k) in l.opcoes" :key="k" class="flex items-center gap-2">
                <input type="radio" class="escolher shrink-0" :name="`${id}-op-${i}`" :checked="l.certa === k" :aria-label="`Opção ${k + 1} é a certa`" @change="l.certa = k">
                <label class="so-leitor" :for="`${id}-op-${i}-${k}`">Texto da opção {{ k + 1 }}</label>
                <input :id="`${id}-op-${i}-${k}`" v-model="l.opcoes[k]" class="campo campo-p max-w-[380px] flex-1" type="text" maxlength="200" autocomplete="off">
                <button type="button" class="botao-icone pequeno" :disabled="l.opcoes.length <= 3" :aria-label="`Tirar a opção ${k + 1}`" @click="l.opcoes.splice(k, 1); l.certa = Math.min(l.certa, l.opcoes.length - 1)">
                  <X :size="15" :stroke-width="2" aria-hidden="true" />
                </button>
              </div>
            </div>
            <button v-if="l.opcoes.length < 5" type="button" class="botao-fantasma botao-p -ml-2.5 mt-1.5" @click="l.opcoes.push('')">
              <Plus :size="15" :stroke-width="2" aria-hidden="true" />Opção
            </button>
          </fieldset>
        </div>
      </TransitionGroup>
    </template>

    <!-- Associar -->
    <fieldset v-else-if="tipo === 'associar'" class="m-0 min-w-0 border-0 p-0">
      <legend class="mb-1 flex w-full items-baseline justify-between">
        <span class="rotulo m-0">Pares</span>
        <span class="text-[13px] text-texto-2"><Fracao :valor="conteudo.pares.length" :total="8" sem-animacao /></span>
      </legend>
      <p class="ajuda m-0 mb-2.5">Cada linha é um par certo. No Estudar, a segunda coluna aparece embaralhada.</p>
      <TransitionGroup name="lista" tag="div" class="flex flex-col gap-2">
        <div v-for="(p, i) in conteudo.pares" :key="i" class="grid grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)_auto] items-center gap-2">
          <label class="so-leitor" :for="`${id}-pa-${i}`">Item {{ i + 1 }}</label>
          <input :id="`${id}-pa-${i}`" v-model="p.a" class="campo" type="text" maxlength="200" autocomplete="off">
          <label class="so-leitor" :for="`${id}-pb-${i}`">Par do item {{ i + 1 }}</label>
          <input :id="`${id}-pb-${i}`" v-model="p.b" class="campo" type="text" maxlength="400" autocomplete="off">
          <button type="button" class="botao-icone pequeno" :disabled="conteudo.pares.length <= 3" :aria-label="`Tirar o par ${i + 1}`" @click="conteudo.pares.splice(i, 1)">
            <X :size="15" :stroke-width="2" aria-hidden="true" />
          </button>
        </div>
      </TransitionGroup>
      <button v-if="conteudo.pares.length < 8" type="button" class="botao-fantasma botao-p -ml-2.5 mt-2" @click="adicionarPar">
        <Plus :size="15" :stroke-width="2" aria-hidden="true" />Par
      </button>
    </fieldset>

    <!-- Ordenar -->
    <QuestoesCampoLista v-else-if="tipo === 'ordenar'" v-model="conteudo.itens" rotulo="Itens, já na ordem certa" nome-item="Item" :minimo="3" :maximo="10" ajuda="No Estudar, os itens aparecem embaralhados." />

    <!-- Classificar -->
    <fieldset v-else-if="tipo === 'classificar'" class="m-0 min-w-0 border-0 p-0">
      <legend class="rotulo">Grupos e os itens de cada um</legend>
      <div class="flex flex-col gap-3">
        <div v-for="(g, i) in conteudo.grupos" :key="i" class="painel">
          <div class="mb-3 flex items-end gap-2">
            <div class="max-w-[360px] flex-1">
              <label class="text-[13px] font-semibold text-texto-2" :for="`${id}-g-${i}`">Nome do grupo {{ i + 1 }}</label>
              <input :id="`${id}-g-${i}`" v-model="g.nome" class="campo mt-1" type="text" maxlength="80" autocomplete="off">
            </div>
            <button type="button" class="botao-icone pequeno mb-1" :disabled="conteudo.grupos.length <= 2" :aria-label="`Tirar o grupo ${i + 1}`" @click="conteudo.grupos.splice(i, 1)">
              <X :size="16" :stroke-width="2" aria-hidden="true" />
            </button>
          </div>
          <QuestoesCampoLista v-model="g.itens" :rotulo="`Itens de ${g.nome || `grupo ${i + 1}`}`" nome-item="Item" :minimo="1" :maximo="8" :numerado="false" />
        </div>
      </div>
      <button v-if="conteudo.grupos.length < 4" type="button" class="botao-fantasma botao-p -ml-2.5 mt-2" @click="adicionarGrupo">
        <Plus :size="15" :stroke-width="2" aria-hidden="true" />Grupo
      </button>
    </fieldset>

    <!-- Numérica -->
    <div v-else-if="tipo === 'numerica'" class="flex max-w-[640px] flex-col gap-3">
    <div class="grid gap-3 sm:grid-cols-[0.9fr_1.3fr]">
      <div>
        <label class="rotulo" :for="`${id}-rot`">O que se calcula</label>
        <input :id="`${id}-rot`" v-model="conteudo.rotulo" class="campo" type="text" maxlength="20" autocomplete="off" :aria-describedby="`${id}-rot-ajuda`">
        <p :id="`${id}-rot-ajuda`" class="ajuda">Opcional. Aparece antes do campo, como x_v ou Δ.</p>
      </div>
    </div>
    <div v-if="variosNumeros" class="flex flex-col gap-2">
      <p class="rotulo m-0">Respostas, em qualquer ordem</p>
      <div v-for="(r, i) in conteudo.respostas" :key="i" class="grid grid-cols-[110px_160px_auto] items-center gap-2">
        <input v-model="r.rotulo" class="campo" type="text" maxlength="12" autocomplete="off" :aria-label="`Rótulo da resposta ${i + 1}`">
        <input :value="r.valor === null || r.valor === undefined ? '' : String(r.valor).replace('.', ',')" class="campo" type="text" inputmode="decimal" autocomplete="off" :aria-label="`Valor da resposta ${i + 1}`" @input="mudarValorVarios(i, $event.target.value)">
        <button v-if="conteudo.respostas.length > 2" type="button" class="botao-icone pequeno" :aria-label="`Tirar a resposta ${i + 1}`" @click="conteudo.respostas.splice(i, 1)"><X :size="15" :stroke-width="2.2" aria-hidden="true" /></button>
      </div>
      <span class="flex flex-wrap gap-2">
        <button v-if="conteudo.respostas.length < 4" type="button" class="botao-fantasma botao-p -ml-2.5" @click="conteudo.respostas.push({ rotulo: `x_${conteudo.respostas.length + 1}`, valor: null })"><Plus :size="15" :stroke-width="2" aria-hidden="true" />Outra resposta</button>
        <button type="button" class="link-discreto text-[13.5px]" @click="desligarVarios">Voltar a um número só</button>
      </span>
      <div class="grid max-w-[360px] grid-cols-2 gap-3">
        <div>
          <label class="rotulo" :for="`${id}-tol2`">Margem (%)</label>
          <input :id="`${id}-tol2`" v-model.number="conteudo.tolerancia" class="campo" type="number" min="0" max="20" step="0.5">
        </div>
        <div>
          <label class="rotulo" :for="`${id}-uni2`">Unidade</label>
          <input :id="`${id}-uni2`" v-model="conteudo.unidade" class="campo" type="text" maxlength="20" autocomplete="off">
        </div>
      </div>
    </div>
    <div v-else class="grid gap-3 sm:grid-cols-[1.3fr_0.8fr_0.9fr]">
      <div>
        <label class="rotulo" :for="`${id}-num`">Resposta</label>
        <input :id="`${id}-num`" v-model="textoNumero" class="campo" type="text" inputmode="decimal" autocomplete="off" :aria-invalid="!!textoNumero && conteudo.resposta === null" :aria-describedby="`${id}-num-erro`">
        <p v-if="textoNumero && conteudo.resposta === null" :id="`${id}-num-erro`" class="erro-campo">Escreva só o número, como 45 ou 9,8.</p>
      </div>
      <div>
        <label class="rotulo" :for="`${id}-tol`">Margem (%)</label>
        <input :id="`${id}-tol`" v-model.number="conteudo.tolerancia" class="campo" type="number" min="0" max="20" step="0.5">
      </div>
      <div>
        <label class="rotulo" :for="`${id}-uni`">Unidade</label>
        <input :id="`${id}-uni`" v-model="conteudo.unidade" class="campo" type="text" maxlength="20" autocomplete="off">
      </div>
    </div>
    <button v-if="!variosNumeros" type="button" class="link-discreto w-fit text-[13.5px]" @click="ligarVarios">A resposta tem mais de um número (como as duas raízes)</button>
    </div>

    <!-- Encontrar o erro -->
    <template v-else-if="tipo === 'encontrar_erro'">
      <QuestoesCampoLista v-model="conteudo.linhas" rotulo="Passos da resolução" nome-item="Passo" :minimo="3" :maximo="10" longo />
      <div class="grid gap-3 sm:grid-cols-[180px_minmax(0,1fr)]">
        <div>
          <label class="rotulo" :for="`${id}-errada`">Passo errado</label>
          <Selecao :id="`${id}-errada`" v-model="conteudo.errada" :opcoes="opcoesPasso" :busca="false" />
        </div>
        <div>
          <label class="rotulo" :for="`${id}-corr`">Como fica o passo certo</label>
          <input :id="`${id}-corr`" v-model="conteudo.correcao" class="campo" type="text" maxlength="600" autocomplete="off">
        </div>
      </div>
    </template>

    <!-- Cartão -->
    <div v-else-if="tipo === 'cartao'">
      <label class="rotulo" :for="`${id}-verso`">Verso</label>
      <textarea :id="`${id}-verso`" v-model="conteudo.verso" class="campo min-h-[92px] resize-y py-3 leading-[1.5]" maxlength="1500" />
      <p class="ajuda">A pergunta é a frente. Quem responde escreve antes de virar o cartão.</p>
    </div>

    <!-- Resposta curta e explicar -->
    <template v-else-if="tipo === 'resposta_curta' || tipo === 'explicar'">
      <div>
        <label class="rotulo" :for="`${id}-modelo`">Resposta esperada{{ importada ? ' (opcional)' : '' }}</label>
        <textarea :id="`${id}-modelo`" v-model="conteudo.resposta" class="campo min-h-[92px] resize-y py-3 leading-[1.5]" maxlength="3000" />
      </div>
      <QuestoesCampoLista v-model="conteudo.pontos" rotulo="O que a resposta precisa ter" nome-item="Ponto" :minimo="importada ? 0 : 1" :maximo="6" :numerado="false" texto-adicionar="Ponto" />
    </template>
  </div>
</template>
