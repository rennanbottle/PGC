<script setup>
// Conferência de qualidade ao vivo. Nas questões de escolha mostra também o que passou,
// para quem escreve ver o que está sendo conferido (Haladyna, Downing e Rodriguez, 2002).
import { Check, CircleAlert, X } from '@lucide/vue'
import { TIPOS_ESCOLHA } from '#shared/regras/questoes.js'

const props = defineProps({
  resultado: { type: Object, required: true },
  tipo: { type: String, required: true },
  importada: { type: Boolean, default: false },
  // Dentro do painel do editor: sem moldura própria, separada por uma linha.
  compacto: { type: Boolean, default: false },
})
const CONFERIDOS_ESCOLHA = [
  { id: 'quantidade', texto: '4 ou 5 alternativas' },
  { id: 'gabarito', texto: 'Uma só alternativa certa' },
  { id: 'proibida', texto: 'Sem "todas" ou "nenhuma das anteriores"' },
  { id: 'repetida', texto: 'Alternativas diferentes entre si' },
  { id: 'erro_representado', texto: 'Cada errada diz o erro que representa' },
  { id: 'tamanho', texto: 'A certa não é a mais longa de longe' },
]
const itens = computed(() => {
  const problemas = props.resultado.problemas ?? []
  if (TIPOS_ESCOLHA.includes(props.tipo) && !props.importada) {
    const vistos = new Set()
    const lista = CONFERIDOS_ESCOLHA.map((c) => {
      const p = problemas.find((x) => x.id === c.id)
      if (p) vistos.add(p)
      return p ? { ...p } : { id: c.id, nivel: 'ok', texto: c.texto }
    })
    return [...lista, ...problemas.filter((p) => !vistos.has(p))]
  }
  return problemas.length ? problemas : [{ id: 'ok', nivel: 'ok', texto: 'Nada a corrigir.' }]
})
const resumo = computed(() => {
  const { falhas = 0, avisos = 0 } = props.resultado
  if (!falhas && !avisos) return { texto: 'Tudo certo', classe: 'text-ok' }
  const partes = []
  if (falhas) partes.push(`${falhas} ${falhas === 1 ? 'falha' : 'falhas'}`)
  if (avisos) partes.push(`${avisos} ${avisos === 1 ? 'aviso' : 'avisos'}`)
  return { texto: partes.join(' e '), classe: falhas ? 'text-erro' : 'text-aviso' }
})
</script>

<template>
  <section :class="compacto ? 'border-t border-borda pt-4' : 'rounded-[14px] border border-borda p-5'" aria-labelledby="titulo-conferencia" aria-live="polite">
    <div class="flex items-baseline justify-between gap-3">
      <h2 id="titulo-conferencia" class="m-0 text-[12.5px] font-semibold text-texto-2">{{ compacto ? 'Conferência' : 'Conferência de qualidade' }}</h2>
      <span class="text-[13px] font-semibold" :class="resumo.classe">{{ resumo.texto }}</span>
    </div>
    <ul class="m-0 mt-2 list-none p-0">
      <li v-for="(p, i) in itens" :key="`${p.id}-${i}`" class="flex items-start gap-2.5 py-1.5" :class="[compacto ? 'text-[13.5px]' : 'text-[14px]', p.nivel !== 'ok' && 'font-semibold']">
        <Check v-if="p.nivel === 'ok'" :size="16" :stroke-width="2.4" class="mt-0.5 shrink-0 text-ok" aria-hidden="true" />
        <X v-else-if="p.nivel === 'falha'" :size="16" :stroke-width="2.4" class="mt-0.5 shrink-0 text-erro" aria-hidden="true" />
        <CircleAlert v-else :size="16" :stroke-width="2.2" class="mt-0.5 shrink-0 text-aviso" aria-hidden="true" />
        <span><span class="so-leitor">{{ p.nivel === 'ok' ? 'Passou: ' : p.nivel === 'falha' ? 'Falha: ' : 'Aviso: ' }}</span>{{ p.texto }}</span>
      </li>
    </ul>
    <p class="m-0 mt-2 border-t border-borda pt-3 text-[13px] leading-snug text-texto-2">
      {{ importada ? 'Questão importada: só a estrutura é conferida.' : 'Uma falha ou dois avisos deixam a questão salva, mas fora dos estudos.' }}
    </p>
  </section>
</template>
