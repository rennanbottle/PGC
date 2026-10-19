// Estado de domínio de um assunto. Junta três medidas independentes:
// 1. proficiência (Elo com chance de chute, família da TRI): quão difícil é o que a pessoa acerta;
// 2. retenção (FSRS): quanto ela ainda lembra hoje;
// 3. profundidade (Taxonomia de Bloom revisada): em que tipo de pensamento ela acerta.
// Mais critérios de quantidade, espaçamento, variedade e uma prova de domínio.
// Função pura. `dia` é número de dias (pode ter fração); `hoje` idem.

import { atualizar, B_INICIAL, escala, credito } from './proficiencia.js'
import { revisar, retencao } from './retencao.js'
import { RITMOS, RITMO_PADRAO } from './ritmo.js'

export const BLOOM = ['', 'Lembrar', 'Entender', 'Aplicar', 'Analisar', 'Avaliar', 'Criar']
export const JANELA_DIAS = 60
export const ULTIMAS = 15

export const ESTADOS = {
  nao_iniciado: 'Não iniciado',
  iniciando: 'Iniciando',
  com_dificuldade: 'Com dificuldade',
  em_desenvolvimento: 'Em desenvolvimento',
  proficiente: 'Proficiente',
  pronto_para_prova: 'Pronto para a prova de domínio',
  dominado: 'Dominado',
  relembrar: 'Precisa relembrar',
}

// Nota FSRS do dia de estudo a partir do crédito médio (dica e parcial reduzem).
export function notaDoDia(lista) {
  const media = lista.reduce((s, r) => s + credito(r.resultado, r.dicas), 0) / lista.length
  if (media < 0.6) return 1
  if (media < 0.8) return 2
  return 3
}

const acertouSemDica = (r) => r.resultado === 'correta' && !(r.dicas > 0)

// Prova de domínio aprovada: a mais recente, feita depois da última queda, com questões suficientes.
export function provaDominioAprovada(provas, regra) {
  if (!regra) return true
  return provas.some((p) => p.questoes >= regra.questoes && p.certas >= regra.minimoCertas && p.nivelMinimo >= regra.nivelMinimo && !p.usouDica)
}

