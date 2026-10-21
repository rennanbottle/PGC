// Materiais: o que pode ser enviado, nomes da situação, mensagens de erro e quem pode ler o texto.
// O banco e o bucket repetem os limites (migração 0005).

export const TAMANHO_MAXIMO = 10 * 1024 * 1024
export const TEXTO_COLADO_MAXIMO = 400000

export const FORMATOS = {
  pdf: { rotulo: 'PDF', mime: 'application/pdf', extensao: 'pdf' },
  docx: { rotulo: 'DOCX', mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', extensao: 'docx' },
  txt: { rotulo: 'TXT', mime: 'text/plain', extensao: 'txt' },
}

// Situação em texto curto. "tom" escolhe a cor discreta; "selo" é o data-tipo do selo; o texto sozinho já diz tudo.
export const SITUACOES = {
  enviando: { texto: 'Enviando', tom: 'neutro', selo: '' },
  extraindo: { texto: 'Lendo o texto', tom: 'neutro', selo: '' },
  aguardando_conferencia: { texto: 'Para conferir', tom: 'forte', selo: 'aviso' },
  pronto: { texto: 'Pronto', tom: 'ok', selo: 'ok' },
  erro: { texto: 'Erro', tom: 'erro', selo: 'erro' },
}
export const lendo = (t) => ['enviando', 'extraindo'].includes(t?.status)

export const ERROS_MATERIAL = {
  pdf_escaneado: { curto: 'Escaneado', texto: 'PDF escaneado: são fotos de página, sem texto para ler. Passe por um leitor de texto (OCR), como o do Google Drive (abrir com Google Docs), e envie o resultado.' },
  pdf_protegido: { curto: 'Protegido', texto: 'O PDF tem senha. Salve uma cópia sem senha e envie de novo.' },
  pdf_invalido: { curto: 'Ilegível', texto: 'Não deu para abrir este PDF. Ele pode estar corrompido.' },
  docx_invalido: { curto: 'Ilegível', texto: 'Não deu para abrir este DOCX. Salve de novo no Word ou no Google Docs e envie.' },
  paginas_demais: { curto: 'Grande demais', texto: 'O arquivo passa de 300 páginas. Divida em partes menores.' },
  texto_grande: { curto: 'Grande demais', texto: 'O texto passa de 400 mil caracteres. Divida em partes menores.' },
  texto_vazio: { curto: 'Sem texto', texto: 'Não há texto para ler neste arquivo.' },
  arquivo_nao_encontrado: { curto: 'Sem arquivo', texto: 'O arquivo não chegou ao servidor. Envie de novo.' },
  falha_extracao: { curto: 'Erro', texto: 'Algo deu errado ao ler o arquivo. Tente de novo em instantes.' },
}
export const mensagemErroMaterial = (codigo) => ERROS_MATERIAL[codigo] ?? ERROS_MATERIAL.falha_extracao

export const OPCOES_IA = [
  { id: 'nenhuma', nome: 'Nenhum serviço externo', descricao: 'As questões saem só do próprio material, sem IA.' },
  { id: 'sem_treino', nome: 'Só serviços que não treinam com os dados', descricao: 'Groq e Cloudflare. Recomendado.' },
  { id: 'todas', nome: 'Todos, inclusive os que treinam', descricao: 'Gemini grátis e OpenRouter usam o texto para treinar modelos.' },
]

// Confere o arquivo antes de enviar. Devolve { formato } ou { erro } com a mensagem pronta.
export function conferirArquivo(arquivo) {
  const nome = String(arquivo?.name ?? '')
  const extensao = nome.includes('.') ? nome.split('.').pop().toLowerCase() : ''
  const formato = Object.keys(FORMATOS).find((f) => FORMATOS[f].extensao === extensao)
  if (!formato) return { erro: `${nome || 'Este arquivo'}: só PDF, DOCX ou TXT.` }
  if (extensao === 'doc') return { erro: `${nome}: o formato .doc antigo não é aceito. Salve como .docx.` }
  if (!arquivo.size) return { erro: `${nome}: o arquivo está vazio.` }
  if (arquivo.size > TAMANHO_MAXIMO) return { erro: `${nome}: passa de 10 MB.` }
  return { formato }
}

// Título a partir do nome do arquivo: "apostila_cinematica-v2.pdf" vira "apostila cinematica v2".
export function tituloDoArquivo(nome) {
  const base = String(nome ?? '').replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim()
  return (base || 'Material sem título').slice(0, 160)
}

export function formatarTamanho(bytes) {
  if (!bytes) return ''
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1).replace('.', ',')} MB`
}

// ---------- Caixa única de adicionar ----------
// O que a pessoa escreveu na caixa: tema curto (busca em fontes abertas) ou texto colado (vira um texto).
export function tipoDeEntrada(texto) {
  const t = String(texto ?? '').trim()
  if (!t) return 'vazio'
  if (t.length < 80) return 'tema'
  if (t.length > 120 || /\n/.test(t)) return 'texto'
  return 'tema'
}

export const LIMITE_TITULO = 160
export function validarTitulo(titulo) {
  const t = String(titulo ?? '').trim()
  if (!t) return 'Dê um nome ao texto, como "Resumo da aula de terça".'
  if ([...t].length > LIMITE_TITULO) return `Use no máximo ${LIMITE_TITULO} caracteres.`
  return ''
}

// De onde veio o texto (ícone e nome na lista).
export function origemDoTexto(t) {
  const host = String(t?.fonte_url ?? '').match(/^https?:\/\/([^/]+)/)?.[1] ?? ''
  if (host.endsWith('wikibooks.org')) return 'wikilivros'
  if (host.endsWith('wikiversity.org')) return 'wikiversidade'
  if (host.endsWith('wikipedia.org')) return 'wikipedia'
  if (t?.origem === 'texto_colado') return 'colado'
  return 'arquivo'
}

// Textos agrupados por matéria (as pastas da Biblioteca), na ordem das matérias; dentro, o mais recente primeiro.
export function agruparPorMateria(textos, materias = []) {
  const grupos = new Map()
  for (const m of materias) grupos.set(m.id, { materia: m, textos: [] })
  for (const t of textos ?? []) {
    if (!grupos.has(t.materia_id)) grupos.set(t.materia_id, { materia: null, textos: [] })
    grupos.get(t.materia_id).textos.push(t)
  }
  const recente = (a, b) => new Date(b.atualizado_em ?? b.criado_em) - new Date(a.atualizado_em ?? a.criado_em)
  return [...grupos.values()]
    .filter((g) => g.textos.length)
    .map((g) => ({ ...g, textos: [...g.textos].sort(recente) }))
    .sort((a, b) => (a.materia?.ordem ?? 1e9) - (b.materia?.ordem ?? 1e9))
}
