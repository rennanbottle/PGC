// Diretiva v-revelar: a peça aparece subindo de leve quando entra na tela ao rolar, uma vez só. Os gráficos dentro
// dela só começam a crescer nesse momento (antes ficam parados no início), então a pessoa vê a animação.
// O que já está na tela ao abrir não espera. Com "menos movimento" (do sistema ou do PGC) tudo fica visível de cara.
// A conferência é feita a cada rolagem (e não só quando a peça cruza a borda), então um salto com a tecla End ou um
// link para o fim da página também revela o que ficou para trás.
// Uso: <section v-revelar class="cartao">   ou   v-revelar="2" (atrasa 2 passos de 70 ms, para cascata numa fileira)
// Outras entradas, como no site da escola: v-revelar:esquerda, v-revelar:direita (vem do lado) e v-revelar:zoom.

function semMovimento() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches || document.documentElement.classList.contains('menos-movimento')
}

export default defineNuxtPlugin((nuxtApp) => {
  const esperando = new Set()
  let pedido = 0

  function revelar(el) {
    esperando.delete(el)
    el.classList.add('revelado')
    // Depois de aparecer, a peça volta ao normal (o levantar ao passar o mouse não herda o atraso).
    const atraso = Number.parseInt(el.style.getPropertyValue('--atraso')) || 0
    setTimeout(() => el.classList.remove('a-revelar', 'revelado'), 800 + atraso)
  }
  function conferir() {
    pedido = 0
    const limite = window.innerHeight * 0.94
    for (const el of esperando) {
      if (!el.isConnected) esperando.delete(el)
      else if (el.getBoundingClientRect().top < limite) revelar(el)
    }
    if (!esperando.size) desligar()
  }
  const agendar = () => {
    if (!pedido) pedido = requestAnimationFrame(conferir)
  }
  let ligado = false
  function ligar() {
    if (ligado) return
    ligado = true
    window.addEventListener('scroll', agendar, { passive: true, capture: true })
    window.addEventListener('resize', agendar, { passive: true })
  }
  function desligar() {
    if (!ligado) return
    ligado = false
    window.removeEventListener('scroll', agendar, { capture: true })
    window.removeEventListener('resize', agendar)
  }

  nuxtApp.vueApp.directive('revelar', {
    getSSRProps: () => ({}),
    mounted(el, binding) {
      if (semMovimento()) return
      const r = el.getBoundingClientRect()
      if (r.top < window.innerHeight * 0.94) return
      el.style.setProperty('--atraso', `${(Number(binding.value) || 0) * 70}ms`)
      if (binding.arg) el.dataset.revelar = binding.arg
      el.classList.add('a-revelar')
      esperando.add(el)
      ligar()
    },
    unmounted(el) {
      esperando.delete(el)
    },
  })
})