export function avaliarAssunto(respostas, hoje, { ritmo = RITMO_PADRAO, provasDominio = [] } = {}) {
  const cfg = RITMOS[ritmo] ?? RITMOS[RITMO_PADRAO]
  const ordenadas = [...respostas].sort((a, b) => a.dia - b.dia)
  if (ordenadas.length === 0) return { estado: 'nao_iniciado', checklist: [], proficiencia: null, retencao: null, respostas: 0, dias: 0 }

  // Proficiência: reprocessa todas as respostas.
  let aluno = { theta: 0, n: 0 }
  let bMaxAcertado = -Infinity
  const questoes = new Map()
  for (const r of ordenadas) {
    const q = questoes.get(r.questaoId) ?? { tipo: r.tipo, alternativas: r.alternativas ?? 5, b: B_INICIAL[r.nivel], m: 0 }
    const out = atualizar(aluno, q, r)
    aluno = out.aluno
    questoes.set(r.questaoId, out.questao)
    if (acertouSemDica(r)) bMaxAcertado = Math.max(bMaxAcertado, q.b)
  }
  // Teto de evidência: não mostra mais que 1 ponto (100 na escala) acima da questão mais difícil acertada sem dica.
  // Sem nenhum acerto limpo, o teto é o de quem só acertou questão fácil (450).
  const teto = (Number.isFinite(bMaxAcertado) ? bMaxAcertado : B_INICIAL[1]) + 1
  const prof = escala(Math.min(aluno.theta, teto))

  // Retenção do assunto: cada dia de estudo é uma revisão FSRS.
  const porDia = new Map()
  for (const r of ordenadas) {
    const d = Math.floor(r.dia)
    if (!porDia.has(d)) porDia.set(d, [])
    porDia.get(d).push(r)
  }
  let cartao = null
  for (const [d, lista] of porDia) cartao = revisar(cartao, notaDoDia(lista), d)
  const ret = retencao(Math.max(0, hoje - cartao.ultimo), cartao.S)

  // Evidência recente.
  const recentes = ordenadas.filter((r) => hoje - r.dia <= JANELA_DIAS)
  const diasRecentes = [...new Set(recentes.map((r) => Math.floor(r.dia)))]
  const periodo = diasRecentes.length ? Math.max(...diasRecentes) - Math.min(...diasRecentes) : 0
  const certas = recentes.filter(acertouSemDica)
  const dificeis = recentes.filter((r) => r.nivel >= 3).length
  const muitoDificeisCertas = certas.filter((r) => r.nivel >= 4).length
  const niveisBloom = new Set(certas.map((r) => r.bloom)).size
  const aplicarMais = certas.filter((r) => r.bloom >= 3).length
  const analisarMais = certas.filter((r) => r.bloom >= 4).length
  const tipos = new Set(certas.map((r) => r.tipo)).size
  const ultimas = ordenadas.slice(-ULTIMAS)
  const acertoUltimas = ultimas.reduce((s, r) => s + credito(r.resultado, r.dicas), 0) / ultimas.length
  let seq = 0
  let piorSequencia = 0
  for (const r of ultimas) {
    seq = r.resultado === 'incorreta' ? seq + 1 : 0
    piorSequencia = Math.max(piorSequencia, seq)
  }
  const ultimoDia = ordenadas[ordenadas.length - 1].dia
  const diasSemEstudar = Math.max(0, hoje - ultimoDia)

  const D = cfg.dominado
  const item = (id, texto, ok, valor, meta) => ({ id, texto, ok, valor, meta })
  const checklist = [
    item('proficiencia', 'Proficiência', prof >= D.proficiencia, prof, D.proficiencia),
    item('respostas', `Respostas nos últimos ${JANELA_DIAS} dias`, recentes.length >= D.respostas, recentes.length, D.respostas),
    item('dias', 'Dias diferentes de estudo', diasRecentes.length >= D.dias, diasRecentes.length, D.dias),
    item('periodo', 'Dias entre o primeiro e o último estudo', periodo >= D.periodoDias, periodo, D.periodoDias),
    item('dificeis', 'Respostas em nível difícil ou acima', dificeis >= D.dificeis, dificeis, D.dificeis),
    item('muito_dificeis', 'Acertos sem dica em muito difícil ou acima', muitoDificeisCertas >= D.muitoDificeisCertas, muitoDificeisCertas, D.muitoDificeisCertas),
    item('bloom', 'Níveis de pensamento com acerto', niveisBloom >= D.niveisBloom, niveisBloom, D.niveisBloom),
    item('analisar', 'Acertos em Analisar ou acima', analisarMais >= D.analisarMais, analisarMais, D.analisarMais),
    item('tipos', 'Tipos de questão diferentes com acerto', tipos >= D.tiposDiferentes, tipos, D.tiposDiferentes),
    item('retencao', 'Retenção estimada hoje (%)', ret >= D.retencao, Math.round(ret * 100), Math.round(D.retencao * 100)),
    item('ultimas', `Acerto nas últimas ${ULTIMAS} (%)`, acertoUltimas >= D.acertoUltimas, Math.round(acertoUltimas * 100), Math.round(D.acertoUltimas * 100)),
    item('estabilidade', `Pior sequência de erros nas últimas ${ULTIMAS}`, piorSequencia < 3, piorSequencia, 'menos de 3'),
    item('recente', 'Dias desde o último estudo', diasSemEstudar <= D.recenteDias, Math.floor(diasSemEstudar), `até ${D.recenteDias}`),
  ]
  const semProva = checklist.every((c) => c.ok)
  const provaOk = provaDominioAprovada(provasDominio, D.provaDominio)
  if (D.provaDominio) {
    checklist.push(item('prova', 'Prova de domínio', provaOk, provaOk ? 'aprovada' : 'pendente', `${D.provaDominio.minimoCertas}/${D.provaDominio.questoes} sem dica`))
  }

  const P = cfg.proficiente
  const proficiente =
    prof >= P.proficiencia && recentes.length >= P.respostas && diasRecentes.length >= P.dias && aplicarMais >= P.aplicarMais && dificeis >= P.dificeis

  let estado
  if (semProva && provaOk) estado = 'dominado'
  else if (semProva) estado = 'pronto_para_prova'
  else if (ordenadas.length >= 6 && prof >= P.proficiencia && (ret < 0.7 || diasSemEstudar > D.recenteDias)) estado = 'relembrar'
  else if (ordenadas.length < 6) estado = 'iniciando'
  else if (prof < 400) estado = 'com_dificuldade'
  else if (proficiente) estado = 'proficiente'
  else estado = 'em_desenvolvimento'

  return {
    estado,
    proficiencia: prof,
    theta: aluno.theta,
    n: aluno.n,
    retencao: Math.round(ret * 100),
    respostas: recentes.length,
    dias: diasRecentes.length,
    proximaRevisaoEmDias: Math.max(1, Math.round(cartao.S)),
    // Para a curva de lembrança da página do assunto: estabilidade (dias) e dia do último estudo.
    estabilidade: cartao.S,
    ultimoDia: cartao.ultimo,
    checklist,
    faltam: checklist.filter((c) => !c.ok).length,
  }
}
