<script setup>
// Código com cara de editor (questões de programação): barra com o nome do arquivo e cores por tipo de palavra.
// O realce é simples e local (sem biblioteca): palavras-chave, textos, números, comentários e nomes de função.
// Uso: <BlocoCodigo :codigo="texto" linguagem="python" />
const props = defineProps({
  codigo: { type: String, required: true },
  linguagem: { type: String, default: '' },
  titulo: { type: String, default: '' },
})

const CHAVES = {
  python: 'and as assert async await break class continue def del elif else except False finally for from global if import in is lambda None nonlocal not or pass raise return True try while with yield print len range self',
  javascript: 'async await break case catch class const continue default delete do else export extends false finally for function if import in instanceof let new null return static super switch this throw true try typeof undefined var void while yield console',
  java: 'abstract boolean break byte case catch char class continue default do double else enum extends false final finally float for if implements import int interface long new null package private protected public return short static super switch this throw throws true try void while String System',
  c: 'auto break case char const continue default do double else enum extern float for goto if int long register return short signed sizeof static struct switch typedef union unsigned void volatile while include define printf scanf NULL',
  sql: 'select from where and or not insert into values update set delete create table drop alter join left right inner outer on group by order having limit as distinct count sum avg min max null primary key foreign references',
}
const ROTULOS = { python: 'Python', javascript: 'JavaScript', java: 'Java', c: 'C', sql: 'SQL' }

const linguagemFinal = computed(() => {
  if (props.linguagem && CHAVES[props.linguagem]) return props.linguagem
  const t = props.codigo
  if (/\bdef\s+\w+\(|\bprint\(|\belif\b|:\s*$/m.test(t)) return 'python'
  if (/\b(const|let|function)\b|=>|console\./.test(t)) return 'javascript'
  if (/\bpublic\s+(static\s+)?\w+|System\.out/.test(t)) return 'java'
  if (/#include|printf\(/.test(t)) return 'c'
  if (/\bselect\b[\s\S]*\bfrom\b/i.test(t)) return 'sql'
  return ''
})

const escapar = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

const html = computed(() => {
  const ling = linguagemFinal.value
  const codigo = props.codigo.replace(/\t/g, '    ')
  if (!ling) return escapar(codigo)
  const chaves = new Set(CHAVES[ling].split(' ').map((p) => (ling === 'sql' ? p.toLowerCase() : p)))
  const comentario = ling === 'python' ? '#[^\\n]*' : ling === 'sql' ? '--[^\\n]*' : '\\/\\/[^\\n]*|\\/\\*[\\s\\S]*?\\*\\/'
  const padrao = new RegExp(`(${comentario})|("""[\\s\\S]*?"""|'''[\\s\\S]*?'''|"(?:\\\\.|[^"\\\\\\n])*"|'(?:\\\\.|[^'\\\\\\n])*'|\`(?:\\\\.|[^\`\\\\])*\`)|(\\b\\d+(?:\\.\\d+)?\\b)|([A-Za-z_][\\w]*)(?=\\s*\\()|([A-Za-z_][\\w]*)`, 'g')
  let saida = ''
  let ultimo = 0
  for (const m of codigo.matchAll(padrao)) {
    saida += escapar(codigo.slice(ultimo, m.index))
    const [texto, com, str, num, fun, pal] = m
    if (com) saida += `<span class="tk-comentario">${escapar(com)}</span>`
    else if (str) saida += `<span class="tk-texto">${escapar(str)}</span>`
    else if (num) saida += `<span class="tk-numero">${num}</span>`
    else if (fun) saida += chaves.has(ling === 'sql' ? fun.toLowerCase() : fun) ? `<span class="tk-chave">${fun}</span>` : `<span class="tk-funcao">${fun}</span>`
    else if (pal && chaves.has(ling === 'sql' ? pal.toLowerCase() : pal)) saida += `<span class="tk-chave">${pal}</span>`
    else saida += escapar(texto)
    ultimo = m.index + texto.length
  }
  return saida + escapar(codigo.slice(ultimo))
})
</script>

<template>
  <div class="codigo">
    <div class="codigo-topo" aria-hidden="true">
      <span class="luz" /><span class="luz" /><span class="luz" />
      <span class="ml-2">{{ titulo || ROTULOS[linguagemFinal] || 'Código' }}</span>
    </div>
    <!-- eslint-disable-next-line vue/no-v-html -- o texto passa por escapar() antes de ganhar as cores -->
    <pre><code v-html="html" /></pre>
  </div>
</template>
