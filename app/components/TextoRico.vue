<script setup>
// Texto de questão, alternativa, explicação, dica ou comentário, com código e matemática.
// ```python ... ``` vira <BlocoCodigo>; `trecho` vira código na linha; contas (com cifrões ou reconhecidas sozinhas,
// como "xv=-b/(2a)") são desenhadas pelo KaTeX: fração em pé, índice embaixo, raiz de verdade. O resto mantém as
// quebras de linha. Texto da pessoa nunca vira HTML: só o desenho do KaTeX entra como HTML, e ele não aceita comando
// que crie link ou estilo (trust desligado). Uso: <TextoRico :texto="questao.enunciado" />
// "linguagem" é a linguagem padrão para blocos sem nome (ex.: a matéria Python).
// ```grafico com "f(x) = x^2 - 6x + 5" (uma função por linha, até duas) vira o desenho da função (<GraficoFuncao>).
import katex from 'katex'
import { dividirTexto } from '#shared/regras/textoRico.js'
import { dividirMatematica } from '#shared/regras/matematica.js'

const props = defineProps({
  texto: { type: String, default: '' },
  tag: { type: String, default: 'div' },
  linguagem: { type: String, default: '' },
})

// Desenho de cada conta, guardado: a mesma fórmula aparece em muitas telas.
const desenhos = new Map()
function desenhar(tex, bloco) {
  const chave = `${bloco ? 'B' : 'L'}${tex}`
  if (desenhos.has(chave)) return desenhos.get(chave)
  let html = null
  try {
    html = katex.renderToString(tex, { displayMode: bloco, throwOnError: true, strict: 'ignore', trust: false, output: 'htmlAndMathml' })
  }
  catch {
    html = null // conta que o KaTeX não entende aparece como foi escrita
  }
  if (desenhos.size > 400) desenhos.clear()
  desenhos.set(chave, html)
  return html
}
// Cada pedaço de texto comum vira texto e contas.
function comContas(texto) {
  return dividirMatematica(texto).map((p) => {
    if (p.tipo !== 'mat') return p
    const html = desenhar(p.tex, !!p.bloco)
    return html ? { ...p, html } : { tipo: 'texto', texto: p.bloco ? `\n${p.original}\n` : p.original }
  })
}

// Texto e código na linha ficam juntos num parágrafo; cada bloco de código fica sozinho.
const grupos = computed(() => {
  const saida = []
  for (const p of dividirTexto(props.texto)) {
    if (p.tipo === 'bloco') {
      saida.push(p)
      continue
    }
    const partes = p.tipo === 'texto' ? comContas(p.texto) : [p]
    if (saida.at(-1)?.tipo === 'paragrafo') saida.at(-1).partes.push(...partes)
    else saida.push({ tipo: 'paragrafo', partes })
  }
  return saida
})
const temBloco = computed(() => grupos.value.some((g) => g.tipo === 'bloco'))
</script>

<template>
  <component :is="tag" class="texto-rico" :class="temBloco ? 'flex flex-col gap-3' : 'whitespace-pre-line'">
    <template v-for="(g, i) in grupos" :key="i">
      <GraficoFuncao v-if="g.tipo === 'bloco' && g.linguagem === 'grafico'" :texto="g.texto" class="max-w-[560px]" />
      <BlocoCodigo v-else-if="g.tipo === 'bloco'" :codigo="g.texto" :linguagem="g.linguagem || linguagem" />
      <span v-else-if="temBloco" class="block whitespace-pre-line">
        <template v-for="(p, j) in g.partes" :key="j">
          <code v-if="p.tipo === 'codigo'" class="codigo-linha font-mono">{{ p.texto }}</code>
          <span v-else-if="p.tipo === 'mat'" class="conta" :class="p.bloco && 'conta-bloco'" v-html="p.html" />
          <template v-else>{{ p.texto }}</template>
        </template>
      </span>
      <template v-for="(p, j) in g.partes" v-else :key="j">
        <code v-if="p.tipo === 'codigo'" class="codigo-linha font-mono">{{ p.texto }}</code>
        <span v-else-if="p.tipo === 'mat'" class="conta" :class="p.bloco && 'conta-bloco'" v-html="p.html" />
        <template v-else>{{ p.texto }}</template>
      </template>
    </template>
  </component>
</template>

<style scoped>
.codigo-linha {
  border-radius: 6px;
  background: var(--folha-3);
  padding: 1px 5px;
  font-size: 0.9em;
  color: var(--tinta);
}
</style>
