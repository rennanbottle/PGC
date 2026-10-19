// Cores das matérias: uma das 8 cores com nome (azul, verde...) ou qualquer cor escolhida no seletor (#rrggbb).
// As cores com nome mudam de tom no tema escuro (tokens --marca-*). Uma cor livre é misturada de leve com a cor do
// texto, para continuar visível nos dois temas.

export const NOMES_CORES = ['azul', 'verde', 'laranja', 'roxo', 'vermelho', 'amarelo', 'rosa', 'cinza']
export const ehHex = (cor) => typeof cor === 'string' && /^#[0-9a-f]{6}$/i.test(cor)

export function corMateria(cor) {
  if (ehHex(cor)) return `color-mix(in oklab, ${cor} 85%, var(--tinta))`
  return `var(--marca-${NOMES_CORES.includes(cor) ? cor : 'cinza'})`
}

// HSV (matiz 0-360, saturação e brilho 0-1) <-> #rrggbb, para o seletor de cor.
export function hsvParaHex({ h, s, v }) {
  const f = (n) => {
    const k = (n + h / 60) % 6
    return v - v * s * Math.max(0, Math.min(k, 4 - k, 1))
  }
  return `#${[f(5), f(3), f(1)].map((x) => Math.round(x * 255).toString(16).padStart(2, '0')).join('')}`
}

export function hexParaHsv(hex) {
  if (!ehHex(hex)) return { h: 220, s: 0.8, v: 0.9 }
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
  const max = Math.max(r, g, b)
  const d = max - Math.min(r, g, b)
  let h = 0
  if (d) {
    if (max === r) h = ((g - b) / d) % 6
    else if (max === g) h = (b - r) / d + 2
    else h = (r - g) / d + 4
    h *= 60
    if (h < 0) h += 360
  }
  return { h, s: max ? d / max : 0, v: max }
}
