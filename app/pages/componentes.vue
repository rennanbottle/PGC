<script setup>
// Guia de estilo vivo: todas as peças do PGC numa tela só, para conferir e para aprender a usar.
// Não aparece no menu. Abra /componentes com a conta logada.
import { BookOpen, Copy, Download, Pencil, Search, Sparkles, Upload } from '@lucide/vue'
import { EXPRESSOES } from '#shared/regras/guias.js'

useHead({ title: 'Peças do PGC | PGC' })

const { avisar } = useAvisos()
const janela = ref(null)
const area = ref('programacao')
const filtroMateria = ref('')
const tipos = ref(['multipla_escolha', 'numerica'])
const ligado = ref(true)
const nivel = ref('normal')
const marcado = ref(true)
const contador = ref(12)

const AREAS = [
  { valor: 'matematica', texto: 'Matemática', grupo: 'Escola' },
  { valor: 'portugues', texto: 'Português e literatura', grupo: 'Escola' },
  { valor: 'natureza', texto: 'Ciências da natureza', grupo: 'Escola' },
  { valor: 'programacao', texto: 'Programação e tecnologia', descricao: 'Python, JavaScript, banco de dados', grupo: 'Curso técnico' },
  { valor: 'exatas', texto: 'Engenharia e indústria', grupo: 'Curso técnico' },
]
const MATERIAS = [
  { valor: '', texto: 'Todas' },
  { valor: 'a', texto: 'Matemática', cor: 'var(--marca-azul)' },
  { valor: 'b', texto: 'História', cor: 'var(--marca-laranja)' },
  { valor: 'c', texto: 'Python', cor: 'var(--marca-verde)' },
]
const TIPOS = [
  { valor: 'multipla_escolha', texto: 'Múltipla escolha', descricao: '4 ou 5 alternativas, uma certa' },
  { valor: 'numerica', texto: 'Resposta numérica', descricao: 'número, tolerância e unidade' },
  { valor: 'vf', texto: 'V ou F com justificativa', descricao: 'afirmação e o porquê' },
  { valor: 'lacuna', texto: 'Lacuna digitada', descricao: 'a palavra que falta' },
]
const semana = [
  { rotulo: 'S', valor: 8, dica: 'Sexta, 8 questões' },
  { rotulo: 'S', valor: 0, dica: 'Sábado, nenhuma' },
  { rotulo: 'D', valor: 5, dica: 'Domingo, 5 questões' },
  { rotulo: 'S', valor: 14, dica: 'Segunda, 14 questões' },
  { rotulo: 'T', valor: 20, dica: 'Terça, 20 questões' },
  { rotulo: 'Q', valor: 9, dica: 'Quarta, 9 questões' },
  { rotulo: 'Q', valor: 12, dica: 'Hoje, 12 questões', destaque: true },
]
const dias = Array.from({ length: 112 }, (_, i) => {
  const d = new Date(2026, 9, 8)
  d.setDate(d.getDate() - i)
  return { data: d.toISOString().slice(0, 10), valor: (i * 7) % 5 === 0 ? 0 : (i * 13) % 23 }
})
const codigo = `# Soma os números pares de uma lista
def soma_pares(numeros):
    total = 0
    for n in numeros:
        if n % 2 == 0:
            total += n
    return total

print(soma_pares([1, 2, 3, 4, 10]))  # 16`
</script>

