// Prepara a foto de perfil no próprio navegador: corta em quadrado, reduz para 256 px e salva em JPEG.
// O arquivo enviado fica pequeno (uns 20 KB) e sai sem os dados da câmera (local, modelo do aparelho).

const LIMITE_ORIGINAL = 12 * 1024 * 1024

export async function reduzirImagem(arquivo, lado = 256) {
  if (!arquivo || !String(arquivo.type).startsWith('image/')) {
    throw new Error('Escolha um arquivo de imagem, em JPG, PNG ou WebP.')
  }
  if (arquivo.size > LIMITE_ORIGINAL) throw new Error('A imagem é muito grande. Escolha uma de até 12 MB.')

  let imagem
  try {
    imagem = await createImageBitmap(arquivo, { imageOrientation: 'from-image' })
  }
  catch {
    throw new Error('Não foi possível abrir essa imagem. Tente outra, em JPG, PNG ou WebP.')
  }

  const corte = Math.min(imagem.width, imagem.height)
  const tela = document.createElement('canvas')
  tela.width = lado
  tela.height = lado
  const contexto = tela.getContext('2d')
  // Fundo branco: PNG com transparência viraria preto no JPEG.
  contexto.fillStyle = '#ffffff'
  contexto.fillRect(0, 0, lado, lado)
  contexto.drawImage(imagem, (imagem.width - corte) / 2, (imagem.height - corte) / 2, corte, corte, 0, 0, lado, lado)
  imagem.close?.()

  const blob = await new Promise((resolver) => tela.toBlob(resolver, 'image/jpeg', 0.86))
  if (!blob) throw new Error('Não foi possível preparar essa imagem. Tente outra.')
  return blob
}

export function blobParaDataUrl(blob) {
  return new Promise((resolver, falhar) => {
    const leitor = new FileReader()
    leitor.onload = () => resolver(leitor.result)
    leitor.onerror = () => falhar(leitor.error)
    leitor.readAsDataURL(blob)
  })
}

// Sem fetch: a política de segurança do site não precisa liberar "data:" para isso.
export function dataUrlParaBlob(dataUrl) {
  const [cabeca, dados = ''] = String(dataUrl).split(',')
  const tipo = /^data:([^;]+)/.exec(cabeca)?.[1] ?? 'image/jpeg'
  const binario = atob(dados)
  const bytes = new Uint8Array(binario.length)
  for (let i = 0; i < binario.length; i++) bytes[i] = binario.charCodeAt(i)
  return new Blob([bytes], { type: tipo })
}

// Imagem de questão (gráfico, figura): mantém a proporção, no máximo 1400 px de largura, em JPEG.
export async function reduzirFigura(arquivo, larguraMaxima = 1400) {
  if (!arquivo || !String(arquivo.type).startsWith('image/')) throw new Error('Escolha um arquivo de imagem, em JPG, PNG ou WebP.')
  if (arquivo.size > LIMITE_ORIGINAL) throw new Error('A imagem é muito grande. Escolha uma de até 12 MB.')
  let imagem
  try {
    imagem = await createImageBitmap(arquivo, { imageOrientation: 'from-image' })
  }
  catch {
    throw new Error('Não foi possível abrir essa imagem. Tente outra, em JPG, PNG ou WebP.')
  }
  const escala = Math.min(1, larguraMaxima / imagem.width)
  const tela = document.createElement('canvas')
  tela.width = Math.round(imagem.width * escala)
  tela.height = Math.round(imagem.height * escala)
  const contexto = tela.getContext('2d')
  contexto.fillStyle = '#ffffff'
  contexto.fillRect(0, 0, tela.width, tela.height)
  contexto.drawImage(imagem, 0, 0, tela.width, tela.height)
  imagem.close?.()
  const blob = await new Promise((resolver) => tela.toBlob(resolver, 'image/jpeg', 0.88))
  if (!blob) throw new Error('Não foi possível preparar essa imagem. Tente outra.')
  return blob
}
