<script setup>
// Plano até a prova: estudos de hoje até a véspera, no ritmo do perfil, cada assunto pelo menos duas vezes e revisão
// geral nos últimos dias, fugindo dos dias cheios (regras em shared/regras/agenda.js). Mostra a linha do tempo
// antes de salvar; salvar troca o plano antigo pelo novo. Uso: janela.value.abrir(prova).
import { BookOpen, CircleAlert, Flag, GraduationCap, TriangleAlert } from '@lucide/vue'
import { RITMOS, RITMO_PADRAO } from '#shared/regras/ritmo.js'
import { MINUTOS_POR_SESSAO, NOMES_SEMANA, SESSOES_POR_SEMANA, diaDaSemana, diaPorExtenso, diferencaDias, formatarDuracao, montarPlano, ocupacaoDosDias } from '#shared/regras/agenda.js'
import { assuntosAtivos } from '#shared/regras/materias.js'

const props = defineProps({
  hoje: { type: String, required: true },
  eventos: { type: Array, default: () => [] },
})
const api = useAgenda()
const { data: materias } = useMaterias()
const { data: perfil } = usePerfil()
const { avisar } = useAvisos()
const id = useId()
const janela = ref(null)
const prova = ref(null)
const escolhidos = ref([])
const ocupado = ref(false)
const erro = ref('')

const materia = computed(() => (materias.value ?? []).find((m) => m.id === prova.value?.materia_id) ?? null)
const opcoesAssunto = computed(() => assuntosAtivos(materia.value).map((a) => ({ valor: a.id, texto: a.nome })))
const ritmo = computed(() => (RITMOS[perfil.value?.ritmo] ? perfil.value.ritmo : RITMO_PADRAO))
const existentes = computed(() => props.eventos.filter((e) => e.plano_de && e.plano_de === prova.value?.id).length)
const faltam = computed(() => (prova.value ? diferencaDias(props.hoje, prova.value.data) : 0))
const plano = computed(() => {
  if (!prova.value) return { sessoes: [], aviso: null }
  const nomes = Object.fromEntries(opcoesAssunto.value.map((o) => [o.valor, o.texto]))
  return montarPlano({
    prova: prova.value,
    assuntos: escolhidos.value.filter((a) => nomes[a]).map((a) => ({ id: a, nome: nomes[a] })),
    hoje: props.hoje,
    ritmo: ritmo.value,
    ocupacao: ocupacaoDosDias(props.eventos, prova.value.id),
    materiaNome: materia.value?.nome ?? '',
  })
})
const nomeAssunto = (a) => opcoesAssunto.value.find((o) => o.valor === a)?.texto ?? ''
const diaCurtinho = (d) => `${NOMES_SEMANA[diaDaSemana(d)]} ${Number(d.slice(8))}`

function abrir(p) {
  prova.value = p
  const validos = assuntosAtivos((materias.value ?? []).find((m) => m.id === p.materia_id)).map((a) => a.id)
  const daProva = (p.assuntos ?? []).filter((a) => validos.includes(a))
  escolhidos.value = daProva.length ? daProva : validos.slice(0, 8)
  erro.value = ''
  janela.value?.abrir()
}

async function salvar() {
  ocupado.value = true
  erro.value = ''
  try {
    await api.salvarPlano(prova.value, plano.value.sessoes)
    avisar({ texto: `Plano salvo: ${plano.value.sessoes.length} estudos até a prova.`, tipo: 'ok' })
    janela.value?.fechar()
  }
  catch (e) {
    erro.value = e.message
  }
  ocupado.value = false
}
defineExpose({ abrir })
</script>

