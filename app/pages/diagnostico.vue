<script setup>
// Diagnóstico de IA, só para quem está em sistema_donos (o servidor devolve 404 para os outros).
// Pergunta nº 1: "a IA está funcionando hoje?". Abre com as gerações do dia e a cota grátis gasta de cada serviço;
// ao lado, as falhas da semana por motivo e o aviso de saúde; embaixo, o catálogo na ordem da cascata, com teste manual.
import { Activity, CircleAlert, CircleCheck, FlaskConical, Gauge, ListOrdered, Play, ShieldAlert } from '@lucide/vue'
import { tempoRelativo } from '#shared/regras/tempo.js'

useHead({ title: 'Diagnóstico de IA | PGC' })
const { data, error, refresh } = await useFetch('/api/ia/diagnostico')
if (error.value?.statusCode === 404) throw createError({ statusCode: 404, statusMessage: 'Página não encontrada', fatal: true })

const dias = computed(() => data.value?.dias ?? [])
const hoje = computed(() => dias.value.at(-1) ?? { pedidos: 0, ok: 0 })
const ontem = computed(() => dias.value.at(-2) ?? { pedidos: 0, ok: 0 })
const diferenca = computed(() => hoje.value.pedidos - ontem.value.pedidos)
const textoDiferenca = computed(() => {
  const d = diferenca.value
  if (!d) return 'Igual a ontem'
  return `${d > 0 ? '+' : ''}${d} que ontem`
})

// Barras dos últimos 14 dias (o último é hoje).
const DIA_CURTO = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S']
const formatoDica = new Intl.DateTimeFormat('pt-BR', { day: 'numeric', month: 'numeric', timeZone: 'America/Sao_Paulo' })
const barras = computed(() => {
  const agora = new Date()
  return dias.value.map((d, i) => {
    const data = new Date(agora.getTime() - (dias.value.length - 1 - i) * 86400000)
    return {
      rotulo: DIA_CURTO[data.getDay()],
      valor: d.pedidos,
      destaque: i === dias.value.length - 1,
      dica: `${i === dias.value.length - 1 ? 'Hoje' : formatoDica.format(data)}: ${d.pedidos}, ${d.ok} ok`,
    }
  })
})
const descricaoBarras = computed(() => `Pedidos por dia nos últimos 14 dias. Hoje: ${hoje.value.pedidos}. Total: ${dias.value.reduce((s, d) => s + d.pedidos, 0)}.`)

const FALHAS = [['limite', 'Limite do serviço'], ['saida_invalida', 'Resposta fora do formato'], ['tempo_esgotado', 'Tempo esgotado'], ['http', 'Erro do servidor'], ['sem_chave', 'Sem chave']]
const falhas = computed(() => FALHAS.map(([id, nome]) => ({ id, nome, n: Number(data.value?.falhas?.[id] ?? 0) })))
const totalFalhas = computed(() => falhas.value.reduce((s, f) => s + f.n, 0))
const maiorFalha = computed(() => Math.max(1, ...falhas.value.map((f) => f.n)))
const pct = (a, b) => (b ? `${(Math.round((a / b) * 1000) / 10).toLocaleString('pt-BR')}%` : '0%')
const NOMES = { groq: 'Groq', cloudflare: 'Cloudflare', gemini: 'Gemini', openrouter: 'OpenRouter' }
const TAREFAS = { gerar: 'gerar', refazer: 'refazer', gabarito: 'gabarito', teste: 'teste' }
const formatar = (n) => (n >= 10000 ? `${Math.round(n / 1000).toLocaleString('pt-BR')} mil` : Math.round(n).toLocaleString('pt-BR'))

// Situação de cada modelo: selo com texto (nunca só cor).
function situacao(m) {
  if (!m.temChave) return { texto: 'Sem chave', tipo: 'erro' }
  if (!m.ativo) return { texto: 'Desligado', tipo: '' }
  if (m.pausado_ate && new Date(m.pausado_ate) > new Date()) {
    const hora = new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' }).format(new Date(m.pausado_ate))
    return { texto: `Pausado até ${hora}`, tipo: 'aviso' }
  }
  return { texto: 'Ativo', tipo: 'ok' }
}

const testando = ref('')
const resultado = ref({})
const erro = ref('')
async function testar(modeloId = null) {
  erro.value = ''
  testando.value = modeloId ?? 'todos'
  try {
    const r = await $fetch('/api/ia/testar', { method: 'POST', body: modeloId ? { modeloId } : {} })
    for (const x of r.resultados) resultado.value[x.id] = x
    await refresh()
  }
  catch (e) {
    erro.value = e?.data?.statusMessage ?? 'O teste não rodou. Tente de novo.'
  }
  testando.value = ''
}
const MOTIVO = { limite: 'limite', saida_invalida: 'formato', tempo_esgotado: 'tempo', http: 'erro', sem_chave: 'sem chave' }
const textoResultado = (r) => (r.ok ? `ok, ${(Math.round(r.latencia / 100) / 10).toLocaleString('pt-BR')} s` : `falhou: ${MOTIVO[r.categoria] ?? 'erro'}`)
</script>

