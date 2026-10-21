<script setup>
// Criar o próprio guia: o passo a passo, o pedido para copiar, o envio dos dois mosaicos e a prévia das 12
// expressões. O recorte é feito aqui no navegador (canvas), com as regras de shared/regras/guias.js; o resultado
// é uma imagem só (sprite 4 × 3) em data URL. Uso: <GuiaCriarGuia v-model:imagem="..." />
// O nome do guia fica em EscolherGuia (vale para qualquer guia).
import { Check, Copy, ExternalLink, ImageUp, RotateCcw } from '@lucide/vue'
import { ERROS_MOSAICO, EXPRESSOES, LADO_QUADRO, PEDIDO_GUIA, acharQuadros, ordemDosMosaicos, temTransparencia, tirarFundo, unificarLado } from '#shared/regras/guias.js'

const imagem = defineModel('imagem', { type: String, default: null })
const { avisar } = useAvisos()
const id = useId()

const ARQUIVO_MAXIMO = 15 * 1024 * 1024
const arquivos = ref([null, null])
const entradas = ref([])
const processando = ref(false)
const erro = ref('')
const copiado = ref(false)
const verPedido = ref(false)

async function copiar() {
  try {
    await copiarTexto(PEDIDO_GUIA)
    copiado.value = true
  }
  catch {
    verPedido.value = true
    avisar({ texto: 'Não deu para copiar sozinho. Selecione o pedido e copie.', tipo: 'erro' })
  }
}

// Escolheu um arquivo (ou os dois de uma vez, no primeiro botão).
function escolheu(evento, posicao) {
  const lista = [...(evento.target.files ?? [])]
  evento.target.value = ''
  if (!lista.length) return
  erro.value = ''
  if (lista.some((f) => f.size > ARQUIVO_MAXIMO)) {
    erro.value = 'Uma das imagens passa de 15 MB. Envie o arquivo que a IA entregou, sem aumentar.'
    return
  }
  if (lista.length >= 2) {
    // O último número do nome diz a ordem (…-1.png é o primeiro); sem número, vale a ordem escolhida.
    const ordem = ordemDosMosaicos(lista.slice(0, 2).map((f) => f.name))
    arquivos.value = [lista[ordem[0]], lista[ordem[1]]]
  }
  else {
    const novos = [...arquivos.value]
    novos[posicao] = lista[0]
    arquivos.value = novos
  }
  if (arquivos.value[0] && arquivos.value[1]) montar()
}

async function lerMosaico(arquivo) {
  const dataUrl = await new Promise((resolve, reject) => {
    const leitor = new FileReader()
    leitor.onload = () => resolve(leitor.result)
    leitor.onerror = () => reject(new Error(ERROS_MOSAICO.tipo))
    leitor.readAsDataURL(arquivo)
  })
  const img = new Image()
  img.src = dataUrl
  try {
    await img.decode()
  }
  catch {
    throw new Error(ERROS_MOSAICO.tipo)
  }
  const escala = Math.min(1, 3072 / img.naturalWidth)
  const largura = Math.round(img.naturalWidth * escala)
  const altura = Math.round(img.naturalHeight * escala)
  const canvas = document.createElement('canvas')
  canvas.width = largura
  canvas.height = altura
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  ctx.drawImage(img, 0, 0, largura, altura)
  const dados = ctx.getImageData(0, 0, largura, altura)
  if (!temTransparencia(dados.data)) {
    if (!tirarFundo(dados.data, largura, altura)) throw new Error(ERROS_MOSAICO.fundo)
    ctx.putImageData(dados, 0, 0)
  }
  const alfa = new Uint8Array(largura * altura)
  for (let p = 0; p < alfa.length; p++) alfa[p] = dados.data[p * 4 + 3]
  const achado = acharQuadros(alfa, largura, altura)
  if (achado.erro) throw new Error(ERROS_MOSAICO[achado.erro])
  return { canvas, quadros: achado.quadros, lado: achado.lado }
}

