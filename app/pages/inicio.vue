<script setup>
// Início: o "hoje" do estudante. Em destaque, o próximo passo (uma ação só); ao lado, o dia (meta, pontos, dias
// seguidos); depois a semana em barras, a agenda dos próximos 14 dias, as matérias e os primeiros passos.
// No computador, duas colunas desiguais; no celular, uma coluna na ordem do que importa primeiro.
// Com ?bem_vindo=1 (logo depois do cadastro), o guia dá as boas-vindas e mostra o primeiro passo.
import { CalendarDays } from '@lucide/vue'
import { RITMOS } from '#shared/regras/ritmo.js'
import { avaliarPrimeirosPassos } from '#shared/regras/primeirosPassos.js'
import { diaISO, proximoPasso, somarDias } from '#shared/regras/inicio.js'

useHead({ title: 'Início | PGC' })

const supabase = useSupabaseClient()
const usuario = useSupabaseUser()
const route = useRoute()
const { data: perfil, error } = usePerfil()
const { data: estudo } = useResumoEstudo()
const { data: resumoQuestoes } = useResumoQuestoes()
const { data: todasMaterias } = useMaterias()
const estatisticas = useEstatisticas()

// Data calculada no servidor e reaproveitada no navegador (sem diferença na hidratação).
const hojeIso = useState('pgc-hoje-iso', () => diaISO())
const hoje = useState('pgc-hoje', () => {
  const texto = new Intl.DateTimeFormat('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'America/Sao_Paulo' }).format(new Date())
  return texto.charAt(0).toUpperCase() + texto.slice(1)
})

const ritmo = computed(() => RITMOS[perfil.value?.ritmo] ?? RITMOS.normal)
const meta = computed(() => ritmo.value.metaDiariaQuestoes)
const passos = computed(() => avaliarPrimeirosPassos(estatisticas.value))
const materias = computed(() => (todasMaterias.value ?? []).filter((m) => !m.arquivada_em))
// Metas (a partir da Agenda): aparecem aqui, resumidas, quando a pessoa tem alguma.
const { data: dadosMetas } = useListaMetas()
const materiasPorIdMetas = computed(() => Object.fromEntries((todasMaterias.value ?? []).map((m) => [m.id, m])))
// Assuntos prontos para a prova de domínio (estado guardado no fim de cada estudo).
const { data: numerosMaterias } = useNumerosMaterias()
const prontos = computed(() => {
  const estados = numerosMaterias.value?.estados ?? {}
  return materias.value.flatMap((m) => (m.assuntos ?? []).filter((a) => !a.arquivado_em && estados[a.id]?.estado === 'pronto_para_prova').map((a) => ({ id: a.id, nome: a.nome })))
})
const proximo = computed(() => proximoPasso({ estudo: estudo.value, passos: passos.value, meta: meta.value, prontos: prontos.value }))

// Boas-vindas: no lugar do próximo passo quando ele seria o mesmo (criar a primeira matéria).
const bemVindo = computed(() => route.query.bem_vindo === '1')
const semMateria = computed(() => materias.value.length === 0)
const mostrarProximo = computed(() => !(bemVindo.value && semMateria.value && proximo.value.tipo === 'passo'))
function fecharBoasVindas() {
  navigateTo({ path: '/inicio' }, { replace: true })
}

// Agenda: hoje e os próximos 14 dias, sem os já concluídos.
const { data: eventos, status: statusAgenda } = useAsyncData('inicio-agenda', async () => {
  if (!usuario.value) return []
  const { data, error: erro } = await supabase
    .from('agenda_eventos')
    .select('id, tipo, titulo, data, hora, materia_id, concluido_em')
    .gte('data', hojeIso.value)
    .lte('data', somarDias(hojeIso.value, 14))
    .is('concluido_em', null)
    .order('data')
    .order('hora', { nullsFirst: true })
    .limit(40)
  return erro ? [] : (data ?? [])
}, { default: () => [], watch: [() => usuario.value?.sub] })

// Questões que esperam revisão hoje, por matéria (as atrasadas contam hoje).
const { data: revisoesHoje } = useAsyncData('inicio-revisoes-hoje', async () => {
  if (!usuario.value) return []
  const { data, error: erro } = await supabase.rpc('agenda_revisoes', { p_inicio: hojeIso.value, p_fim: hojeIso.value })
  return erro ? [] : (data ?? [])
}, { default: () => [], watch: [() => usuario.value?.sub] })
const vencidasPorMateria = computed(() => Object.fromEntries((revisoesHoje.value?.[0]?.materias ?? []).map((m) => [m.materia_id, m.n])))
</script>

<template>
  <div class="mx-auto w-full max-w-[1180px]">
    <p class="m-0 mb-2 flex items-center gap-2 text-[14px] font-semibold text-texto-2">
      <CalendarDays :size="16" :stroke-width="2" aria-hidden="true" />
      <span>{{ hoje }}</span>
    </p>
    <TituloPagina>Olá, {{ perfil?.nome_exibicao || 'tudo bem' }}</TituloPagina>

    <p v-if="error" class="m-0 mt-4 text-[15px] font-semibold text-erro" role="alert">Não deu para carregar o seu perfil agora. Recarregue a página.</p>

    <Transition name="abre">
      <div v-if="bemVindo">
        <InicioBemVindo class="entra mt-6" style="--i: 0" :nome="perfil?.nome_exibicao ?? ''" :sem-materia="semMateria" @fechar="fecharBoasVindas" />
      </div>
    </Transition>

    <!-- Celular: uma coluna, na ordem dos "order-*". Computador: duas colunas desiguais (as colunas viram "contents"). -->
    <div class="mt-6 flex flex-col gap-5 lg:grid lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)] lg:items-start">
      <div class="contents lg:flex lg:flex-col lg:gap-5">
        <InicioProximoPasso v-if="mostrarProximo" class="entra order-1 lg:order-none" style="--i: 1" :passo="proximo" :passos="passos" />
        <InicioSemana
          class="entra order-4 lg:order-none"
          style="--i: 3"
          :por-dia="estudo?.por_dia ?? []"
          :semana="estudo?.semana ?? 0"
          :semana-anterior="estudo?.semana_anterior ?? 0"
          :hoje-iso="hojeIso"
        />
        <InicioMaterias
          class="entra order-5 lg:order-none"
          style="--i: 5"
          :materias="materias"
          :vencidas="vencidasPorMateria"
          :no-banco="resumoQuestoes?.em_revisao ?? 0"
          :sem-acao="bemVindo"
        />
      </div>
      <div class="contents lg:flex lg:flex-col lg:gap-5">
        <InicioHoje
          class="entra order-2 lg:order-none"
          style="--i: 2"
          :feitas="estudo?.hoje ?? 0"
          :meta="meta"
          :ritmo="ritmo.nome"
          :pontos-hoje="estudo?.pontos_hoje ?? 0"
          :dias-seguidos="estudo?.dias_seguidos ?? 0"
        />
        <InicioAgenda
          class="entra order-3 lg:order-none"
          style="--i: 4"
          :eventos="eventos ?? []"
          :materias="materias"
          :hoje-iso="hojeIso"
          :carregando="statusAgenda === 'pending'"
        />
        <AgendaMetas v-if="dadosMetas?.metas?.length" compacto class="entra order-3 lg:order-none" style="--i: 5" :materias="materiasPorIdMetas" />
        <InicioPassos v-if="!passos.concluido" v-revelar class="entra order-6 lg:order-none" style="--i: 6" :passos="passos" />
      </div>
    </div>
  </div>
</template>