<template>
  <div>
    <CabecalhoPagina titulo="Peças do PGC" descricao="Todas as peças da interface, do jeito que aparecem nas telas. Use como referência ao montar uma tela nova.">
      <template #acoes>
        <BotaoAdicionar secundario>Nova peça</BotaoAdicionar>
        <BotaoIa>Gerar com IA</BotaoIa>
      </template>
    </CabecalhoPagina>

    <div class="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
      <section class="cartao entra" style="--i: 0">
        <h2 class="titulo-secao">Botões</h2>
        <div class="mt-4 flex flex-wrap items-center gap-3">
          <button type="button" class="botao"><Upload :size="18" :stroke-width="2.2" aria-hidden="true" />Enviar</button>
          <button type="button" class="botao-secundario"><Pencil :size="17" :stroke-width="2" aria-hidden="true" />Editar</button>
          <button type="button" class="botao-fantasma"><Copy :size="17" :stroke-width="2" aria-hidden="true" />Copiar</button>
          <button type="button" class="botao botao-perigo">Excluir</button>
          <button type="button" class="botao" disabled>Desligado</button>
          <button type="button" class="botao" aria-busy="true"><span class="rodando" aria-hidden="true" />Salvando</button>
        </div>
        <div class="mt-4 flex flex-wrap items-center gap-3">
          <button type="button" class="botao botao-p">Pequeno</button>
          <button type="button" class="botao botao-g">Grande</button>
          <BotaoAdicionar redondo rotulo="Adicionar evento" />
          <BotaoLixeira rotulo="Apagar o assunto" />
          <button type="button" class="botao-icone" aria-label="Baixar" data-dica="Baixar o original"><Download :size="19" :stroke-width="2" aria-hidden="true" /></button>
          <BotaoSair />
          <MenuAcoes rotulo="Ações da matéria" :itens="[{ id: 'a', texto: 'Renomear', icone: Pencil }, { id: 'b', texto: 'Estudar só esta', icone: BookOpen }, { id: 'c', texto: 'Excluir', perigo: true, separar: true }]" />
        </div>
      </section>

      <section class="cartao-destaque entra" style="--i: 1">
        <h2 class="titulo-secao">Hoje</h2>
        <p class="mt-3 flex items-baseline gap-2">
          <span class="numero-grande"><Fracao :valor="contador" :total="20" /></span>
          <span class="text-[15px] text-texto-2">questões</span>
        </p>
        <p class="m-0 mt-1 flex items-center gap-2 text-[13.5px] font-semibold text-ok"><span class="selo" data-tipo="ok">+4</span>a mais que ontem</p>
        <div class="mt-5"><GraficoBarras :dados="semana" descricao="Questões por dia nesta semana: 68 no total, 12 hoje." :altura="96" /></div>
      </section>

      <section class="cartao entra" style="--i: 2">
        <h2 class="titulo-secao">Campos</h2>
        <div class="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <label class="rotulo" for="c-nome">Nome da matéria</label>
            <input id="c-nome" class="campo" value="Física">
            <p class="ajuda">Até 80 letras.</p>
          </div>
          <div>
            <label class="rotulo" for="c-email">E-mail</label>
            <input id="c-email" class="campo" aria-invalid="true" value="ana@">
            <p class="erro-campo">Escreva o e-mail inteiro, com o domínio.</p>
          </div>
          <div>
            <label class="rotulo" for="c-area">Área</label>
            <Selecao id="c-area" v-model="area" :opcoes="AREAS" />
          </div>
          <div>
            <label class="rotulo" for="c-tipos">Tipos de questão</label>
            <Selecao id="c-tipos" v-model="tipos" :opcoes="TIPOS" multiplo text-vazio="Nenhum tipo" />
          </div>
          <label class="campo-icone sm:col-span-2">
            <Search :size="17" :stroke-width="2" aria-hidden="true" />
            <input class="campo" type="search" aria-label="Buscar no texto">
          </label>
        </div>
        <div class="mt-4 flex flex-wrap items-center gap-2.5">
          <Selecao v-model="filtroMateria" variante="filtro" prefixo="Matéria" :opcoes="MATERIAS" />
          <Selecao v-model="nivel" variante="filtro" prefixo="Nível" :opcoes="[{ valor: 'facil', texto: 'Fácil' }, { valor: 'normal', texto: 'Normal' }, { valor: 'dificil', texto: 'Difícil' }]" :ativo-quando="() => false" />
        </div>
      </section>

      <section class="cartao entra" style="--i: 3">
        <h2 class="titulo-secao">Escolhas</h2>
        <div class="mt-4 flex flex-col gap-1">
          <label class="linha-opcao"><input v-model="marcado" type="checkbox" class="marcar"><span><b class="text-[14.5px]">Usar o texto inteiro</b><span class="block text-[13px] text-texto-3">Inclui as 12 páginas conferidas.</span></span></label>
          <label class="linha-opcao"><input type="radio" name="r" class="escolher" checked><span class="text-[14.5px]">Do próprio texto, sem IA</span></label>
          <label class="linha-opcao"><input type="radio" name="r" class="escolher"><span class="text-[14.5px]">IA do PGC</span></label>
          <label class="linha-opcao items-center justify-between"><span class="text-[14.5px] font-semibold">Mostrar o guia</span><input v-model="ligado" type="checkbox" role="switch" class="alternador"></label>
        </div>
        <div class="mt-3 flex flex-wrap gap-2">
          <label class="pilula"><input type="radio" name="n" class="so-leitor">Fácil</label>
          <label class="pilula"><input type="radio" name="n" class="so-leitor" checked>Normal</label>
          <label class="pilula"><input type="radio" name="n" class="so-leitor">Difícil</label>
        </div>
        <div class="mt-4 flex flex-wrap gap-2">
          <span class="selo" data-tipo="ok"><span class="ponto" />Pronto</span>
          <span class="selo" data-tipo="aviso"><span class="ponto" />Confira</span>
          <span class="selo" data-tipo="erro"><span class="ponto" />Falhou</span>
          <span class="selo" data-tipo="acento">Novo</span>
          <span class="selo" data-tipo="energia">+40 pontos</span>
          <span class="marca-ia" data-ia="true"><Sparkles :size="12" :stroke-width="2.4" aria-hidden="true" />usa IA</span>
          <span class="marca-ia">sem IA</span>
        </div>
        <div class="barra mt-4"><i style="width: 64%" /></div>
      </section>

      <section class="cartao entra lg:col-span-2" style="--i: 4">
        <h2 class="titulo-secao">Dias de estudo</h2>
        <div class="mt-4 flex flex-wrap items-end gap-8">
          <Calor :dias="dias" hoje="2026-10-08" />
          <div>
            <p class="m-0 text-[13px] font-semibold text-texto-3">Acerto nas últimas sessões</p>
            <p class="numero-medio mt-1"><NumeroAnimado :valor="72.5" :casas="1" sufixo="%" /></p>
            <Minigrafico :valores="[52, 61, 58, 70, 66, 74, 72]" :largura="180" />
          </div>
          <AppAnelMeta :feitas="12" :meta="20" :tamanho="72" :espessura="8" />
        </div>
      </section>

      <section class="entra" style="--i: 5">
        <Vazio titulo="Nenhuma matéria ainda" texto="Crie a primeira matéria e o PGC sugere os assuntos dela." humor="acenando">
          <template #acoes><BotaoAdicionar>Criar matéria</BotaoAdicionar></template>
        </Vazio>
      </section>

      <section class="entra flex flex-col gap-4" style="--i: 6">
        <BlocoCodigo :codigo="codigo" linguagem="python" />
        <div class="cartao-p text-[15.5px] leading-relaxed">
          <p class="rotulo">TextoRico (enunciado com código)</p>
          <TextoRico :texto="'O que a função `contar` devolve para a lista abaixo?\n```python\nnotas = [7, 4, 9]\nprint(contar(notas))\n```\nEscolha a alternativa certa.'" />
        </div>
      </section>

      <section class="cartao entra lg:col-span-2" style="--i: 7">
        <h2 class="titulo-secao">O guia</h2>
        <div class="mt-3 flex flex-wrap items-end gap-6">
          <figure v-for="h in EXPRESSOES.map((e) => e.id)" :key="h" class="m-0 flex flex-col items-center gap-1">
            <GuiaPersonagem :humor="h" :tamanho="84" />
            <figcaption class="text-[12.5px] font-semibold text-texto-3">{{ h }}</figcaption>
          </figure>
        </div>
        <div class="mt-5 flex flex-wrap gap-3">
          <button type="button" class="botao-secundario" @click="janela.abrir()">Abrir janela</button>
          <button type="button" class="botao-secundario" @click="avisar({ texto: 'Matéria criada.', tipo: 'ok' })">Aviso de sucesso</button>
          <button type="button" class="botao-secundario" @click="avisar({ texto: 'Assunto apagado.', acao: { texto: 'Desfazer', fazer: () => {} } })">Aviso com ação</button>
          <div class="esqueleto h-11 w-40" aria-hidden="true" />
        </div>
      </section>
    </div>

    <JanelaBase ref="janela" titulo="Nova matéria" descricao="Escreva o nome. A área, a cor e os assuntos vêm sugeridos.">
      <div>
        <label class="rotulo" for="j-nome">Nome</label>
        <input id="j-nome" class="campo">
      </div>
      <div>
        <label class="rotulo" for="j-area">Área</label>
        <Selecao id="j-area" v-model="area" :opcoes="AREAS" />
      </div>
      <template #rodape="{ fechar }">
        <button type="button" class="botao-fantasma" @click="fechar">Cancelar</button>
        <button type="button" class="botao">Criar matéria</button>
      </template>
    </JanelaBase>
  </div>
</template>
