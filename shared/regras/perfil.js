// Regras do perfil que aparecem no cadastro e, mais tarde, na tela de perfil.
// O banco repete as conferências do apelido (migração 0003): a tela avisa, o banco garante.

export const APELIDO_MIN = 2
export const APELIDO_MAX = 24

export function avaliarApelido(valor = '') {
  const a = String(valor).trim()
  if (a === '') return { valido: true, vazio: true, mensagem: '' }
  const tamanho = [...a].length
  if (tamanho < APELIDO_MIN) return { valido: false, vazio: false, mensagem: `O apelido precisa ter pelo menos ${APELIDO_MIN} caracteres.` }
  if (tamanho > APELIDO_MAX) return { valido: false, vazio: false, mensagem: `O apelido pode ter no máximo ${APELIDO_MAX} caracteres.` }
  if (!/^[\p{L}\p{N}_.-]+$/u.test(a)) {
    return { valido: false, vazio: false, mensagem: 'Use só letras, números, ponto, hífen e sublinhado, sem espaços.' }
  }
  return { valido: true, vazio: false, mensagem: '' }
}

// Letra que aparece no lugar da foto.
export function inicialDoNome(nome = '') {
  const primeira = [...String(nome).trim()][0]
  return primeira ? primeira.toLocaleUpperCase('pt-BR') : ''
}

// Opções usadas no cadastro e no perfil. Os mesmos valores são conferidos no banco.
export const OBJETIVOS = [
  { id: 'enem', nome: 'ENEM' },
  { id: 'vestibular', nome: 'Vestibular' },
  { id: 'concurso', nome: 'Concurso' },
  { id: 'faculdade', nome: 'Faculdade' },
  { id: 'curso_tecnico', nome: 'Curso técnico' },
  { id: 'por_conta_propria', nome: 'Por conta própria' },
]

export const AREAS = [
  { id: 'matematica', nome: 'Matemática' },
  { id: 'natureza', nome: 'Ciências da natureza' },
  { id: 'humanas', nome: 'Ciências humanas' },
  { id: 'portugues', nome: 'Português e literatura' },
  { id: 'idiomas', nome: 'Idiomas' },
  { id: 'programacao', nome: 'Programação e tecnologia' },
  { id: 'exatas', nome: 'Engenharia e indústria' },
  { id: 'saude', nome: 'Saúde' },
  { id: 'direito', nome: 'Direito' },
  { id: 'negocios', nome: 'Negócios e gestão' },
  { id: 'artes', nome: 'Artes e design' },
]

// Quantas áreas cabem no perfil (o banco confere o mesmo número).
export const MAX_AREAS = 11

// Saída automática por inatividade (perfil, parte Sessão). null = nunca.
export const SAIDA_INATIVO = [
  { valor: null, texto: 'Nunca', descricao: 'Só no seu computador ou celular.' },
  { valor: 15, texto: 'Depois de 15 minutos parado' },
  { valor: 30, texto: 'Depois de 30 minutos parado', descricao: 'Padrão. Bom para computadores da escola.' },
  { valor: 60, texto: 'Depois de 1 hora parado' },
  { valor: 120, texto: 'Depois de 2 horas parado' },
  { valor: 240, texto: 'Depois de 4 horas parado' },
]

// Quem pode ler o texto dos materiais novos (o mesmo campo ia_permitida de cada material).
export const IA_PERMITIDA = [
  { valor: 'sem_treino', texto: 'Só serviços que não treinam com os dados', descricao: 'Groq e Cloudflare. Recomendado.' },
  { valor: 'nenhuma', texto: 'Nenhum serviço externo', descricao: 'As questões saem só do próprio texto, sem IA.' },
  { valor: 'todas', texto: 'Todos, inclusive os que treinam', descricao: 'Gemini grátis e OpenRouter usam o texto para treinar modelos.' },
]

