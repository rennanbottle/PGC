// Divide o texto de uma questão, explicação ou dica em partes: texto comum, código na linha (`assim`) e blocos de
// código entre três crases (```python ... ```). Função pura, usada por <TextoRico>.
// Nada vira HTML: a tela mostra cada parte como texto ou dentro de <BlocoCodigo>.

const BLOCO = /```[ \t]*([\w+#.-]*)[ \t]*\r?\n?([\s\S]*?)```/g
const LINHA = /`([^`\n]+)`/g

function partesDaLinha(texto) {
  const partes = []
  let ultimo = 0
  for (const m of texto.matchAll(LINHA)) {
    if (m.index > ultimo) partes.push({ tipo: 'texto', texto: texto.slice(ultimo, m.index) })
    partes.push({ tipo: 'codigo', texto: m[1] })
    ultimo = m.index + m[0].length
  }
  if (ultimo < texto.length) partes.push({ tipo: 'texto', texto: texto.slice(ultimo) })
  return partes
}

export function dividirTexto(texto = '') {
  const t = String(texto ?? '')
  const partes = []
  let ultimo = 0
  for (const m of t.matchAll(BLOCO)) {
    const antes = t.slice(ultimo, m.index)
    if (antes.trim()) partes.push(...partesDaLinha(antes.replace(/\n+$/, '')))
    const codigo = m[2].replace(/\s+$/, '')
    if (codigo) partes.push({ tipo: 'bloco', linguagem: m[1].toLowerCase(), texto: codigo })
    ultimo = m.index + m[0].length
  }
  const resto = t.slice(ultimo)
  if (resto.trim() || partes.length === 0) partes.push(...partesDaLinha(partes.length ? resto.replace(/^\n+/, '') : resto))
  return partes.filter((p) => p.tipo !== 'texto' || p.texto !== '')
}

export const temCodigo = (texto = '') => /```|`[^`\n]+`/.test(String(texto ?? ''))
