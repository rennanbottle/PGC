// Números que destravam telas e primeiros passos.
// Contam: matérias, materiais, questões e bancos importados, e (Etapa 7) revisões, respostas, assuntos e nível.
// O servidor vai conferir a mesma regra antes de liberar cada tela.
import { ESTATISTICAS_VAZIAS } from '#shared/regras/desbloqueios.js'
import { nivelPorPontos } from '#shared/regras/pontos.js'

export function useEstatisticas() {
  const { data: materias } = useMaterias()
  const { data: materiais } = useMateriais()
  const { data: resumo } = useResumoQuestoes()
  const { data: bancos } = useBancos()
  const { data: estudo } = useResumoEstudo()
  return computed(() => {
    const ativos = (materiais.value ?? []).filter((m) => !m.arquivado_em)
    const prontos = ativos.filter((m) => m.status === 'pronto')
    return {
      ...ESTATISTICAS_VAZIAS,
      materias: (materias.value ?? []).filter((m) => !m.arquivada_em).length,
      materiaisEnviados: ativos.filter((m) => m.status !== 'erro').length,
      materiaisAprovados: prontos.length,
      materiasComMaterial: new Set(prontos.map((m) => m.materia_id)).size,
      questoesNoBanco: resumo.value?.em_revisao ?? 0,
      bancosImportados: (bancos.value ?? []).filter((b) => b.status === 'concluido' || b.status === 'aguardando_conferencia').length,
      revisoesConcluidas: estudo.value?.revisoes_concluidas ?? 0,
      revisoesCom5: estudo.value?.revisoes_com5 ?? 0,
      revisoesCom10: estudo.value?.revisoes_com10 ?? 0,
      questoesRespondidas: estudo.value?.respondidas ?? 0,
      tiposUsados: estudo.value?.tipos_usados ?? 0,
      assuntosProficientes: estudo.value?.proficientes ?? 0,
      assuntosDominados: estudo.value?.dominados ?? 0,
      nivel: nivelPorPontos(estudo.value?.pontos ?? 0),
    }
  })
}
