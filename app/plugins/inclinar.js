// Diretiva v-inclinar: o cartão inclina de leve na direção do mouse e ganha um brilho azul que segue o cursor.
// Só com mouse (no toque não faz nada) e nunca com "menos movimento". Inclinação máxima pequena (4 graus).
// Uso: <article v-inclinar class="cartao">...</article>   ou   v-inclinar="2" (graus)

function semMovimento() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches || document.documentElement.classList.contains('menos-movimento')
}

export default defineNuxtPlugin((nuxtApp) => {
  nuxtApp.vueApp.directive('inclinar', {
    getSSRProps: () => ({}),
    mounted(el, binding) {
      if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return
      const graus = Number(binding.value) || 4
      el.classList.add('inclina')
      const mover = (evento) => {
        if (semMovimento()) return
        const r = el.getBoundingClientRect()
        const px = (evento.clientX - r.left) / r.width
        const py = (evento.clientY - r.top) / r.height
        el.style.setProperty('--ry', `${((px - 0.5) * 2 * graus).toFixed(2)}deg`)
        el.style.setProperty('--rx', `${((0.5 - py) * 2 * graus).toFixed(2)}deg`)
        el.style.setProperty('--mx', `${(px * 100).toFixed(1)}%`)
        el.style.setProperty('--my', `${(py * 100).toFixed(1)}%`)
      }
      const sair = () => {
        el.style.setProperty('--rx', '0deg')
        el.style.setProperty('--ry', '0deg')
      }
      el.addEventListener('pointermove', mover)
      el.addEventListener('pointerleave', sair)
      el._inclinar = { mover, sair }
    },
    unmounted(el) {
      if (!el._inclinar) return
      el.removeEventListener('pointermove', el._inclinar.mover)
      el.removeEventListener('pointerleave', el._inclinar.sair)
    },
  })
})