<template>
  <div v-if="data" class="mx-auto w-full max-w-[1180px]">
    <CabecalhoPagina
      titulo="Diagnóstico de IA"
      descricao="Só você vê esta tela. Nenhum texto ou resposta fica guardado."
      :voltar="{ para: '/perfil#sessao', texto: 'Perfil' }"
    >
      <template #acoes>
        <button type="button" class="botao-secundario" :aria-busy="testando === 'todos'" :disabled="!!testando" @click="testar()">
          <FlaskConical :size="17" :stroke-width="2" aria-hidden="true" />
          <span>{{ testando === 'todos' ? 'Testando' : 'Testar todos' }}</span>
        </button>
      </template>
    </CabecalhoPagina>
    <EntradaAvisoErro caixa class="mt-5" :mensagem="erro" />

    <div class="mt-6 grid gap-4 lg:grid-cols-[1.6fr_1fr]">
      <!-- Principal: hoje -->
      <section class="cartao entra flex flex-col lg:row-span-2" style="--i: 0" aria-labelledby="titulo-hoje">
        <h2 id="titulo-hoje" class="m-0 flex items-center gap-2 text-[14px] font-semibold text-texto-2">
          <Activity :size="17" :stroke-width="2" aria-hidden="true" />
          <span>Gerações hoje, todas as contas</span>
        </h2>
        <div class="mt-3 flex flex-wrap items-end gap-x-5 gap-y-2">
          <p class="m-0 flex items-baseline gap-2">
            <span class="numero-grande tabular-nums"><NumeroAnimado :valor="hoje.pedidos" /></span>
            <span class="text-[16px] font-semibold text-texto-2">{{ hoje.pedidos === 1 ? 'pedido' : 'pedidos' }}</span>
          </p>
          <p class="m-0 mb-1.5 flex items-baseline gap-1.5 text-[15px] text-texto-2">
            <Fracao :valor="hoje.ok" :total="hoje.pedidos" />
            <span>resolvidos</span>
          </p>
          <span class="selo mb-2">{{ textoDiferenca }}</span>
        </div>
        <div class="mb-6 mt-4 overflow-x-clip">
          <GraficoBarras :dados="barras" :altura="104" :descricao="descricaoBarras" />
          <p class="m-0 mt-2 text-[12.5px] text-texto-3">Pedidos por dia, últimos 14 dias. Passe o mouse para ver cada dia.</p>
        </div>

        <div class="mt-auto grid gap-5 border-t border-borda pt-4 sm:grid-cols-2">
          <div v-for="(c, provedor) in data.cotas" :key="provedor">
            <p class="m-0 flex items-center gap-1.5 text-[13.5px] font-semibold">
              <Gauge :size="15" :stroke-width="2" class="text-texto-2" aria-hidden="true" />
              <span>{{ NOMES[provedor] }}, {{ c.rotulo }} do dia</span>
            </p>
            <p class="m-0 mt-1.5 flex items-baseline gap-1.5">
              <span class="numero-medio tabular-nums">{{ formatar(c.gasto) }}</span>
              <span class="text-[13.5px] text-texto-3">/{{ formatar(c.limite) }}</span>
            </p>
            <div class="barra mt-2" role="img" :aria-label="`${pct(c.gasto, c.limite)} usado`">
              <i :style="{ width: `${Math.min(100, (c.gasto / c.limite) * 100)}%` }" />
            </div>
            <p class="m-0 mt-1.5 text-[12.5px] text-texto-3">{{ pct(c.gasto, c.limite) }} usado. Zera às 21h de Brasília.</p>
          </div>
        </div>
      </section>

      <!-- Falhas da semana -->
      <section class="cartao entra" style="--i: 1" aria-labelledby="titulo-falhas">
        <h2 id="titulo-falhas" class="m-0 flex items-center gap-2 text-[14px] font-semibold text-texto-2">
          <CircleAlert :size="17" :stroke-width="2" aria-hidden="true" />
          <span>Falhas, últimos 7 dias</span>
        </h2>
        <p class="m-0 mt-2 flex items-baseline gap-2">
          <Fracao :valor="totalFalhas" :total="data.tentativas_7d" class="numero-medio" />
          <span class="text-[13.5px] text-texto-2">tentativas, {{ pct(totalFalhas, data.tentativas_7d) }}</span>
        </p>
        <ul class="m-0 mt-4 flex list-none flex-col gap-2.5 p-0">
          <li v-for="f in falhas" :key="f.id" class="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_24px] items-center gap-3 text-[13.5px]">
            <span class="truncate">{{ f.nome }}</span>
            <span class="barra" aria-hidden="true"><i :style="{ width: `${(f.n / maiorFalha) * 100}%` }" /></span>
            <b class="text-right tabular-nums">{{ f.n }}</b>
          </li>
        </ul>
      </section>

      <!-- Saúde -->
      <section class="cartao entra" style="--i: 2" aria-labelledby="titulo-saude">
        <h2 id="titulo-saude" class="m-0 flex items-center gap-2 text-[14px] font-semibold text-texto-2">
          <ShieldAlert :size="17" :stroke-width="2" aria-hidden="true" />
          <span>Aviso de saúde</span>
        </h2>
        <p v-if="data.sem_modelo_6h" class="m-0 mt-3 flex items-start gap-2 text-[15px] font-semibold text-erro">
          <CircleAlert :size="18" :stroke-width="2.1" class="mt-px shrink-0" aria-hidden="true" />
          <span>{{ data.sem_modelo_6h }} {{ data.sem_modelo_6h === 1 ? 'pedido ficou' : 'pedidos ficaram' }} sem modelo nas últimas 6 horas.</span>
        </p>
        <p v-else class="m-0 mt-3 flex items-start gap-2 text-[15px] font-semibold text-ok">
          <CircleCheck :size="18" :stroke-width="2.1" class="mt-px shrink-0" aria-hidden="true" />
          <span>Nenhum pedido ficou sem modelo nas últimas 6 horas.</span>
        </p>
        <p class="m-0 mt-1.5 text-[13.5px] leading-[1.45] text-texto-2">Quando todos os modelos falham, a pessoa recebe o pedido para usar outra IA e nada sai da cota dela.</p>
      </section>
    </div>

    <!-- Catálogo -->
    <section class="cartao entra mt-4 !px-0 !pb-2" style="--i: 3" aria-labelledby="titulo-catalogo">
      <div class="px-5 sm:px-6">
        <h2 id="titulo-catalogo" class="titulo-secao flex items-center gap-2.5">
          <ListOrdered :size="20" :stroke-width="2" class="text-texto-2" aria-hidden="true" />
          <span>Catálogo, na ordem da cascata</span>
        </h2>
        <p class="m-0 mt-1 max-w-[760px] text-[14px] leading-[1.45] text-texto-2">
          O PGC tenta do primeiro ao último que estiver ativo, faz a tarefa e pode ler aquele texto. Três falhas seguidas pausam o modelo por 15 min, dobrando até 6 h.
        </p>
      </div>
      <div class="mt-3 overflow-x-auto px-5 sm:px-6">
        <table class="w-full min-w-[860px] border-collapse text-left text-[14px]">
          <thead>
            <tr class="text-[12.5px] text-texto-3">
              <th class="py-2 pr-3 font-semibold">Ordem</th>
              <th class="py-2 pr-3 font-semibold">Serviço</th>
              <th class="py-2 pr-3 font-semibold">Modelo</th>
              <th class="py-2 pr-3 font-semibold">Tarefas</th>
              <th class="py-2 pr-3 font-semibold">Treina com os dados</th>
              <th class="py-2 pr-3 font-semibold">Situação</th>
              <th class="py-2 pr-3 font-semibold">Falhas seguidas</th>
              <th class="py-2 pr-3 font-semibold">Último ok</th>
              <th class="py-2 font-semibold"><span class="so-leitor">Testar</span></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(m, i) in data.modelos" :key="m.id" class="border-t border-borda">
              <td class="py-3 pr-3 font-semibold tabular-nums text-texto-2">{{ i + 1 }}</td>
              <td class="py-3 pr-3 font-semibold">{{ NOMES[m.provedor] ?? m.provedor }}</td>
              <td class="break-all py-3 pr-3 font-mono text-[12.5px]">{{ m.modelo }}</td>
              <td class="py-3 pr-3 text-texto-2">{{ m.tarefas.map((t) => TAREFAS[t] ?? t).join(', ') }}</td>
              <td class="py-3 pr-3">{{ m.treina_com_dados ? 'Sim' : 'Não' }}</td>
              <td class="py-3 pr-3"><span class="selo" :data-tipo="situacao(m).tipo || undefined">{{ situacao(m).texto }}</span></td>
              <td class="py-3 pr-3 tabular-nums">{{ m.falhas_seguidas }}</td>
              <td class="py-3 pr-3 text-texto-2">{{ m.ultimo_sucesso_em ? tempoRelativo(m.ultimo_sucesso_em) : 'nunca' }}</td>
              <td class="py-3 text-right">
                <div class="flex items-center justify-end gap-2.5">
                  <span v-if="resultado[m.id]" class="selo" :data-tipo="resultado[m.id].ok ? 'ok' : 'erro'" role="status">{{ textoResultado(resultado[m.id]) }}</span>
                  <button
                    v-if="m.temChave"
                    type="button"
                    class="botao-secundario botao-p"
                    :aria-busy="testando === m.id"
                    :disabled="!!testando"
                    :aria-label="`Testar ${NOMES[m.provedor] ?? m.provedor}, ${m.modelo}`"
                    @click="testar(m.id)"
                  >
                    <Play :size="14" :stroke-width="2.2" aria-hidden="true" />
                    <span>{{ testando === m.id ? 'Testando' : 'Testar' }}</span>
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <p class="ajuda px-5 sm:px-6">Teste manual: até 10 por hora ({{ data.testes_ultima_hora }} nesta hora). A chave nunca aparece aqui, só o nome da variável no servidor.</p>
    </section>
  </div>
</template>
