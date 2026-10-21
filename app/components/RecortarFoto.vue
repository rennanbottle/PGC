<script setup>
// Ajustar a foto de perfil antes de usar: arrastar para posicionar, aproximar ou afastar e girar.
// O círculo mostra exatamente o que vai aparecer. Sai uma imagem quadrada de 256 px (JPEG), pronta para enviar.
// Teclado: setas movem, + e - aproximam e afastam, R gira.
// Uso: <RecortarFoto ref="recorte" @pronto="({ blob, dataUrl }) => ..." /> e depois recorte.value.abrir(arquivo)
import { Minus, Plus, RotateCw } from '@lucide/vue'

const emit = defineEmits(['pronto', 'cancelou'])
const janela = ref(null)
const palco = ref(null)
const imagem = ref(null)
const fonte = ref('')
const natural = ref({ w: 1, h: 1 })
const zoom = ref(1)
const giro = ref(0)
const pos = ref({ x: 0, y: 0 })
const erro = ref('')
const LADO = 288
const DIAMETRO = 248
const SAIDA = 256

const girada = computed(() => (giro.value % 180 === 0 ? natural.value : { w: natural.value.h, h: natural.value.w }))
const escalaBase = computed(() => DIAMETRO / Math.min(girada.value.w, girada.value.h))
const escala = computed(() => escalaBase.value * zoom.value)

function limitar(p) {
  const maxX = Math.max(0, (girada.value.w * escala.value - DIAMETRO) / 2)
  const maxY = Math.max(0, (girada.value.h * escala.value - DIAMETRO) / 2)
  return { x: Math.min(maxX, Math.max(-maxX, p.x)), y: Math.min(maxY, Math.max(-maxY, p.y)) }
}
watch([zoom, giro], () => (pos.value = limitar(pos.value)))

async function abrir(arquivo) {
  erro.value = ''
  if (!arquivo?.type?.startsWith('image/')) {
    erro.value = 'Escolha uma imagem JPG, PNG ou WebP.'
    return false
  }
  // A imagem entra como data: (e não blob:), porque a política de segurança do site só aceita imagens assim.
  try {
    fonte.value = await new Promise((ok, falha) => {
      const leitor = new FileReader()
      leitor.onload = () => ok(String(leitor.result))
      leitor.onerror = () => falha(leitor.error)
      leitor.readAsDataURL(arquivo)
    })
  }
  catch {
    erro.value = 'Não deu para abrir essa imagem. Tente outra.'
    return false
  }
  zoom.value = 1
  giro.value = 0
  pos.value = { x: 0, y: 0 }
  janela.value?.abrir()
  return true
}
function carregou() {
  natural.value = { w: imagem.value.naturalWidth || 1, h: imagem.value.naturalHeight || 1 }
}

let arrasto = null
function apertar(evento) {
  arrasto = { x: evento.clientX, y: evento.clientY, inicio: { ...pos.value } }
  palco.value?.setPointerCapture(evento.pointerId)
}
function mover(evento) {
  if (!arrasto) return
  pos.value = limitar({ x: arrasto.inicio.x + evento.clientX - arrasto.x, y: arrasto.inicio.y + evento.clientY - arrasto.y })
}
function soltar() {
  arrasto = null
}
function roda(evento) {
  evento.preventDefault()
  zoom.value = Math.min(4, Math.max(1, zoom.value - evento.deltaY * 0.0015))
}
function teclado(evento) {
  const passo = evento.shiftKey ? 30 : 10
  const mapa = { ArrowLeft: [-passo, 0], ArrowRight: [passo, 0], ArrowUp: [0, -passo], ArrowDown: [0, passo] }
  if (mapa[evento.key]) {
    evento.preventDefault()
    pos.value = limitar({ x: pos.value.x + mapa[evento.key][0], y: pos.value.y + mapa[evento.key][1] })
  }
  else if (evento.key === '+' || evento.key === '=') zoom.value = Math.min(4, zoom.value + 0.15)
  else if (evento.key === '-') zoom.value = Math.max(1, zoom.value - 0.15)
  else if (evento.key.toLowerCase() === 'r') giro.value = (giro.value + 90) % 360
}

