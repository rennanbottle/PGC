// Pedido para outra IA (ChatGPT, Gemini, Claude, Grok...) escrever um texto de estudo para a Biblioteca.
// O pedido é organizado em partes; a resposta é texto livre. Ao salvar, o PGC arruma as fórmulas em LaTeX e a
// marcação de Markdown que as IAs costumam usar (ver textoColado.js).

const EXATAS = new Set(['matematica', 'exatas', 'natureza'])

export function montarPedidoTexto({ tema = '', materia = '', area = '', assunto = '' } = {}) {
  const sobre = String(tema).replace(/\s+/g, ' ').trim() || assunto || materia || 'o assunto'
  const exatas = EXATAS.has(area)
  const programacao = area === 'programacao'
  const daMateria = materia && materia.toLowerCase() !== sobre.toLowerCase() ? `, da matéria ${materia}` : ''
  return [
    'PEDIDO DE TEXTO DE ESTUDO PARA O PGC',
    '',
    `Escreva um texto de estudo completo sobre "${sobre}"${daMateria}, para um estudante do ensino médio que vai usar o texto para revisar e responder questões.`,
    '',
    'O QUE O TEXTO PRECISA TER',
    '- Uma abertura curta: o que é e para que serve.',
    '- Os conceitos principais, cada um com uma definição clara e um exemplo.',
    exatas
      ? '- As fórmulas e regras importantes, cada uma explicada em palavras: o que cada letra significa e quando usar.'
      : programacao
        ? '- Trechos de código curtos e comentados, um para cada ideia.'
        : '- Datas, nomes, termos e regras importantes, cada um explicado no seu contexto.',
    '- Técnicas e jeitos de resolver, passo a passo, com as variações mais cobradas no ENEM e nos vestibulares.',
    '- Exemplos resolvidos, do mais simples ao mais difícil.',
    '- Os erros mais comuns de estudante e como evitar cada um.',
    '- Um resumo final em tópicos.',
    '',
    'COMO ESCREVER',
    '- Português do Brasil, com frases curtas e diretas.',
    '- Só informação correta e atual, como nos livros didáticos e nas provas recentes. Na dúvida, deixe de fora.',
    '- Um título curto para cada parte.',
    ...(exatas ? ['- Fórmulas em texto simples, que dê para ler sem programa especial: x², √x, Δ = b² − 4ac, xᵥ = −b/(2a). Não use LaTeX nem $.'] : []),
    ...(programacao ? ['- Código entre três crases (```), com o nome da linguagem, e a explicação logo depois de cada trecho.'] : []),
    '- Sem tabelas, sem imagens e sem emojis.',
    '- Entre 900 e 1.500 palavras.',
    '',
    'Responda só com o texto, sem comentários antes ou depois.',
  ].join('\n')
}
