// Questões do Enem pela API pública enem.dev (dados do INEP; a API diz que podem ser usados sem atribuição,
// e o PGC guarda a fonte mesmo assim: "Enem 2022, questão 141").
// Aqui só a conversão para o formato do PGC. Questão com alternativas em imagem, ou com mais de uma figura,
// fica de fora: o PGC guarda uma imagem por questão e alternativas em texto.

export const API_ENEM = 'https://api.enem.dev/v1'
export const ANOS_ENEM = Array.from({ length: 2023 - 2009 + 1 }, (_, i) => 2023 - i)
export const AREAS_ENEM = [
  { id: 'linguagens', nome: 'Linguagens' },
  { id: 'humanas', nome: 'Ciências humanas' },
  { id: 'natureza', nome: 'Ciências da natureza' },
  { id: 'matematica', nome: 'Matemática' },
]
export const LINGUAS_ENEM = [{ id: 'ingles', nome: 'Inglês' }, { id: 'espanhol', nome: 'Espanhol' }]
export const MAX_IMPORTAR_ENEM = 45

export function areaDoEnem(disciplina) {
  const d = String(disciplina ?? '').toLowerCase()
  if (d.includes('linguag')) return 'linguagens'
  if (d.includes('human')) return 'humanas'
  if (d.includes('natur')) return 'natureza'
  if (d.includes('matem')) return 'matematica'
  return 'outra'
}

const IMAGEM_MD = /!\[[^\]]*\]\(\s*(<?)(https?:\/\/[^)\s>]+)\1\s*\)/g
const imagemValida = (u) => {
  try {
    const url = new URL(u)
    return url.protocol === 'https:' && (url.hostname === 'enem.dev' || url.hostname.endsWith('.enem.dev'))
  }
  catch {
    return false
  }
}

// Texto do contexto sem as imagens em markdown, e a lista das imagens.
export function limparContexto(md) {
  const imagens = []
  const texto = String(md ?? '')
    .replace(IMAGEM_MD, (_, __, url) => {
      imagens.push(url)
      return ''
    })
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/\r\n?/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
  return { texto, imagens }
}

export const chaveEnem = (q) => `enem:${q.year}:${q.index}:${q.language ?? ''}`
export const fonteEnem = (q) => `Enem ${q.year}, questão ${q.index}${q.language ? ` (${q.language === 'ingles' ? 'inglês' : q.language})` : ''}`

// Converte uma questão da API. Devolve { ok: true, questao } ou { ok: false, motivo }.
export function questaoDoEnem(q) {
  const alternativas = Array.isArray(q?.alternatives) ? q.alternatives : []
  if (alternativas.length < 2) return { ok: false, motivo: 'sem alternativas' }
  if (alternativas.some((a) => a.file || /^\[image file\]$/i.test(String(a.text ?? '').trim()))) return { ok: false, motivo: 'alternativas em imagem' }
  const { texto, imagens } = limparContexto(q.context)
  const todas = [...new Set([...imagens, ...(Array.isArray(q.files) ? q.files : [])])]
  if (todas.length > 1) return { ok: false, motivo: 'mais de uma figura' }
  if (todas.length === 1 && !imagemValida(todas[0])) return { ok: false, motivo: 'figura fora do enem.dev' }
  const introducao = String(q.alternativesIntroduction ?? '').trim()
  const enunciado = [texto, introducao].filter(Boolean).join('\n\n').slice(0, 5000)
  if (!enunciado) return { ok: false, motivo: 'sem enunciado' }
  const letraCerta = String(q.correctAlternative ?? '').trim().toUpperCase()
  const itens = alternativas.slice(0, 6).map((a) => ({
    texto: String(a.text ?? '').replace(/\s+/g, ' ').trim().slice(0, 600),
    correta: a.isCorrect === true || (!!letraCerta && String(a.letter ?? '').toUpperCase() === letraCerta),
  }))
  if (itens.filter((a) => a.correta).length !== 1) return { ok: false, motivo: 'gabarito ausente' }
  return {
    ok: true,
    questao: {
      tipo: 'multipla_escolha',
      enunciado,
      conteudo: { alternativas: itens },
      fonte: fonteEnem(q),
      numero: Number(q.index) || null,
      chave: chaveEnem(q),
      imagem: todas[0] ?? null,
      area: areaDoEnem(q.discipline),
    },
  }
}

// Resumo para a lista de escolha (sem mandar o texto inteiro para o navegador).
export function resumoEnem(q) {
  const r = questaoDoEnem(q)
  const { texto } = limparContexto(q?.context)
  return {
    chave: chaveEnem(q),
    numero: q?.index,
    area: areaDoEnem(q?.discipline),
    lingua: q?.language ?? null,
    trecho: (texto || String(q?.alternativesIntroduction ?? '')).replace(/\s+/g, ' ').slice(0, 220),
    figura: r.ok && !!r.questao.imagem,
    motivo: r.ok ? null : r.motivo,
  }
}