<template>
  <JanelaBase ref="janela" titulo="Plano até a prova" :descricao="prova ? `${prova.titulo}, ${diaPorExtenso(prova.data).toLowerCase()}. ${faltam > 0 ? `Faltam ${faltam} ${faltam === 1 ? 'dia' : 'dias'}.` : ''}` : ''" larga>
    <div v-if="prova" class="flex flex-col gap-5">
      <div class="grid gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] sm:items-end">
        <div v-if="opcoesAssunto.length">
          <label class="rotulo" :for="`${id}-assuntos`">Assuntos da prova</label>
          <Selecao :id="`${id}-assuntos`" v-model="escolhidos" multiplo :opcoes="opcoesAssunto" texto-vazio="Nenhum" />
        </div>
        <p v-else class="m-0 text-[14px] text-texto-2">{{ materia ? 'Esta matéria ainda não tem assuntos: o plano marca estudos da matéria inteira.' : 'Sem matéria: o plano marca estudos com o nome da prova.' }}</p>
        <p class="m-0 text-[13.5px] leading-snug text-texto-2">
          Ritmo {{ RITMOS[ritmo].nome }}: até {{ SESSOES_POR_SEMANA[ritmo] }} estudos por semana, {{ formatarDuracao(MINUTOS_POR_SESSAO[ritmo]) }} cada. Dias com prova ou trabalho ficam livres.
        </p>
      </div>

      <p v-if="plano.aviso" class="m-0 flex items-start gap-2 text-[14px]"><TriangleAlert :size="17" :stroke-width="2" aria-hidden="true" class="mt-0.5 shrink-0 text-aviso" />{{ plano.aviso }}</p>

      <ol v-if="plano.sessoes.length" class="ag-linha" :aria-label="`${plano.sessoes.length} estudos até a prova`">
        <li v-for="(s, i) in plano.sessoes" :key="s.data" class="ag-passo entra" :class="s.final && 'ag-passo-final'" :style="{ '--i': Math.min(i, 12) }">
          <span class="ag-marco" aria-hidden="true"><component :is="s.final ? Flag : BookOpen" :size="14" :stroke-width="2.2" /></span>
          <span class="ag-passo-dia">{{ diaCurtinho(s.data) }}</span>
          <span class="min-w-0 flex-1">
            <b class="block text-[14.5px] font-semibold leading-snug">{{ s.titulo }}</b>
            <span class="block text-[13px] text-texto-2">{{ formatarDuracao(s.duracao_min) }}<template v-if="s.final && s.assuntos.length > 1">, todos os assuntos misturados</template><template v-else-if="s.assuntos.length > 1">, {{ s.assuntos.map(nomeAssunto).join(', ') }}</template></span>
          </span>
        </li>
        <li class="ag-passo ag-passo-prova" :style="{ '--ag-cor': materia ? `${corMateria(materia.cor)}` : 'var(--color-acento)' }">
          <span class="ag-marco" aria-hidden="true"><GraduationCap :size="15" :stroke-width="2.2" /></span>
          <span class="ag-passo-dia">{{ diaCurtinho(prova.data) }}</span>
          <b class="min-w-0 flex-1 text-[14.5px] font-semibold">{{ prova.titulo }}</b>
        </li>
      </ol>

      <p v-if="existentes" class="m-0 text-[13.5px] text-texto-2">Salvar troca o plano atual ({{ existentes }} estudos) por este.</p>
      <p v-if="erro" class="erro-campo m-0" role="alert"><CircleAlert :size="16" :stroke-width="2" aria-hidden="true" class="mt-px shrink-0" />{{ erro }}</p>
    </div>

    <template #rodape>
      <button type="button" class="botao-fantasma botao-p h-10" @click="janela?.fechar()">Cancelar</button>
      <button type="button" class="botao h-10" :aria-busy="ocupado" :disabled="ocupado || !plano.sessoes.length" @click="salvar">Salvar plano</button>
    </template>
  </JanelaBase>
</template>

<style>
.ag-linha { position: relative; display: flex; max-height: 46vh; flex-direction: column; gap: 2px; margin: 0; padding: 0 4px 0 0; overflow-y: auto; list-style: none; }
.ag-passo { position: relative; display: flex; align-items: flex-start; gap: 10px; padding: 7px 0; }
.ag-passo::before { content: ''; position: absolute; top: 0; bottom: 0; left: 13px; width: 2px; background: var(--color-borda); }
.ag-passo:first-child::before { top: 18px; }
.ag-passo-prova::before { bottom: auto; height: 18px; }
.ag-marco { position: relative; z-index: 1; display: grid; flex: 0 0 28px; width: 28px; height: 28px; place-items: center; border: 2px solid var(--color-borda-forte); border-radius: 50%; background: var(--color-folha); color: var(--color-texto-2); }
.ag-passo-final .ag-marco { border-color: var(--color-acento); color: var(--color-acento); }
.ag-passo-prova .ag-marco { border-color: var(--ag-cor); background: var(--ag-cor); color: var(--color-folha); }
.ag-passo-dia { flex: 0 0 56px; padding-top: 4px; color: var(--color-texto-2); font-size: 13px; font-weight: 600; font-variant-numeric: tabular-nums; }
</style>