async function montar() {
  processando.value = true
  erro.value = ''
  try {
    // Enviou trocado (o que termina em 2 no primeiro lugar)? O último número do nome acerta a ordem.
    const ordem = ordemDosMosaicos(arquivos.value.map((f) => f.name))
    if (ordem[0] === 1) arquivos.value = [arquivos.value[1], arquivos.value[0]]
    const lidos = await Promise.all(arquivos.value.map(lerMosaico))
    const mosaicos = unificarLado(lidos).map((u, k) => ({ canvas: lidos[k].canvas, quadros: u.quadros }))
    const L = LADO_QUADRO
    const sprite = document.createElement('canvas')
    sprite.width = L * 4
    sprite.height = L * 3
    const ctx = sprite.getContext('2d')
    mosaicos.forEach(({ canvas, quadros }, m) => {
      quadros.forEach((q, k) => {
        const i = m * 6 + k
        const dx = (i % 4) * L
        const dy = Math.floor(i / 4) * L
        const esc = L / q.recorte.lado
        ctx.save()
        // Só a célula daquela expressão entra (nada do quadro vizinho), dentro do quadrado de destino.
        ctx.beginPath()
        ctx.rect(dx, dy, L, L)
        ctx.clip()
        ctx.beginPath()
        ctx.rect(dx + (q.celula.x0 - q.recorte.x) * esc, dy + (q.celula.y0 - q.recorte.y) * esc, (q.celula.x1 - q.celula.x0) * esc, (q.celula.y1 - q.celula.y0) * esc)
        ctx.clip()
        ctx.drawImage(canvas, q.recorte.x, q.recorte.y, q.recorte.lado, q.recorte.lado, dx, dy, L, L)
        ctx.restore()
      })
    })
    let url = sprite.toDataURL('image/webp', 0.86)
    if (!url.startsWith('data:image/webp')) url = sprite.toDataURL('image/png')
    imagem.value = url
  }
  catch (e) {
    imagem.value = null
    erro.value = e?.message || 'Não deu para ler as imagens. Confira se são os dois mosaicos que a IA criou.'
  }
  processando.value = false
}

function recomecar() {
  arquivos.value = [null, null]
  imagem.value = null
  erro.value = ''
}
const SLOTS = [
  { titulo: 'Primeira imagem, expressões 1 a 6', dica: 'O nome do arquivo termina em 1' },
  { titulo: 'Segunda imagem, expressões 7 a 12', dica: 'O nome do arquivo termina em 2' },
]
</script>

