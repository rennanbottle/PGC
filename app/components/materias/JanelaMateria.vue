<script setup>
// Janela de nova matéria (e de editar). Enquanto a pessoa digita o nome, aparecem matérias do catálogo;
// escolher uma preenche a área e a cor (dá para trocar). Criar leva direto para a página da matéria,
// onde estão os assuntos sugeridos.
// Uso: <MateriasJanelaMateria ref="janela" />, depois janela.value.abrirNova('Português') ou abrirEditar(materia).
import { Check, CircleAlert, Plus } from '@lucide/vue'
import { acharMateria, normalizar, sugerirMateria } from '#shared/regras/catalogo.js'
import { CORES, LIMITES, nomeDaArea, proximaCor, validarNome } from '#shared/regras/materias.js'

const api = useMaterias()
const { avisar } = useAvisos()
const opcoesArea = OPCOES_AREA

const janela = ref(null)
const campoNome = ref(null)
const editando = ref(null)
const nome = ref('')
const area = ref('outra')
const cor = ref('azul')
const tocou = reactive({ area: false, cor: false })
const erroNome = ref('')
const erro = ref('')
const salvando = ref(false)
const tremer = ref(false)
const focado = ref(false)
const escolheu = ref(false)
const ativa = ref(-1)

const outras = computed(() => (api.data.value ?? []).filter((m) => m.id !== editando.value?.id))
const nomesUsados = computed(() => new Set(outras.value.map((m) => normalizar(m.nome))))
const doCatalogo = computed(() => acharMateria(nome.value))
const sugestoes = computed(() => sugerirMateria(nome.value, 6)
  .filter((m) => !nomesUsados.value.has(normalizar(m.nome)) && normalizar(m.nome) !== normalizar(nome.value))
  .slice(0, 4))
const mostrarLista = computed(() => !editando.value && focado.value && !escolheu.value && sugestoes.value.length > 0)
const idOpcao = (i) => `sugestao-materia-${i}`

// Cor do catálogo quando ninguém usa; senão, a próxima livre.
function corPara(m) {
  const emUso = new Set(outras.value.filter((x) => !x.arquivada_em).map((x) => x.cor))
  return m && !emUso.has(m.cor) ? m.cor : proximaCor(outras.value)
}

watch(doCatalogo, (m) => {
  if (!m || editando.value) return
  if (!tocou.area) area.value = m.area
  if (!tocou.cor) cor.value = corPara(m)
})
watch(sugestoes, () => { ativa.value = -1 })

function escolher(m) {
  nome.value = m.nome
  area.value = m.area
  cor.value = corPara(m)
  tocou.area = false
  tocou.cor = false
  escolheu.value = true
  erroNome.value = ''
  nextTick(() => campoNome.value?.focus())
}

function digitou() {
  escolheu.value = false
  erroNome.value = ''
}

function teclado(e) {
  if (!mostrarLista.value) return
  const n = sugestoes.value.length
  if (e.key === 'ArrowDown') {
    e.preventDefault()
    ativa.value = (ativa.value + 1) % n
  }
  else if (e.key === 'ArrowUp') {
    e.preventDefault()
    ativa.value = ativa.value <= 0 ? n - 1 : ativa.value - 1
  }
  else if (e.key === 'Enter' && ativa.value >= 0) {
    e.preventDefault()
    escolher(sugestoes.value[ativa.value])
  }
  else if (e.key === 'Escape') {
    e.preventDefault()
    e.stopPropagation()
    escolheu.value = true
  }
}

function preparar(materia, nomeInicial = '') {
  editando.value = materia
  nome.value = materia?.nome ?? nomeInicial
  const m = materia ? null : acharMateria(nomeInicial)
  area.value = materia?.area ?? m?.area ?? 'outra'
  cor.value = materia?.cor ?? corPara(m)
  tocou.area = !!materia
  tocou.cor = !!materia
  erroNome.value = ''
  erro.value = ''
  escolheu.value = !!m
  ativa.value = -1
  janela.value?.abrir()
  nextTick(() => {
    campoNome.value?.focus()
    if (materia) campoNome.value?.select()
  })
}
const abrirNova = (nomeInicial = '') => preparar(null, String(nomeInicial ?? '').slice(0, LIMITES.nomeMateria))
const abrirEditar = (materia) => preparar(materia)

async function salvar() {
  erroNome.value = validarNome(nome.value, LIMITES.nomeMateria)
  if (!erroNome.value && nomesUsados.value.has(normalizar(nome.value))) erroNome.value = 'Você já tem uma matéria com esse nome.'
  if (erroNome.value) {
    tremer.value = false
    nextTick(() => { tremer.value = true })
    return campoNome.value?.focus()
  }
  salvando.value = true
  erro.value = ''
  try {
    const dados = { nome: nome.value.trim(), area: area.value, cor: cor.value }
    if (editando.value) {
      await api.atualizarMateria(editando.value.id, dados)
      janela.value?.fechar()
      avisar({ texto: 'Matéria salva.', tipo: 'ok' })
    }
    else {
      const id = await api.criarMateria(dados)
      janela.value?.fechar()
      avisar({ texto: 'Matéria criada.', tipo: 'ok' })
      await navigateTo(`/materias/${id}`)
    }
  }
  catch (e) {
    erro.value = e.message
  }
  salvando.value = false
}

defineExpose({ abrirNova, abrirEditar })
</script>

