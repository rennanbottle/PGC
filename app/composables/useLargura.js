// Largura de um elemento em pixels, atualizada quando ele muda de tamanho. Os gráficos em SVG usam isso para que
// 1 unidade do desenho seja 1 pixel na tela: assim o texto dos eixos fica do mesmo tamanho no celular e no computador.
// Uso: const caixa = ref(null); const largura = useLargura(caixa, 640)
export function useLargura(elemento, inicial = 640) {
  const largura = ref(inicial)
  let medidor = null
  onMounted(() => {
    const el = unref(elemento)
    if (!el || typeof ResizeObserver === 'undefined') return
    const medir = () => {
      const w = Math.round(el.getBoundingClientRect().width)
      if (w > 0) largura.value = w
    }
    medir()
    medidor = new ResizeObserver(medir)
    medidor.observe(el)
  })
  onBeforeUnmount(() => medidor?.disconnect())
  return largura
}