<template>
  <div class="flex flex-col gap-5">
    <ol class="passos-guia m-0 flex list-none flex-col gap-3.5 p-0">
      <li>
        <b>Escolha a imagem do seu guia.</b> Uma foto ou um desenho de um personagem, um animal ou o que você quiser,
        de frente e com o rosto bem visível.
      </li>
      <li>
        <b>Copie o pedido do PGC.</b> Ele diz à IA como fazer as 12 expressões e o formato que o PGC sabe recortar.
        <span class="mt-2 flex flex-wrap items-center gap-2">
          <button type="button" class="botao-secundario botao-p" @click="copiar">
            <Check v-if="copiado" :size="16" :stroke-width="2.4" class="text-ok" aria-hidden="true" />
            <Copy v-else :size="16" :stroke-width="2.1" aria-hidden="true" />
            {{ copiado ? 'Pedido copiado' : 'Copiar pedido' }}
          </button>
          <button type="button" class="link-discreto text-[13.5px]" :aria-expanded="verPedido" :aria-controls="`${id}-pedido`" @click="verPedido = !verPedido">
            {{ verPedido ? 'Esconder o pedido' : 'Ver o pedido' }}
          </button>
        </span>
        <Transition name="abre">
          <pre v-if="verPedido" :id="`${id}-pedido`" class="m-0 mt-2 max-h-[220px] overflow-auto whitespace-pre-wrap rounded-[12px] border border-borda bg-folha-2 px-3.5 py-3 font-mono text-[12px] leading-[1.55] text-texto-2">{{ PEDIDO_GUIA }}</pre>
        </Transition>
      </li>
      <li>
        <b>Abra o ChatGPT, anexe a imagem e cole o pedido.</b> O pedido foi feito para ele, que cria as imagens com fundo
        transparente. Outras IAs que criam imagens também servem; se o fundo vier de uma cor só, o PGC tenta tirar.
        <span class="mt-2 flex">
          <a href="https://chatgpt.com/" target="_blank" rel="noopener noreferrer" class="botao-fantasma botao-p no-underline">
            Abrir o ChatGPT<ExternalLink :size="14" :stroke-width="2.1" aria-hidden="true" /><span class="so-leitor"> (abre em outra aba)</span>
          </a>
        </span>
      </li>
      <li>
        <b>Baixe as duas imagens que a IA criar</b> e envie aqui embaixo. Para saber qual é a primeira e qual é a
        segunda, olhe o último número do nome do arquivo: o que termina em 1 é a primeira (expressões 1 a 6) e o que
        termina em 2 é a segunda (7 a 12). O PGC recorta as 12 expressões sozinho.
      </li>
    </ol>

    <div class="grid gap-2.5 sm:grid-cols-2">
      <div v-for="(s, k) in SLOTS" :key="s.titulo" class="envio" :data-pronto="!!arquivos[k]">
        <p class="m-0 text-[14px] font-semibold">{{ s.titulo }}</p>
        <p class="m-0 mt-0.5 text-[12.5px] text-texto-3" :class="{ truncate: arquivos[k] }">{{ arquivos[k]?.name ?? s.dica }}</p>
        <button type="button" class="botao-secundario botao-p mt-2.5" :disabled="processando" @click="entradas[k]?.click()">
          <Check v-if="arquivos[k]" :size="16" :stroke-width="2.4" class="text-ok" aria-hidden="true" />
          <ImageUp v-else :size="16" :stroke-width="2" aria-hidden="true" />
          {{ arquivos[k] ? 'Trocar imagem' : 'Escolher imagem' }}
        </button>
        <input :ref="(el) => (entradas[k] = el)" type="file" accept="image/png,image/webp,image/jpeg" :multiple="k === 0" class="hidden" @change="escolheu($event, k)">
      </div>
    </div>

    <p v-if="processando" class="m-0 flex items-center gap-2.5 text-[14px] font-semibold" role="status">
      <span class="rodando text-acento" aria-hidden="true" />Recortando as expressões
    </p>
    <EntradaErroCampo :mensagem="erro" />

    <div v-if="imagem && !processando" class="flex flex-col gap-4" aria-live="polite">
      <div>
        <p class="m-0 flex flex-wrap items-center justify-between gap-2 text-[14px] font-semibold">
          As 12 expressões do seu guia
          <button type="button" class="link-discreto inline-flex items-center gap-1.5 text-[13.5px]" @click="recomecar">
            <RotateCcw :size="14" :stroke-width="2.2" aria-hidden="true" />Enviar outras imagens
          </button>
        </p>
        <ul class="m-0 mt-2.5 grid list-none grid-cols-4 gap-x-2 gap-y-3 p-0 sm:grid-cols-6">
          <li v-for="e in EXPRESSOES" :key="e.id" class="flex flex-col items-center gap-1 text-center">
            <GuiaPersonagem :imagem="imagem" :humor="e.id" :tamanho="64" />
            <span class="text-[12px] leading-tight text-texto-2">{{ e.nome }}</span>
          </li>
        </ul>
      </div>
    </div>
  </div>
</template>

<style scoped>
.passos-guia {
  counter-reset: passo;
}
.passos-guia > li {
  position: relative;
  padding-left: 36px;
  font-size: 14.5px;
  line-height: 1.5;
  color: var(--texto-2);
  counter-increment: passo;
}
.passos-guia > li b {
  color: var(--tinta);
  font-weight: 600;
}
.passos-guia > li::before {
  content: counter(passo);
  position: absolute;
  top: 0;
  left: 0;
  display: grid;
  width: 24px;
  height: 24px;
  place-items: center;
  border: 1.5px solid var(--borda-forte);
  border-radius: 999px;
  font-size: 12.5px;
  font-weight: 700;
  color: var(--tinta);
}
.envio {
  padding: 12px 14px;
  border: 1.5px solid var(--borda);
  border-radius: 14px;
}
.envio[data-pronto='true'] {
  border-color: var(--ok);
}
</style>
