// Saída automática: depois de X minutos sem mexer em nada, a conta sai sozinha (escolha do perfil, em "Sessão").
// Pensado para computadores da escola, usados por várias pessoas. Vale para todas as abas deste navegador:
// mexer numa aba conta para as outras. Um minuto antes, aparece um aviso com a contagem e o botão de continuar.

const CHAVE = 'pgc-ultima-atividade'
const AVISO_MS = 60 * 1000

export function useSaidaPorInatividade(minutos) {
  const aviso = ref(false)
  const restante = ref(60)
  const sair = useSair()
  let intervalo = null
  let ultimaMarca = 0
  let saindo = false

  function ler() {
    try {
      return Number(localStorage.getItem(CHAVE)) || Date.now()
    }
    catch {
      return ultimaMarca || Date.now()
    }
  }
  function marcar(forcar = false) {
    const agora = Date.now()
    // Com o aviso aberto, só o botão "Continuar" conta (mexer o mouse por acaso não cancela).
    if (aviso.value && !forcar) return
    if (!forcar && agora - ultimaMarca < 10000) return
    ultimaMarca = agora
    try {
      localStorage.setItem(CHAVE, String(agora))
    }
    catch {
      // Armazenamento bloqueado: conta só nesta aba.
    }
  }
  async function conferir() {
    const min = Number(minutos.value) || 0
    if (!min || saindo) {
      aviso.value = false
      return
    }
    const limite = min * 60 * 1000
    const parado = Date.now() - ler()
    if (parado >= limite) {
      saindo = true
      aviso.value = false
      await sair('local', { motivo: 'inatividade' })
      return
    }
    if (limite - parado <= AVISO_MS) {
      aviso.value = true
      restante.value = Math.max(1, Math.ceil((limite - parado) / 1000))
    }
    else aviso.value = false
  }
  function continuar() {
    aviso.value = false
    marcar(true)
  }
  async function sairAgora() {
    saindo = true
    aviso.value = false
    await sair()
  }

  const eventos = ['pointerdown', 'keydown', 'wheel', 'touchstart', 'scroll']
  const aoMexer = () => marcar()
  onMounted(() => {
    marcar(true)
    for (const e of eventos) window.addEventListener(e, aoMexer, { passive: true, capture: true })
    intervalo = setInterval(conferir, 1000)
  })
  onBeforeUnmount(() => {
    for (const e of eventos) window.removeEventListener(e, aoMexer, { capture: true })
    clearInterval(intervalo)
  })

  return { aviso, restante, continuar, sairAgora }
}
