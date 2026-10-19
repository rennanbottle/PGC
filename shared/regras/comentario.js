// Comentário da IA no fim de uma execução (matriz de 06/10: só depois da atividade inteira, em linguagem natural,
// sem título de "Conselho"). A IA não corrige nada nem calcula números: recebe os números já calculados pelo PGC,
// as questões erradas (com o erro que a alternativa representa) e trechos do material, e escreve um parágrafo.

const corta = (t, n) => {
  const s = String(t ?? '').replace(/\s+/g, ' ').trim()
  return s.length > n ? `${s.slice(0, n - 1)}…` : s
}

// dados: { titulo, acerto, mediaAnterior, blocos: [{ nome, tipo, certas, parciais, erradas, total }],
//          erros: [{ assunto, enunciado, sua, certa, erro, trecho: { texto, pagina, material } }], incertas }
export function montarPedidoComentario(dados) {
  const blocos = (dados.blocos ?? []).map((b, i) => `${i + 1}. ${b.tipo === 'pratica' ? 'Prática' : 'Revisão'}, ${b.nome}: ${b.certas} certas, ${b.parciais} parciais e ${b.erradas} erradas de ${b.total}.`).join('\n')
  const erros = (dados.erros ?? []).slice(0, 8).map((e, i) => {
    const partes = [
      `Questão ${i + 1} (${e.assunto || 'sem assunto'}): ${corta(e.enunciado, 280)}`,
      `Resposta da pessoa: ${corta(e.sua, 120) || 'em branco'}. Certa: ${corta(e.certa, 120)}.`,
    ]
    if (e.erro) partes.push(`Erro que a alternativa escolhida representa: ${corta(e.erro, 200)}`)
    if (e.trecho?.texto) partes.push(`Trecho do material${e.trecho.material ? ` "${corta(e.trecho.material, 60)}"` : ''}${e.trecho.pagina ? `, página ${e.trecho.pagina}` : ''}: "${corta(e.trecho.texto, 350)}"`)
    return partes.join('\n')
  }).join('\n\n')
  const sistema = [
    'Você comenta o resultado de uma sessão de estudo de um estudante brasileiro.',
    'Escreva em português do Brasil, falando com a pessoa por "você", num único parágrafo de 2 a 4 frases (de 50 a 120 palavras).',
    'Diga o que as respostas mostram: um padrão de erro em comum, se houver, e uma ação concreta para a próxima vez (por exemplo, reler uma página citada).',
    'Use só os números e fatos que aparecem abaixo; não invente notas, porcentagens, páginas ou datas.',
    'Não use título, saudação, lista, emoji, travessão, aspas de destaque nem frases genéricas de motivação.',
    'Não diga que é uma IA. Não repita o enunciado inteiro.',
    'Conta ou fórmula vai entre cifrões, sem barra invertida, como $x_v = -b/(2a)$ ou $Δ = b^2 - 4ac$.',
    'Responda só com JSON no formato {"comentario": "..."}.',
  ].join(' ')
  const usuario = [
    `Sessão: ${corta(dados.titulo, 120)}.`,
    `Aproveitamento: ${dados.acerto}%${dados.mediaAnterior != null ? `; a média das anteriores era ${dados.mediaAnterior}%` : ''}.`,
    dados.incertas ? `Certas marcadas como incertas: ${dados.incertas}.` : '',
    `Blocos:\n${blocos}`,
    erros ? `Questões que não saíram certas:\n${erros}` : 'Todas as questões saíram certas.',
  ].filter(Boolean).join('\n\n')
  return [{ role: 'system', content: sistema }, { role: 'user', content: usuario }]
}

// Confere e limpa o texto. Devolve { ok, valor } ou { ok: false, motivo }.
export function validarComentario(json) {
  let t = typeof json?.comentario === 'string' ? json.comentario : ''
  t = t.replace(/^\s*(conselho|comentário|comentario|análise|analise)\s*:\s*/i, '')
    .replace(/[*#_`]/g, '')
    .replace(/\s+[—–]\s+/g, ', ')
    .replace(/[—–]/g, ', ')
    .replace(/\s+/g, ' ')
    .trim()
  if (t.length < 80) return { ok: false, motivo: 'Comentário curto demais.' }
  if (t.length > 1100) return { ok: false, motivo: 'Comentário longo demais.' }
  if (/\b(como (uma )?ia|modelo de linguagem)\b/i.test(t)) return { ok: false, motivo: 'Comentário falou de si.' }
  return { ok: true, valor: t }
}