async function usar() {
  const canvas = document.createElement('canvas')
  canvas.width = SAIDA
  canvas.height = SAIDA
  const ctx = canvas.getContext('2d')
  const fator = SAIDA / DIAMETRO
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, SAIDA, SAIDA)
  ctx.translate(SAIDA / 2 + pos.value.x * fator, SAIDA / 2 + pos.value.y * fator)
  ctx.rotate((giro.value * Math.PI) / 180)
  const s = escala.value * fator
  ctx.drawImage(imagem.value, (-natural.value.w * s) / 2, (-natural.value.h * s) / 2, natural.value.w * s, natural.value.h * s)
  const blob = await new Promise((resolver) => canvas.toBlob(resolver, 'image/jpeg', 0.88))
  emit('pronto', { blob, dataUrl: canvas.toDataURL('image/jpeg', 0.88) })
  janela.value?.fechar()
}
function cancelar() {
  emit('cancelou')
  janela.value?.fechar()
}

defineExpose({ abrir, erro })
</script>

<template>
  <JanelaBase ref="janela" titulo="Ajustar a foto" descricao="Arraste para posicionar. O círculo mostra o que vai aparecer.">
    <div class="flex flex-col items-center gap-4">
      <div
        ref="palco"
        class="relative cursor-grab touch-none select-none overflow-hidden rounded-[20px] bg-folha-3 active:cursor-grabbing"
        :style="{ width: `${LADO}px`, height: `${LADO}px`, maxWidth: '100%' }"
        tabindex="0"
        role="application"
        aria-label="Área da foto. Setas movem, mais e menos aproximam, R gira."
        @pointerdown="apertar"
        @pointermove="mover"
        @pointerup="soltar"
        @pointercancel="soltar"
        @wheel="roda"
        @keydown="teclado"
      >
        <img
          v-if="fonte"
          ref="imagem"
          :src="fonte"
          alt=""
          draggable="false"
          class="pointer-events-none absolute left-1/2 top-1/2 max-w-none origin-center"
          :style="{
            width: `${natural.w}px`,
            height: `${natural.h}px`,
            transform: `translate(-50%, -50%) translate(${pos.x}px, ${pos.y}px) rotate(${giro}deg) scale(${escala})`,
          }"
          @load="carregou"
        >
        <!-- Máscara: escurece fora do círculo. -->
        <div
          class="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full"
          :style="{ width: `${DIAMETRO}px`, height: `${DIAMETRO}px`, boxShadow: '0 0 0 400px rgb(10 14 26 / 0.55)', outline: '2px solid rgb(255 255 255 / 0.85)' }"
        />
      </div>

      <div class="flex w-full max-w-[300px] items-center gap-3">
        <button type="button" class="botao-icone pequeno" aria-label="Afastar" @click="zoom = Math.max(1, zoom - 0.2)">
          <Minus :size="17" :stroke-width="2.2" aria-hidden="true" />
        </button>
        <input v-model.number="zoom" type="range" min="1" max="4" step="0.01" class="faixa flex-1" aria-label="Aproximar">
        <button type="button" class="botao-icone pequeno" aria-label="Aproximar" @click="zoom = Math.min(4, zoom + 0.2)">
          <Plus :size="17" :stroke-width="2.2" aria-hidden="true" />
        </button>
        <button type="button" class="botao-icone pequeno group" aria-label="Girar 90 graus" @click="giro = (giro + 90) % 360">
          <RotateCw :size="17" :stroke-width="2.2" class="transition-transform duration-300 group-active:rotate-90" aria-hidden="true" />
        </button>
      </div>
    </div>
    <template #rodape>
      <button type="button" class="botao-fantasma" @click="cancelar">Cancelar</button>
      <button type="button" class="botao" :disabled="!fonte" @click="usar">Usar esta foto</button>
    </template>
  </JanelaBase>
</template>
