// Ritmo de estudo: como o PGC trata a pessoa. Escolhido no cadastro e alterável no perfil (uma vez a cada 7 dias).
// Muda metas, tom das mensagens, nível padrão e o rigor para declarar domínio. Não muda a fórmula de pontos.

export const RITMOS = {
  tranquilo: {
    nome: 'Tranquilo',
    descricao: 'Estudo sem pressa. Metas pequenas, mensagens de incentivo e critério de domínio mais brando.',
    metaDiariaQuestoes: 10,
    nivelPadrao: 2,
    tom: 'incentivo',
    bonusDominado: 60,
    proficiente: { proficiencia: 560, respostas: 12, dias: 2, aplicarMais: 2, dificeis: 2 },
    dominado: {
      proficiencia: 625, respostas: 20, dias: 3, periodoDias: 7, dificeis: 6, muitoDificeisCertas: 1,
      niveisBloom: 3, analisarMais: 1, tiposDiferentes: 3, retencao: 0.85, acertoUltimas: 0.75, recenteDias: 30,
      provaDominio: null,
    },
  },
  normal: {
    nome: 'Normal',
    descricao: 'O equilíbrio recomendado. Cobra constância e questões difíceis, sem exagero.',
    metaDiariaQuestoes: 20,
    nivelPadrao: 2,
    tom: 'direto',
    bonusDominado: 80,
    proficiente: { proficiencia: 575, respostas: 15, dias: 3, aplicarMais: 3, dificeis: 3 },
    dominado: {
      proficiencia: 650, respostas: 25, dias: 4, periodoDias: 14, dificeis: 8, muitoDificeisCertas: 2,
      niveisBloom: 4, analisarMais: 2, tiposDiferentes: 4, retencao: 0.9, acertoUltimas: 0.8, recenteDias: 21,
      provaDominio: { questoes: 10, minimoCertas: 8, nivelMinimo: 3 },
    },
  },
  focado: {
    nome: 'Focado',
    descricao: 'Para quem tem prova marcada. Metas maiores, questões mais duras e prova de domínio mais longa.',
    metaDiariaQuestoes: 35,
    nivelPadrao: 3,
    tom: 'direto',
    bonusDominado: 110,
    proficiente: { proficiencia: 600, respostas: 20, dias: 3, aplicarMais: 4, dificeis: 5 },
    dominado: {
      proficiencia: 675, respostas: 35, dias: 5, periodoDias: 21, dificeis: 12, muitoDificeisCertas: 3,
      niveisBloom: 4, analisarMais: 3, tiposDiferentes: 5, retencao: 0.9, acertoUltimas: 0.85, recenteDias: 14,
      provaDominio: { questoes: 12, minimoCertas: 10, nivelMinimo: 3 },
    },
  },
  obcecado: {
    nome: 'Obcecado',
    descricao: 'Sem folga. Metas altas, cobrança direta, nada de dica fácil e domínio só com prova muito difícil.',
    metaDiariaQuestoes: 60,
    nivelPadrao: 4,
    tom: 'cobranca',
    bonusDominado: 150,
    proficiente: { proficiencia: 625, respostas: 25, dias: 4, aplicarMais: 6, dificeis: 8 },
    dominado: {
      proficiencia: 700, respostas: 45, dias: 6, periodoDias: 28, dificeis: 16, muitoDificeisCertas: 5,
      niveisBloom: 5, analisarMais: 4, tiposDiferentes: 6, retencao: 0.95, acertoUltimas: 0.9, recenteDias: 10,
      provaDominio: { questoes: 15, minimoCertas: 13, nivelMinimo: 4 },
    },
  },
}

export const RITMO_PADRAO = 'normal'
export const DIAS_ENTRE_TROCAS_DE_RITMO = 7

export function podeTrocarRitmo(ultimaTroca, agora) {
  if (!ultimaTroca) return true
  return (agora - ultimaTroca) / 86400000 >= DIAS_ENTRE_TROCAS_DE_RITMO
}
