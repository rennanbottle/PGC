<script setup>
// "Confira rapidinho": mostra as páginas que o PGC tirou do arquivo (ou do texto colado) como folhinhas,
// para a pessoa bater o olho. "Está bom, usar tudo" aprova tudo de uma vez; "Ajustar páginas" abre o editor.
// Uso: <MateriaisConfiraRapido :material-id="id" :versao-id="v" titulo="Apostila" @aprovado="..." />
import { Check, CircleAlert, SlidersHorizontal } from '@lucide/vue'

const props = defineProps({
  materialId: { type: String, required: true },
  versaoId: { type: String, default: '' },
  titulo: { type: String, default: '' },
  // Arquivo PDF tem "páginas"; DOCX, TXT e texto colado têm "partes".
  unidade: { type: String, default: 'página' },
})
const emit = defineEmits(['aprovado'])

const supabase = useSupabaseClient()
const api = useMateriais()
const { avisar } = useAvisos()

const { data, pending } = useAsyncData(`confira-${props.materialId}`, async () => {
  let versaoId = props.versaoId
  if (!versaoId) {
    const { data: v } = await supabase.from('material_versoes').select('id, numero').eq('material_id', props.materialId).order('numero', { ascending: false }).limit(1).maybeSingle()
    versaoId = v?.id ?? ''
  }
  if (!versaoId) return { versaoId: '', paginas: [] }
  const [{ data: paginas }, { data: trechos }] = await Promise.all([
    supabase.from('material_paginas').select('numero, palavras').eq('versao_id', versaoId).order('numero'),
    supabase.from('material_trechos').select('pagina, ordem, texto, usar_em_questoes').eq('versao_id', versaoId).order('ordem').limit(600),
  ])
  const porPagina = {}
  for (const t of trechos ?? []) {
    if (!t.usar_em_questoes) continue
    porPagina[t.pagina] = `${porPagina[t.pagina] ?? ''} ${t.texto}`.slice(0, 420)
  }
  return {
    versaoId,
    paginas: (paginas ?? []).map((p) => ({ numero: p.numero, palavras: p.palavras ?? 0, texto: (porPagina[p.numero] ?? '').trim() })),
  }
}, { default: () => ({ versaoId: '', paginas: [] }) })

const plural = (n, um, varios) => `${n} ${n === 1 ? um : varios}`
const unidades = computed(() => (props.unidade === 'página' ? ['página', 'páginas'] : ['parte', 'partes']))
const total = computed(() => data.value.paginas.length)
const palavras = computed(() => data.value.paginas.reduce((s, p) => s + p.palavras, 0))

const aprovando = ref(false)
const erro = ref('')
async function aprovar() {
  if (!data.value.versaoId) return
  aprovando.value = true
  erro.value = ''
  try {
    await api.aprovarTudo(props.materialId, data.value.versaoId)
    avisar({ texto: 'Texto aprovado. Já dá para gerar questões dele.', tipo: 'ok' })
    emit('aprovado')
  }
  catch (e) {
    erro.value = e.message
  }
  aprovando.value = false
}
</script>

<template>
  <section class="confira" aria-labelledby="titulo-confira">
    <div class="flex items-start gap-4">
      <GuiaPersonagem humor="pensando" :tamanho="56" class="hidden shrink-0 sm:block" />
      <div class="min-w-0">
        <h3 id="titulo-confira" class="titulo-cartao">Confira rapidinho</h3>
        <p class="m-0 mt-1 text-[14.5px] leading-normal text-texto-2">
          <template v-if="pending">Abrindo o que o PGC leu...</template>
          <template v-else>O PGC leu {{ plural(total, unidades[0], unidades[1]) }}<template v-if="titulo"> de "{{ titulo }}"</template>, {{ new Intl.NumberFormat('pt-BR').format(palavras) }} palavras. Veja se o texto saiu certo.</template>
        </p>
      </div>
    </div>

    <ol class="folhas m-0 mt-4 list-none p-0" :aria-label="`${unidades[1]} lidas`">
      <template v-if="pending">
        <li v-for="i in 4" :key="i" class="folhinha esqueleto" aria-hidden="true" />
      </template>
      <li v-for="p in data.paginas" v-else :key="p.numero" class="folhinha">
        <p class="m-0 line-clamp-6 text-[12px] leading-[1.45] text-texto-2">{{ p.texto || 'Sem texto para questões nesta parte.' }}</p>
        <span class="mt-auto pt-2 text-[11.5px] font-semibold text-texto-3">{{ unidade === 'página' ? 'Página' : 'Parte' }} {{ p.numero }}</span>
      </li>
    </ol>

    <p v-if="erro" class="erro-campo" role="alert"><CircleAlert :size="16" :stroke-width="2" aria-hidden="true" class="mt-px shrink-0" />{{ erro }}</p>
    <div class="mt-4 flex flex-wrap items-center gap-2.5">
      <button type="button" class="botao" :aria-busy="aprovando" :disabled="aprovando || pending || !total" @click="aprovar">
        <span v-if="aprovando" class="rodando" aria-hidden="true" />
        <Check v-else :size="18" :stroke-width="2.3" aria-hidden="true" />
        Está bom, usar tudo
      </button>
      <NuxtLink :to="`/materiais/${materialId}/conferir`" class="botao-fantasma botao-p h-10">
        <SlidersHorizontal :size="16" :stroke-width="2" aria-hidden="true" />Ajustar {{ unidades[1] }}
      </NuxtLink>
    </div>
  </section>
</template>

<style scoped>
.folhas {
  display: flex;
  gap: 10px;
  overflow-x: auto;
  padding-bottom: 6px;
  scroll-snap-type: x mandatory;
}
.folhinha {
  display: flex;
  flex: 0 0 168px;
  flex-direction: column;
  height: 168px;
  padding: 12px 12px 10px;
  border: 1px solid var(--borda);
  border-radius: 12px;
  background: var(--folha);
  scroll-snap-align: start;
  animation: entra 0.4s var(--ease-saida) backwards;
}
.folhinha:nth-child(2) { animation-delay: 60ms; }
.folhinha:nth-child(3) { animation-delay: 120ms; }
.folhinha:nth-child(4) { animation-delay: 180ms; }
.folhinha.esqueleto {
  border: 0;
}
@media (prefers-reduced-motion: reduce) {
  .folhinha { animation: none; }
}
:global(:root.menos-movimento) .folhinha {
  animation: none;
}
</style>
