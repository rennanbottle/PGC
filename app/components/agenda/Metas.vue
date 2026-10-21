<script setup>
// Metas na Agenda: a meta do dia (do ritmo) e as metas da pessoa, por semana ou até uma data. Cada meta mostra a
// barra com o que já foi feito, um risco no ponto onde devia estar hoje para ficar em dia, a fração e o que falta.
// "compacto" (Início): sem a meta do dia, até 3 metas e o link para a Agenda.
// Uso: <AgendaMetas :materias="materiasPorId" @nova="..." @editar="meta => ..." />
import { Archive, Flag, Pencil, Plus } from '@lucide/vue'
import { NOME_ESTADO_META, tituloDaMeta } from '#shared/regras/metas.js'

const props = defineProps({
  materias: { type: Object, default: () => ({}) },
  compacto: { type: Boolean, default: false },
})
const emit = defineEmits(['nova', 'editar'])
const { data } = useListaMetas()
const api = useMetas()
const { avisar } = useAvisos()

const SELO = { batida: 'ok', no_ritmo: 'acento', atras: 'aviso', vencida: 'erro' }
const metas = computed(() => (data.value?.metas ?? []).slice(0, props.compacto ? 3 : 40))
const diaria = computed(() => data.value?.diaria ?? null)
const porcentoDia = computed(() => (diaria.value?.meta ? Math.min(100, Math.round((diaria.value.feitas / diaria.value.meta) * 100)) : 0))
const titulo = (m) => tituloDaMeta(m, props.materias[m.materia_id]?.nome ?? '')
const marca = (m) => (m.situacao.esperado === null || m.situacao.estado === 'batida' ? null : Math.min(100, Math.round((m.situacao.esperado / m.situacao.alvo) * 100)))
const itensMenu = [
  { id: 'editar', texto: 'Editar', icone: Pencil },
  { id: 'arquivar', texto: 'Arquivar', icone: Archive },
]

async function escolher(meta, acao) {
  if (acao === 'editar') return emit('editar', meta)
  try {
    await api.arquivar(meta)
    avisar({ texto: 'Meta arquivada.', acao: { texto: 'Desfazer', fazer: () => api.desarquivar(meta).catch((e) => avisar({ texto: e.message, tipo: 'erro' })) } })
  }
  catch (e) {
    avisar({ texto: e.message, tipo: 'erro' })
  }
}
</script>

<template>
  <section class="cartao" aria-labelledby="ag-metas-titulo">
    <div class="flex items-center justify-between gap-3">
      <h2 id="ag-metas-titulo" class="titulo-cartao m-0 flex items-center gap-2">
        <Flag :size="18" :stroke-width="2" aria-hidden="true" class="text-texto-2" />Metas
      </h2>
      <NuxtLink v-if="compacto" to="/agenda" class="link text-[14px]">Abrir a agenda</NuxtLink>
      <button v-else type="button" class="botao-fantasma botao-p" @click="emit('nova')">
        <Plus :size="16" :stroke-width="2.2" aria-hidden="true" />Nova meta
      </button>
    </div>

    <div v-if="diaria && !compacto" class="mt-4">
      <div class="flex items-baseline justify-between gap-3 text-[14px]">
        <span class="font-semibold">Questões de hoje</span>
        <span class="tabular-nums text-texto-2"><Fracao :valor="diaria.feitas" :total="diaria.meta" /></span>
      </div>
      <div class="barra fina mt-2" :data-tipo="porcentoDia >= 100 ? 'ok' : undefined" role="progressbar" :aria-valuenow="porcentoDia" aria-valuemin="0" aria-valuemax="100" aria-label="Questões de hoje"><i :style="{ width: `${porcentoDia}%` }" /></div>
      <p class="m-0 mt-1.5 text-[13px] text-texto-3">Meta do ritmo {{ diaria.ritmo }}. Muda no Perfil.</p>
    </div>

    <ul v-if="metas.length" class="m-0 mt-4 flex list-none flex-col p-0" :class="!compacto && diaria && 'border-t border-borda pt-1'">
      <li v-for="m in metas" :key="m.id" class="ag-meta">
        <div class="flex items-start gap-2">
          <div class="min-w-0 flex-1">
            <p class="m-0 text-[14.5px] font-semibold leading-snug">{{ titulo(m) }}</p>
            <span class="selo mt-1.5" :data-tipo="SELO[m.situacao.estado]">{{ NOME_ESTADO_META[m.situacao.estado] }}</span>
          </div>
          <MenuAcoes v-if="!compacto" :rotulo="`Ações da meta ${titulo(m)}`" :itens="itensMenu" @escolher="escolher(m, $event)" />
        </div>
        <div class="ag-meta-barra mt-2.5">
          <div class="barra" :data-tipo="m.situacao.estado === 'batida' ? 'ok' : undefined" role="progressbar" :aria-valuenow="m.situacao.porcentagem" aria-valuemin="0" aria-valuemax="100" :aria-label="titulo(m)"><i :style="{ width: `${m.situacao.porcentagem}%` }" /></div>
          <span v-if="marca(m) !== null" class="ag-meta-esperado" :style="{ left: `${marca(m)}%` }" aria-hidden="true" :title="`Para estar em dia: ${m.situacao.esperado}`" />
        </div>
        <p class="m-0 mt-1.5 flex flex-wrap items-baseline justify-between gap-x-3 text-[13.5px] text-texto-2">
          <span><b class="font-semibold text-tinta tabular-nums"><Fracao :valor="m.situacao.feito" :total="m.situacao.alvo" /></b></span>
          <span class="min-w-0">{{ m.situacao.texto }}</span>
        </p>
      </li>
    </ul>
    <div v-else-if="!compacto" class="mt-4 rounded-[12px] bg-folha-2 p-4 text-[14px] text-texto-2">
      <p class="m-0">Uma meta ajuda a manter o ritmo. Por exemplo: responder 100 questões por semana, ou dominar 3 assuntos até a prova.</p>
      <button type="button" class="botao botao-p mt-3" @click="emit('nova')"><Plus :size="16" :stroke-width="2.2" aria-hidden="true" />Criar a primeira meta</button>
    </div>
    <p v-if="metas.some((m) => marca(m) !== null)" class="m-0 mt-3 flex items-center gap-2 text-[12.5px] text-texto-3">
      <span class="ag-meta-legenda" aria-hidden="true" />O risco na barra é onde você devia estar hoje para ficar em dia.
    </p>
  </section>
</template>

<style>
.ag-meta { padding: 14px 0; border-bottom: 1px solid var(--color-borda); }
.ag-meta:last-child { border-bottom: 0; padding-bottom: 0; }
.ag-meta-barra { position: relative; }
.ag-meta-esperado { position: absolute; top: -3px; bottom: -3px; width: 2px; margin-left: -1px; border-radius: 2px; background: var(--color-tinta); opacity: 0.7; }
.ag-meta-legenda { display: inline-block; width: 2px; height: 12px; border-radius: 2px; background: var(--color-tinta); opacity: 0.7; }
</style>