export const RESUMOS_RITMO = {
  tranquilo: 'Sem pressa, com domínio mais brando.',
  normal: 'O equilíbrio recomendado.',
  focado: 'Para quem tem prova marcada.',
  obcecado: 'Sem folga e sem dica fácil.',
}

// Cor do PGC (perfil, Aparência). Muda só a cor das ações; matérias, pontos e avisos mantêm as cores deles.
// O banco guarda em perfis.paleta ("padrao" antigo vale como azul).
// Cores de cada paleta para a prévia do Perfil (as mesmas de main.css): claro e escuro, com o fundo (mesa), a folha,
// a cor das ações, a suave, a segunda cor das mesclas e as 4 da logo.
export const PALETAS = [
  { id: 'azul', nome: 'Azul', cor: '#2f5bff', descricao: 'Padrão',
    claro: { mesa: '#f3f5fa', folha: '#ffffff', borda: '#e2e6ef', acento: '#2f5bff', suave: '#eaf0ff', segunda: '#0bb3c0', logo: ['#0336b4', '#0184f2', '#0bbfc4', '#5be976'] },
    escuro: { mesa: '#0a0e1a', folha: '#111726', borda: '#212a3f', acento: '#7d9bff', suave: '#18224a', segunda: '#3fd6d0', logo: ['#2a55e0', '#1a90ff', '#22cfd0', '#6ef08a'] } },
  { id: 'turquesa', nome: 'Turquesa', cor: '#0b766e',
    claro: { mesa: '#f0f7f6', folha: '#ffffff', borda: '#dde9e7', acento: '#0b766e', suave: '#e2f5f2', segunda: '#6cbf3c', logo: ['#064f4a', '#0b8f84', '#33c7a8', '#b5e86a'] },
    escuro: { mesa: '#011210', folha: '#041c1a', borda: '#0e312e', acento: '#3ccbbd', suave: '#10302e', segunda: '#a6e36b', logo: ['#13786f', '#1fb0a2', '#4fd8b8', '#c2f07e'] } },
  { id: 'violeta', nome: 'Violeta', cor: '#6a3fd9',
    claro: { mesa: '#f5f4fa', folha: '#ffffff', borda: '#e5e5ee', acento: '#6a3fd9', suave: '#efeaff', segunda: '#d0549e', logo: ['#2b1585', '#6a3fd9', '#ad6cf0', '#f39bd2'] },
    escuro: { mesa: '#0e0d19', folha: '#171525', borda: '#2a273e', acento: '#a68bfa', suave: '#251d40', segunda: '#f29ad7', logo: ['#5236d0', '#8a63ee', '#c28af6', '#f7b3de'] } },
  { id: 'magenta', nome: 'Magenta', cor: '#b8236f',
    claro: { mesa: '#f9f3f5', folha: '#ffffff', borda: '#eee3e6', acento: '#b8236f', suave: '#fde8f1', segunda: '#ec7a3a', logo: ['#5f0f3d', '#b8236f', '#ef5a8a', '#ffb067'] },
    escuro: { mesa: '#180a0f', folha: '#231118', borda: '#3b222b', acento: '#f17ab6', suave: '#3a1729', segunda: '#ffab70', logo: ['#9a1f63', '#d63a86', '#f77aa0', '#ffc187'] } },
  { id: 'grafite', nome: 'Grafite', cor: '#2c3448',
    claro: { mesa: '#f5f5f6', folha: '#ffffff', borda: '#e5e6e7', acento: '#2c3448', suave: '#e8ebf2', segunda: '#7d89a6', logo: ['#1b2232', '#3c4762', '#7d89a6', '#c6cee0'] },
    escuro: { mesa: '#0e0f10', folha: '#171819', borda: '#292b2d', acento: '#c5cde0', suave: '#232a3a', segunda: '#8d99b6', logo: ['#4a5674', '#6b7896', '#a1adca', '#dbe1ee'] } },
]
export const paletaDoPerfil = (paleta) => (PALETAS.some((p) => p.id === paleta) ? paleta : 'azul')
