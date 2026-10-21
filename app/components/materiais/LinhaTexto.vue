<script setup>
// Um texto na lista da Biblioteca: de onde veio (ícone), nome, tamanho, quando mudou, questões feitas dele e a
// situação. "Para conferir" ganha o botão Conferir; "Lendo o texto" mostra a barrinha andando.
import { BookOpen, CircleAlert, ClipboardType, FileText, Globe, GraduationCap } from '@lucide/vue'
import { SITUACOES, formatarTamanho, lendo, mensagemErroMaterial, origemDoTexto } from '#shared/regras/materiais.js'
import { tempoRelativo } from '#shared/regras/tempo.js'

const props = defineProps({
  texto: { type: Object, required: true },
  questoes: { type: Number, default: 0 },
  acoes: { type: Array, required: true },
})
defineEmits(['acao', 'conferir'])

const ICONE = { wikilivros: BookOpen, wikiversidade: GraduationCap, wikipedia: Globe, colado: ClipboardType, arquivo: FileText }
const NOME_ORIGEM = { wikilivros: 'Wikilivros', wikiversidade: 'Wikiversidade', wikipedia: 'Wikipédia', colado: 'Texto colado', arquivo: '' }
const origem = computed(() => origemDoTexto(props.texto))
const situacao = computed(() => SITUACOES[props.texto.status] ?? SITUACOES.erro)
const plural = (n, um, varios) => `${n} ${n === 1 ? um : varios}`
const detalhes = computed(() => {
  const t = props.texto
  const unidade = t.formato === 'pdf' && t.origem === 'arquivo' ? ['página', 'páginas'] : ['parte', 'partes']
  return [
    NOME_ORIGEM[origem.value] || (t.formato ? t.formato.toUpperCase() : ''),
    t.paginas ? plural(t.paginas, unidade[0], unidade[1]) : '',
    origem.value === 'arquivo' ? formatarTamanho(t.tamanho_bytes) : '',
    `mudou ${tempoRelativo(t.atualizado_em ?? t.criado_em)}`,
  ].filter(Boolean)
})
</script>

<template>
  <article class="linha-texto" :aria-labelledby="`texto-${texto.id}`">
    <component :is="ICONE[origem]" :size="19" :stroke-width="1.9" aria-hidden="true" class="icone text-texto-3" />
    <div class="nome min-w-0">
      <h3 :id="`texto-${texto.id}`" class="m-0 line-clamp-2 text-[15.5px] font-semibold leading-snug md:line-clamp-1">
        <NuxtLink :to="`/materiais/${texto.id}`" class="link-texto">{{ texto.titulo }}</NuxtLink>
      </h3>
      <p class="m-0 mt-0.5 flex flex-wrap gap-x-3 text-[13px] text-texto-3">
        <span v-for="d in detalhes" :key="d">{{ d }}</span>
      </p>
      <div v-if="lendo(texto)" class="barra fina barra-lendo mt-2 max-w-[260px]"><i style="width: 35%" /></div>
      <p v-else-if="texto.status === 'erro'" class="m-0 mt-1 flex items-center gap-1.5 text-[13px] font-semibold text-erro">
        <CircleAlert :size="14" :stroke-width="2.2" aria-hidden="true" />{{ mensagemErroMaterial(texto.erro_codigo).curto }}
      </p>
    </div>
    <span class="questoes text-[13.5px]" :class="questoes ? 'text-texto-2' : 'text-texto-3'">
      {{ questoes ? plural(questoes, 'questão', 'questões') : 'Sem questões' }}
    </span>
    <div class="situacao flex items-center gap-2">
      <button v-if="texto.status === 'aguardando_conferencia'" type="button" class="conferir" @click="$emit('conferir')">
        <span class="ponto" aria-hidden="true" />Conferir
      </button>
      <span v-else class="selo" :data-tipo="situacao.selo || undefined">
        <span v-if="lendo(texto)" class="rodando" aria-hidden="true" />{{ situacao.texto }}
      </span>
    </div>
    <div class="menu relative z-[2]">
      <MenuAcoes :rotulo="`Ações de ${texto.titulo}`" :itens="acoes" @escolher="$emit('acao', $event)" />
    </div>
  </article>
</template>

<style scoped>
.linha-texto {
  position: relative;
  display: grid;
  grid-template-columns: 22px minmax(0, 1fr) auto;
  grid-template-areas: 'icone nome menu' 'icone questoes situacao';
  align-items: center;
  gap: 4px 12px;
  padding: 12px 14px 12px 16px;
  transition: background-color 0.18s;
}
.icone { grid-area: icone; align-self: start; margin-top: 2px; }
.nome { grid-area: nome; }
.questoes { grid-area: questoes; }
.situacao { grid-area: situacao; justify-self: end; }
.menu { grid-area: menu; justify-self: end; }
@media (min-width: 768px) {
  .linha-texto {
    grid-template-columns: 22px minmax(0, 1fr) 110px 132px 40px;
    grid-template-areas: 'icone nome questoes situacao menu';
    gap: 0 14px;
  }
  .icone { align-self: center; margin-top: 0; }
  .situacao { justify-self: start; }
}
.linha-texto:hover {
  background: var(--folha-2);
}
.link-texto {
  color: inherit;
  text-decoration: none;
}
.link-texto::after {
  content: '';
  position: absolute;
  inset: 0;
  z-index: 1;
}
.link-texto:focus-visible {
  outline: none;
}
.link-texto:focus-visible::after {
  outline: 2px solid var(--acento);
  outline-offset: -2px;
}
.linha-texto:hover .link-texto {
  color: var(--acento);
}
.conferir {
  position: relative;
  z-index: 2;
  display: inline-flex;
  align-items: center;
  gap: 7px;
  height: 30px;
  padding: 0 11px;
  border: 1px solid color-mix(in oklab, var(--aviso) 45%, var(--borda));
  border-radius: 9px;
  background: var(--aviso-suave);
  color: var(--aviso);
  font: inherit;
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
  transition: transform 0.2s var(--ease-mola), border-color 0.18s;
}
.conferir:hover {
  border-color: var(--aviso);
  transform: translateY(-1px);
}
.conferir .ponto {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: currentColor;
}
.barra-lendo > i {
  animation: vai-e-volta 1.4s ease-in-out infinite;
}
@keyframes vai-e-volta {
  0% { transform: translateX(-100%); }
  100% { transform: translateX(300%); }
}
@media (prefers-reduced-motion: reduce) {
  .barra-lendo > i, .conferir { animation: none; transition: none; }
}
:global(:root.menos-movimento) .barra-lendo > i {
  animation: none;
}
</style>