<template>
  <JanelaBase
    ref="janela"
    :titulo="editando ? 'Editar matéria' : 'Nova matéria'"
    :descricao="editando ? '' : 'Escreva o nome como na escola. O PGC sugere a área, a cor e os assuntos.'"
  >
    <form id="form-materia" class="grid gap-5" novalidate @submit.prevent="salvar">
      <div>
        <label class="rotulo" for="nome-materia">Nome</label>
        <input
          id="nome-materia"
          ref="campoNome"
          v-model="nome"
          class="campo"
          :class="tremer && erroNome && 'treme'"
          type="text"
          autocomplete="off"
          spellcheck="false"
          :maxlength="LIMITES.nomeMateria"
          role="combobox"
          aria-autocomplete="list"
          :aria-expanded="mostrarLista"
          aria-controls="sugestoes-materia"
          :aria-activedescendant="mostrarLista && ativa >= 0 ? idOpcao(ativa) : undefined"
          :aria-invalid="!!erroNome || undefined"
          :aria-describedby="erroNome ? 'erro-nome-materia' : 'ajuda-nome-materia'"
          @input="digitou"
          @focus="focado = true"
          @blur="focado = false"
          @keydown="teclado"
        >
        <Transition name="abre">
          <ul v-if="mostrarLista" id="sugestoes-materia" role="listbox" aria-label="Matérias do catálogo" class="m-0 mt-2 list-none overflow-hidden rounded-[14px] border border-borda bg-folha p-1">
            <li
              v-for="(m, i) in sugestoes"
              :id="idOpcao(i)"
              :key="m.id"
              role="option"
              :aria-selected="i === ativa"
              class="opcao-catalogo"
              @mousedown.prevent="escolher(m)"
              @mousemove="ativa = i"
            >
              <span class="ponto-cor" :style="{ background: `${corMateria(m.cor)}` }" aria-hidden="true" />
              <span class="min-w-0 flex-1 truncate font-semibold">{{ m.nome }}</span>
              <span class="hidden truncate text-[13px] text-texto-3 sm:inline">{{ nomeDaArea(m.area) }}</span>
              <span class="shrink-0 text-[13px] text-texto-3">{{ m.assuntos.length }} assuntos</span>
            </li>
          </ul>
        </Transition>
        <p v-if="erroNome" id="erro-nome-materia" class="erro-campo" role="alert">
          <CircleAlert :size="16" :stroke-width="2" aria-hidden="true" class="mt-px shrink-0" />{{ erroNome }}
        </p>
        <p v-else-if="!editando && doCatalogo" id="ajuda-nome-materia" class="ajuda flex items-center gap-1.5 text-ok" aria-live="polite">
          <Check :size="15" :stroke-width="2.4" aria-hidden="true" class="shrink-0" />
          <span>{{ doCatalogo.assuntos.length }} assuntos sugeridos esperam você na página da matéria.</span>
        </p>
        <p v-else id="ajuda-nome-materia" class="ajuda">Por exemplo: Português, Biologia, Python.</p>
      </div>

      <div class="max-w-[360px]">
        <label class="rotulo" for="area-materia">Área</label>
        <Selecao id="area-materia" v-model="area" :opcoes="opcoesArea" :busca="false" @change="tocou.area = true" />
      </div>

      <div>
        <span class="rotulo">Cor</span>
        <SeletorCor v-model="cor" rotulo="Cor da matéria" @update:model-value="tocou.cor = true" />
        <p class="ajuda">Uma das prontas ou qualquer outra: abra e escolha o tom.</p>
      </div>

      <p v-if="erro" class="erro-campo m-0" role="alert">
        <CircleAlert :size="16" :stroke-width="2" aria-hidden="true" class="mt-px shrink-0" />{{ erro }}
      </p>
    </form>

    <template #rodape>
      <button type="button" class="botao-fantasma botao-p h-10" @click="janela?.fechar()">Cancelar</button>
      <button type="submit" form="form-materia" class="botao h-10" :aria-busy="salvando" :disabled="salvando">
        <span v-if="salvando" class="rodando" aria-hidden="true" />
        <Check v-else-if="editando" :size="17" :stroke-width="2.2" aria-hidden="true" />
        <Plus v-else :size="17" :stroke-width="2.2" aria-hidden="true" />
        <span>{{ editando ? 'Salvar' : 'Criar matéria' }}</span>
      </button>
    </template>
  </JanelaBase>
</template>

<style scoped>
.opcao-catalogo {
  display: flex;
  align-items: center;
  gap: 10px;
  min-height: 42px;
  padding: 0 12px;
  border-radius: 10px;
  font-size: 14.5px;
  cursor: pointer;
  transition: background-color 0.15s;
}
.opcao-catalogo[aria-selected='true'],
.opcao-catalogo:hover {
  background: var(--acento-suave);
}
.amostra {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  width: 58px;
  font-size: 12px;
  font-weight: 600;
  color: var(--texto-3);
  cursor: pointer;
}
.bolinha-cor {
  display: grid;
  place-items: center;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  color: var(--folha);
  transition: transform 0.25s var(--ease-mola), box-shadow 0.2s;
}
.amostra:hover .bolinha-cor {
  transform: scale(1.1);
}
.amostra:has(input:checked) {
  color: var(--tinta);
}
.amostra:has(input:checked) .bolinha-cor {
  box-shadow: 0 0 0 2px var(--folha), 0 0 0 4px var(--tinta);
}
.amostra:has(input:focus-visible) .bolinha-cor {
  outline: 2px solid var(--acento);
  outline-offset: 5px;
}
@media (prefers-reduced-motion: reduce) {
  .bolinha-cor { transition: none; }
}
:global(:root.menos-movimento) .bolinha-cor {
  transition: none;
}
</style>
