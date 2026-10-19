// Prova de domínio: a última etapa para um assunto ficar Dominado (Motor de estudo, seção 2).
// Quando todos os critérios menos a prova estão cumpridos, o assunto fica "Pronto para a prova de domínio". A prova
// tem só questões do assunto, de nível difícil ou acima (o mínimo depende do ritmo), sem dica, e é corrigida no fim.
// Passou: o assunto vira Dominado. Não passou: nova tentativa a partir do dia seguinte (escolha do R, 14/10).
// Funções puras, usadas na página do assunto, no servidor ao montar a prova e ao concluir.
import { RITMOS, RITMO_PADRAO } from './ritmo.js'
import { TIPOS_AUTOCORRIGIDOS } from './provas.js'

// { questoes, minimoCertas, nivelMinimo } ou null (no ritmo Tranquilo o domínio não pede prova).
export const regraDaProvaDominio = (ritmo) => (RITMOS[ritmo] ?? RITMOS[RITMO_PADRAO]).dominado.provaDominio ?? null

// Minutos sugeridos: 3 por questão, como o simulado do ENEM.
export const MINUTOS_POR_QUESTAO_DOMINIO = 3
export const minutosDaProvaDominio = (regra) => (regra ? regra.questoes * MINUTOS_POR_QUESTAO_DOMINIO : 0)

const NOME_NIVEL_MINIMO = { 3: 'difícil ou acima', 4: 'muito difícil ou acima', 5: 'desafio extremo' }
export const textoDoNivelMinimo = (nivel) => NOME_NIVEL_MINIMO[nivel] ?? 'difícil ou acima'

// Questões do banco que servem: do tipo que o PGC corrige sozinho e no nível mínimo da regra.
export function questoesElegiveis(questoes, regra) {
  if (!regra) return []
  return (questoes ?? []).filter((q) => TIPOS_AUTOCORRIGIDOS.includes(q.tipo) && Number(q.nivel) >= regra.nivelMinimo)
}

// Situação da prova para a página do assunto e para o servidor antes de montar.
// estado: estado atual do assunto; elegiveis: quantas questões servem; ultima: { dia, aprovada } da última tentativa
// concluída; emAndamento: id de uma prova (qualquer) em andamento; hoje: dia de Brasília (número inteiro).
// Devolve { regra, pode, motivo, faltam? }. Motivos: sem_prova, dominado, andamento, criterios, amanha, questoes.
export function situacaoDaProvaDominio({ ritmo, estado, elegiveis = 0, ultima = null, emAndamento = null, hoje }) {
  const regra = regraDaProvaDominio(ritmo)
  if (!regra) return { regra: null, pode: false, motivo: 'sem_prova' }
  if (estado === 'dominado') return { regra, pode: false, motivo: 'dominado' }
  if (emAndamento) return { regra, pode: false, motivo: 'andamento', prova: emAndamento }
  if (estado !== 'pronto_para_prova') return { regra, pode: false, motivo: 'criterios' }
  if (ultima && !ultima.aprovada && Number(ultima.dia) >= Number(hoje)) return { regra, pode: false, motivo: 'amanha' }
  if (elegiveis < regra.questoes) return { regra, pode: false, motivo: 'questoes', faltam: regra.questoes - elegiveis }
  return { regra, pode: true, motivo: null }
}

// Resultado de uma prova de domínio já corrigida. itens: [{ resultado, dicas_usadas }].
export function resultadoDaProvaDominio(itens, regra) {
  const lista = itens ?? []
  const certas = lista.filter((i) => i.resultado === 'correta').length
  const usouDica = lista.some((i) => (i.dicas_usadas ?? i.dicas ?? 0) > 0)
  const aprovada = !!regra && lista.length >= regra.questoes && certas >= regra.minimoCertas && !usouDica
  return { certas, total: lista.length, minimo: regra?.minimoCertas ?? 0, aprovada, faltaram: aprovada ? 0 : Math.max(0, (regra?.minimoCertas ?? 0) - certas) }
}

// Uma prova de domínio guardada (revisoes.tipo = 'prova', prova.formato = 'dominio') no formato que
// provaDominioAprovada (dominio.js) entende.
export function provaDoRegistro(revisao) {
  const regra = revisao?.prova?.regra ?? {}
  return {
    assuntoId: revisao?.prova?.assuntoId ?? null,
    questoes: Number(revisao?.total ?? 0),
    certas: Number(revisao?.certas ?? 0),
    nivelMinimo: Number(regra.nivelMinimo ?? 0),
    usouDica: false, // a prova não tem dica
  }
}
