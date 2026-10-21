// Conferência de questões de escolha antes de guardar, sem IA.
// Base: diretrizes de elaboração de itens de Haladyna, Downing e Rodriguez (2002).
// Falha reprova a questão; dois avisos também reprovam.

const PROIBIDAS = /\b(todas as (anteriores|alternativas|acima)|nenhuma das (anteriores|alternativas|acima))\b/i
const RESSALVAS = /\b(em geral|geralmente|na maioria|normalmente|em alguns casos|frequentemente|tende a|tendem a|costuma|costumam|pode ser|podem ser)\b/i
const ABSOLUTOS = /\b(sempre|nunca|jamais|todos|todas|nenhum|nenhuma|somente|apenas|exclusivamente|unicamente)\b/i
const PARADAS = new Set('a o as os um uma uns umas de da do das dos em na no nas nos por para com sem que qual quais como mais menos entre sobre sob seu sua seus suas este esta esse essa isso isto aquele aquela ser são foi era é e ou se ao aos à às pelo pela pelos pelas não sim mas quando onde'.split(' '))

export function normalizar(t) {
  return String(t ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s+\-.,%/]/g, ' ') // mantém sinais e separadores: "-300" é diferente de "300"
    .replace(/(^|\s)[.,](?=\s|$)/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}
const palavras = (t) => normalizar(t).split(' ').filter((p) => p.length >= 4 && !PARADAS.has(p))
// Igualdade para achar repetidas: sem diferenciar maiúsculas e espaços, mas COM acentos ("à", "a" e "há" são
// respostas diferentes numa questão de crase).
export const textoComparavel = (t) => String(t ?? '').toLocaleLowerCase('pt-BR').replace(/\s+/g, ' ').trim()
const quaseIguais = (a, b) => normalizar(a).split(' ').length >= 3 && normalizar(b).split(' ').length >= 3 && jaccard(a, b) >= 0.9
function jaccard(a, b) {
  const A = new Set(normalizar(a).split(' '))
  const B = new Set(normalizar(b).split(' '))
  const inter = [...A].filter((x) => B.has(x)).length
  return inter / (A.size + B.size - inter || 1)
}
const detalhes = (t) => (String(t).match(/[,;0-9]/g) ?? []).length

export function conferirQuestaoEscolha(q) {
  const problemas = []
  const falha = (id, texto) => problemas.push({ id, nivel: 'falha', texto })
  const aviso = (id, texto) => problemas.push({ id, nivel: 'aviso', texto })
  const alts = q.alternativas ?? []
  const certas = alts.filter((a) => a.correta)
  const erradas = alts.filter((a) => !a.correta)

  if (alts.length < 4 || alts.length > 5) falha('quantidade', 'A questão precisa de 4 ou 5 alternativas.')
  if (certas.length !== 1) falha('gabarito', 'A questão precisa de exatamente uma alternativa certa.')
  if (alts.some((a) => PROIBIDAS.test(a.texto))) falha('proibida', 'Não use "todas" ou "nenhuma das anteriores".')
  for (let i = 0; i < alts.length; i++) {
    for (let j = i + 1; j < alts.length; j++) {
      if (textoComparavel(alts[i].texto) === textoComparavel(alts[j].texto) || quaseIguais(alts[i].texto, alts[j].texto)) {
        falha('repetida', 'Há alternativas iguais ou quase iguais.')
        i = alts.length
        break
      }
    }
  }
  if (erradas.some((a) => !String(a.erro ?? '').trim())) falha('erro_representado', 'Toda alternativa errada precisa dizer que erro de raciocínio ela representa.')
  if (certas.length !== 1 || erradas.length === 0) return resumo(problemas)

  const certa = certas[0]
  const tam = (a) => String(a.texto).trim().length
  const mediaErradas = erradas.reduce((s, a) => s + tam(a), 0) / erradas.length
  const maiorErrada = Math.max(...erradas.map(tam))
  if (tam(certa) > maiorErrada && tam(certa) > 1.2 * mediaErradas) falha('tamanho', 'A alternativa certa é a mais longa e bem maior que as outras.')

  if (RESSALVAS.test(certa.texto) && !erradas.some((a) => RESSALVAS.test(a.texto))) aviso('ressalva', 'Só a alternativa certa tem ressalva ("em geral", "pode ser").')
  if (!ABSOLUTOS.test(certa.texto) && erradas.filter((a) => ABSOLUTOS.test(a.texto)).length >= 2) aviso('absolutos', 'Palavras absolutas ("sempre", "nunca") aparecem só nas erradas.')
  if (detalhes(certa.texto) >= Math.max(...erradas.map((a) => detalhes(a.texto))) + 2) aviso('detalhe', 'A alternativa certa tem bem mais números e vírgulas que as outras.')
  const enun = new Set(palavras(q.enunciado))
  const eco = (a) => palavras(a.texto).filter((p) => enun.has(p)).length
  if (eco(certa) - Math.max(...erradas.map(eco)) >= 2) aviso('eco', 'A alternativa certa repete palavras do enunciado que as erradas não repetem.')

  return resumo(problemas)
}

function resumo(problemas) {
  const falhas = problemas.filter((p) => p.nivel === 'falha').length
  const avisos = problemas.filter((p) => p.nivel === 'aviso').length
  return { aprovada: falhas === 0 && avisos < 2, problemas }
}

// Na sessão, a certa só pode ser a mais longa em até 1 de cada 4 questões.
export function conferirSessao(questoes) {
  const maisLonga = questoes.filter((q) => {
    const certa = q.alternativas.find((a) => a.correta)
    if (!certa) return false
    return q.alternativas.every((a) => a === certa || String(a.texto).length < String(certa.texto).length)
  }).length
  return { maisLonga, limite: Math.floor(questoes.length / 4), aprovada: maisLonga <= Math.floor(questoes.length / 4) }
}

// Embaralha as alternativas e distribui a posição da certa por igual na sessão.
// A posição enviada pelo modelo é ignorada. `rng` permite teste determinístico.
export function balancearPosicoes(questoes, rng = Math.random) {
  const embaralhar = (arr) => {
    const a = [...arr]
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1))
      ;[a[i], a[j]] = [a[j], a[i]]
    }
    return a
  }
  const n = Math.min(...questoes.map((q) => q.alternativas.length))
  const alvo = embaralhar(questoes.map((_, i) => i % n))
  return questoes.map((q, i) => {
    const certa = q.alternativas.find((a) => a.correta)
    const outras = embaralhar(q.alternativas.filter((a) => a !== certa))
    const pos = Math.min(alvo[i], q.alternativas.length - 1)
    return { ...q, alternativas: [...outras.slice(0, pos), certa, ...outras.slice(pos)] }
  })
}
