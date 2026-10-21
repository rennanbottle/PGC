<script setup>
// Uma questão da revisão: cabeçalho (número, assunto, nível como a pessoa escolheu ver), enunciado, imagem,
// dicas abertas e o campo de resposta do tipo. A correção aparece embaixo, quando houver.
import { Lightbulb, Sigma } from '@lucide/vue'
import { nomeDoNivel } from '#shared/regras/questoes.js'
import { temMatematica } from '#shared/regras/matematica.js'

const props = defineProps({
  item: { type: Object, required: true },
  numero: { type: Number, required: true },
  assunto: { type: Object, default: null },
  revelar: { type: Object, default: null },
  travada: { type: Boolean, default: false },
  semNivel: { type: Boolean, default: false }, // na prova o nível não aparece
})
const resposta = defineModel({ type: Object, default: () => ({}) })
const campo = ref(null)
const q = computed(() => props.item.questao)
const correcao = computed(() => props.item.correcao ?? null)
const COMPONENTE = {
  multipla_escolha: 'escolher', texto_base: 'escolher', prever_resultado: 'escolher', multipla_resposta: 'escolher',
  verdadeiro_falso: 'vf', certo_errado: 'vf', assercao_razao: 'assercao', lacuna_digitada: 'lacunas', lacuna_opcoes: 'lacunas',
  associar: 'associar', ordenar: 'ordenar', classificar: 'classificar', numerica: 'numerica', encontrar_erro: 'erro',
  cartao: 'aberta', resposta_curta: 'aberta', explicar: 'aberta',
}
const componente = computed(() => COMPONENTE[q.value.tipo] ?? 'escolher')
const eliminar = computed(() => [...new Set((props.item.dicas ?? []).flatMap((d) => d.eliminar ?? []))])
const rotuloNivel = computed(() => {
  if (correcao.value) return props.item.nivelMostrado && props.item.nivelMostrado !== correcao.value.nivel ? `Era ${nomeDoNivel(correcao.value.nivel)}, não ${nomeDoNivel(props.item.nivelMostrado)}` : `Era ${nomeDoNivel(correcao.value.nivel)}`
  return props.item.nivelMostrado ? nomeDoNivel(props.item.nivelMostrado) : 'Nível escondido até a correção'
})
const imagem = ref('')
const api = useQuestoes()
watch(() => props.item.imagem, async (c) => {
  imagem.value = ''
  if (c) imagem.value = await api.imagemParaMostrar(c).catch(() => '')
}, { immediate: true })
// Teclado de símbolos nas respostas digitadas: aberto sozinho quando a questão tem conta; senão, num botão.
const DIGITADAS = ['lacuna_digitada', 'numerica', 'resposta_curta', 'explicar', 'verdadeiro_falso', 'cartao']
const digitada = computed(() => DIGITADAS.includes(q.value.tipo))
const deConta = computed(() => temMatematica(`${q.value.enunciado ?? ''} ${q.value.textoBase ?? ''}`))
const tecladoAberto = ref(false)
watch(() => props.item.id, () => (tecladoAberto.value = deConta.value), { immediate: true })
const ultimoCampo = ref(null)
function lembrarCampo(e) {
  if (e.target?.matches?.('input[type="text"], textarea')) ultimoCampo.value = e.target
}
defineExpose({ escolher: (i) => campo.value?.escolher?.(i) })
</script>

<template>
  <article :aria-label="`Questão ${numero}`">
    <div class="flex flex-wrap items-center gap-x-3 gap-y-1 text-[13.5px]">
      <span class="font-semibold text-texto-2">Questão {{ numero }}</span>
      <span v-if="assunto" class="flex min-w-0 items-center gap-1.5 text-texto-2">
        <span class="size-2.5 shrink-0 rounded-full" :style="{ background: `${corMateria(assunto.cor || 'cinza')}` }" aria-hidden="true" />
        <span class="truncate">{{ assunto.materia ? `${assunto.materia}, ` : '' }}{{ assunto.nome }}</span>
      </span>
      <span v-if="!semNivel" class="ml-auto text-[12.5px] text-texto-3">{{ rotuloNivel }}</span>
    </div>
    <TextoRico v-if="componente !== 'lacunas' && q.tipo !== 'cartao'" :texto="q.enunciado" class="enunciado mt-4 text-[21px] font-medium leading-[1.45] sm:text-[25px]" />
    <TextoRico v-else-if="q.tipo === 'cartao'" :texto="q.enunciado" class="enunciado mt-4 font-titulo text-[26px] font-semibold leading-[1.3] sm:text-[30px]" />
    <img v-if="imagem" :src="imagem" alt="Figura da questão" class="mt-4 max-h-[340px] max-w-full rounded-[12px] border border-borda">

    <TransitionGroup v-if="!correcao" name="lista" tag="div" class="flex flex-col gap-2" :class="item.dicas?.length && 'mt-5'">
      <div v-for="(d, i) in item.dicas ?? []" :key="i" class="painel">
        <p class="m-0 flex items-center gap-2 text-[13px] font-semibold text-texto-2"><Lightbulb :size="15" :stroke-width="2" aria-hidden="true" />Dica {{ i + 1 }}</p>
        <TextoRico :texto="d.texto" class="mt-1 text-[15px] leading-[1.5]" />
      </div>
    </TransitionGroup>

    <div class="mt-7" :class="componente === 'lacunas' && 'mt-4'" @focusin="lembrarCampo">
      <SessaoEscolher v-if="componente === 'escolher'" ref="campo" v-model="resposta" :questao="q" :correcao="correcao" :eliminar="eliminar" :travada="travada" />
      <SessaoVerdadeiroFalso v-else-if="componente === 'vf'" ref="campo" v-model="resposta" :questao="q" :correcao="correcao" :travada="travada" />
      <SessaoAssercao v-else-if="componente === 'assercao'" ref="campo" v-model="resposta" :questao="q" :correcao="correcao" :travada="travada" />
      <SessaoLacunas v-else-if="componente === 'lacunas'" v-model="resposta" :questao="q" :correcao="correcao" :travada="travada" />
      <SessaoAssociar v-else-if="componente === 'associar'" v-model="resposta" :questao="q" :correcao="correcao" :travada="travada" />
      <SessaoOrdenar v-else-if="componente === 'ordenar'" v-model="resposta" :questao="q" :correcao="correcao" :travada="travada" />
      <SessaoClassificar v-else-if="componente === 'classificar'" v-model="resposta" :questao="q" :correcao="correcao" :travada="travada" />
      <SessaoNumerica v-else-if="componente === 'numerica'" v-model="resposta" :questao="q" :correcao="correcao" :travada="travada" />
      <SessaoEncontrarErro v-else-if="componente === 'erro'" ref="campo" v-model="resposta" :questao="q" :correcao="correcao" :travada="travada" />
      <SessaoAberta v-else v-model="resposta" :questao="q" :revelar="revelar" :correcao="correcao" :travada="travada" />
    </div>

    <div v-if="digitada && !travada && !correcao" class="mt-4">
      <button v-if="!tecladoAberto" type="button" class="link-discreto inline-flex items-center gap-1.5 text-[13.5px]" @mousedown.prevent @click="tecladoAberto = true">
        <Sigma :size="15" :stroke-width="2" aria-hidden="true" />Símbolos de matemática
      </button>
      <SessaoTecladoMat v-else :alvo="ultimoCampo" :travada="travada" />
    </div>

    <Transition name="desliza">
      <SessaoCorrecao v-if="correcao" class="mt-6" :item="item" :resposta="resposta" />
    </Transition>
  </article>
</template>
