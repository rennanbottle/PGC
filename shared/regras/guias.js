// Guia: o personagem que acompanha a pessoa pelo PGC (no lugar do antigo mascote). Cada guia tem 12 expressões,
// guardadas numa imagem só (sprite) de 4 colunas por 3 linhas, na ordem de EXPRESSOES.
// A pessoa escolhe um guia pronto ou cria o seu: leva o PEDIDO_GUIA para uma IA que cria imagens, junto com a foto
// do personagem que quer, recebe dois mosaicos de 3 × 2 e envia ao PGC, que acha e recorta cada quadro.
// Funções puras (sem tela): o recorte em si, com canvas, fica em app/components/guia/CriarGuia.vue.

export const EXPRESSOES = [
  { id: 'neutro', nome: 'Neutro', quando: 'calmo, atento' },
  { id: 'feliz', nome: 'Feliz', quando: 'boas-vindas' },
  { id: 'curioso', nome: 'Curioso', quando: 'uma pergunta' },
  { id: 'pensativo', nome: 'Pensativo', quando: 'pensando numa resposta' },
  { id: 'surpreso', nome: 'Surpreso', quando: 'uma descoberta' },
  { id: 'empolgado', nome: 'Empolgado', quando: 'algo novo para conhecer' },
  { id: 'explicativo', nome: 'Explicativo', quando: 'explicando' },
  { id: 'confuso', nome: 'Confuso', quando: 'deu erro' },
  { id: 'acolhedor', nome: 'Acolhedor', quando: 'apoio' },
  { id: 'encorajador', nome: 'Encorajador', quando: 'você consegue' },
  { id: 'orgulhoso', nome: 'Orgulhoso', quando: 'deu certo' },
  { id: 'comemorativo', nome: 'Comemorativo', quando: 'terminou' },
]
// Nomes antigos do mascote, para as telas que ainda usam.
const ANTIGOS = { normal: 'neutro', acenando: 'feliz', pensando: 'pensativo', comemorando: 'comemorativo', dormindo: 'acolhedor' }
export const COLUNAS_SPRITE = 4
export const LINHAS_SPRITE = 3
export const LADO_QUADRO = 256

export function indiceDaExpressao(humor) {
  const id = ANTIGOS[humor] ?? humor
  return Math.max(0, EXPRESSOES.findIndex((e) => e.id === id))
}
// Posição do quadro no sprite, para background-position (com background-size 400% 300%).
export function posicaoNoSprite(humor) {
  const i = indiceDaExpressao(humor)
  return `${((i % COLUNAS_SPRITE) * 100) / (COLUNAS_SPRITE - 1)}% ${(Math.floor(i / COLUNAS_SPRITE) * 100) / (LINHAS_SPRITE - 1)}%`
}

// Guias prontos (arquivos em public/guias), feitos pelo R com o pedido do PGC (12/10). O primeiro é o padrão de quem
// ainda não escolheu. O nome é o de costume: a pessoa pode dar outro a qualquer guia (perfis.guia_nome).
// O id "gato" ficou do primeiro guia (o Bartolomeu), para não mudar o que já está salvo nos perfis.
export const GUIAS_PRONTOS = [
  { id: 'gato', nome: 'Bartolomeu', arquivo: '/guias/gato.webp' },
  { id: 'admin', nome: 'Admin', arquivo: '/guias/admin.webp' },
  { id: 'alfred', nome: 'Alfred', arquivo: '/guias/alfred.webp' },
  { id: 'ford', nome: 'Ford', arquivo: '/guias/ford.webp' },
  { id: 'gerente', nome: 'Gerente', arquivo: '/guias/gerente.webp' },
  { id: 'jack', nome: 'Jack', arquivo: '/guias/jack.webp' },
  { id: 'john', nome: 'John', arquivo: '/guias/john.webp' },
  { id: 'tom', nome: 'Tom', arquivo: '/guias/tom.webp' },
]
export const GUIA_PADRAO = GUIAS_PRONTOS[0].id
export const NOME_GUIA_MAX = 30
export const nomeDeGuiaValido = (nome) => !nome || (String(nome).trim().length >= 1 && String(nome).trim().length <= NOME_GUIA_MAX)

// O que a tela mostra a partir do perfil: { tipo: 'pronto' | 'proprio', id, nome, arquivo, nomeDado }.
// nomeDado: o nome que a pessoa deu (ou null, quando vale o nome de costume).
export function guiaDoPerfil(perfil) {
  const nomeDado = perfil?.guia_nome?.trim() || null
  if (perfil?.guia === 'proprio') return { tipo: 'proprio', id: 'proprio', nome: nomeDado || 'Seu guia', arquivo: null, nomeDado }
  const pronto = GUIAS_PRONTOS.find((g) => g.id === perfil?.guia) ?? GUIAS_PRONTOS[0]
  return { tipo: 'pronto', id: pronto.id, nome: nomeDado || pronto.nome, arquivo: pronto.arquivo, nomeDado }
}
export const nomePadraoDoGuia = (id) => (id === 'proprio' ? '' : (GUIAS_PRONTOS.find((g) => g.id === id) ?? GUIAS_PRONTOS[0]).nome)
// Nome para guardar: vazio ou igual ao de costume vira null (assim, se o nome de costume mudar, a pessoa acompanha).
export function nomeParaGuardar(id, nome) {
  const t = String(nome ?? '').trim().slice(0, NOME_GUIA_MAX)
  return !t || t === nomePadraoDoGuia(id) ? null : t
}

// ---------- Achar os 6 quadros de um mosaico 3 × 2 ----------
const OPACO = 24

// Corte entre colunas (ou linhas): perto da posição esperada, a faixa com menos pixels do personagem. Numa faixa
// vazia larga, fica no meio dela.
function corte(perfil, total, k, partes) {
  const alvo = Math.round((total * k) / partes)
  const raio = Math.round(total * 0.08)
  const ini = Math.max(1, alvo - raio)
  const fim = Math.min(total - 2, alvo + raio)
  let menor = Infinity
  for (let p = ini; p <= fim; p++) menor = Math.min(menor, perfil[p])
  const tolerancia = Math.max(0, Math.floor(menor * 0.05))
  let melhor = alvo
  let melhorDist = Infinity
  for (let p = ini; p <= fim; p++) {
    if (perfil[p] > menor + tolerancia) continue
    let q = p
    while (q + 1 <= fim && perfil[q + 1] <= menor + tolerancia) q++
    const meio = Math.round((p + q) / 2)
    const dist = Math.abs(meio - alvo) - (q - p) * 0.25
    if (dist < melhorDist) {
      melhorDist = dist
      melhor = meio
    }
    p = q
  }
  return melhor
}

// alfa: opacidade de cada pixel (largura × altura, linha por linha). Devolve { quadros, lado } ou { erro }.
// quadros: 6 itens na ordem de leitura (linha de cima da esquerda para a direita, depois a de baixo), cada um com
// a célula e o recorte quadrado (x, y, lado), do mesmo tamanho para todos e apoiado embaixo, para o personagem não
// mudar de tamanho nem pular de uma expressão para outra.
export function acharQuadros(alfa, largura, altura, { colunas = 3, linhas = 2 } = {}) {
  const proporcao = largura / altura
  if (Math.abs(proporcao - colunas / linhas) > 0.25) return { erro: 'proporcao' }
  const porColuna = new Uint32Array(largura)
  const porLinha = new Uint32Array(altura)
  for (let y = 0; y < altura; y++) {
    const base = y * largura
    for (let x = 0; x < largura; x++) {
      if (alfa[base + x] > OPACO) {
        porColuna[x]++
        porLinha[y]++
      }
    }
  }
  const xs = [0, ...Array.from({ length: colunas - 1 }, (_, k) => corte(porColuna, largura, k + 1, colunas)), largura]
  const ys = [0, ...Array.from({ length: linhas - 1 }, (_, k) => corte(porLinha, altura, k + 1, linhas)), altura]
  const quadros = []
  for (let l = 0; l < linhas; l++) {
    for (let c = 0; c < colunas; c++) {
      const celula = { x0: xs[c], y0: ys[l], x1: xs[c + 1], y1: ys[l + 1] }
      let bx0 = Infinity
      let by0 = Infinity
      let bx1 = -1
      let by1 = -1
      let n = 0
      for (let y = celula.y0; y < celula.y1; y++) {
        const base = y * largura
        for (let x = celula.x0; x < celula.x1; x++) {
          if (alfa[base + x] > OPACO) {
            n++
            if (x < bx0) bx0 = x
            if (x > bx1) bx1 = x
            if (y < by0) by0 = y
            if (y > by1) by1 = y
          }
        }
      }
      const area = (celula.x1 - celula.x0) * (celula.y1 - celula.y0)
      if (n < area * 0.02) return { erro: 'vazio', quadro: quadros.length + 1 }
      quadros.push({ celula, caixa: { x0: bx0, y0: by0, x1: bx1 + 1, y1: by1 + 1 } })
    }
  }
  const lado = Math.ceil(Math.max(...quadros.map((q) => Math.max(q.caixa.x1 - q.caixa.x0, q.caixa.y1 - q.caixa.y0))) * 1.04)
  for (const q of quadros) {
    const meioX = (q.caixa.x0 + q.caixa.x1) / 2
    q.recorte = { x: Math.round(meioX - lado / 2), y: Math.round(q.caixa.y1 - lado + lado * 0.02), lado }
  }
  return { quadros, lado }
}

// Os dois mosaicos de um guia podem vir com o personagem um pouco maior num deles. Com o mesmo lado nos 12
// recortes (o maior dos dois), o guia fica do mesmo tamanho em todas as expressões.
export function unificarLado(achados) {
  const lado = Math.max(...achados.map((a) => a.lado))
  return achados.map((a) => ({
    lado,
    quadros: a.quadros.map((q) => ({
      ...q,
      recorte: { x: Math.round((q.caixa.x0 + q.caixa.x1) / 2 - lado / 2), y: Math.round(q.caixa.y1 - lado + lado * 0.02), lado },
    })),
  }))
}

// Ordem dos dois arquivos: o último número do nome diz qual é qual (…-1.png é o primeiro, …-2.png o segundo;
// bloco_01-06 vem antes de bloco_07-12). Sem número, fica a ordem em que foram escolhidos.
export function ordemDosMosaicos(nomes) {
  const ultimo = (nome) => {
    const achado = String(nome).replace(/\.[a-z0-9]+$/i, '').match(/(\d+)\D*$/)
    return achado ? Number(achado[1]) : null
  }
  const numeros = nomes.map(ultimo)
  if (numeros.some((n) => n === null) || new Set(numeros).size !== numeros.length) return nomes.map((_, i) => i)
  return nomes.map((_, i) => i).sort((a, b) => numeros[a] - numeros[b])
}

// ---------- Fundo ----------
// Quando a IA não deixa o fundo transparente: se os 4 cantos têm a mesma cor, apaga essa cor a partir das bordas
// (só o que encosta na borda, para não furar o personagem). rgba: Uint8ClampedArray da imagem, alterado aqui.
// Devolve true se tirou o fundo.
export function temTransparencia(rgba) {
  for (let i = 3; i < rgba.length; i += 4) if (rgba[i] < 250) return true
  return false
}
export function tirarFundo(rgba, largura, altura, tolerancia = 38) {
  const canto = (x, y) => {
    const i = (y * largura + x) * 4
    return [rgba[i], rgba[i + 1], rgba[i + 2]]
  }
  const cantos = [canto(0, 0), canto(largura - 1, 0), canto(0, altura - 1), canto(largura - 1, altura - 1)]
  const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2])
  if (cantos.some((c) => dist(c, cantos[0]) > tolerancia)) return false
  const fundo = cantos[0]
  const visto = new Uint8Array(largura * altura)
  const fila = new Uint32Array(largura * altura)
  let ini = 0
  let fim = 0
  const parecido = (p) => {
    const i = p * 4
    return Math.hypot(rgba[i] - fundo[0], rgba[i + 1] - fundo[1], rgba[i + 2] - fundo[2]) <= tolerancia
  }
  const colocar = (p) => {
    if (!visto[p] && parecido(p)) {
      visto[p] = 1
      fila[fim++] = p
    }
  }
  for (let x = 0; x < largura; x++) {
    colocar(x)
    colocar((altura - 1) * largura + x)
  }
  for (let y = 0; y < altura; y++) {
    colocar(y * largura)
    colocar(y * largura + largura - 1)
  }
  while (ini < fim) {
    const p = fila[ini++]
    rgba[p * 4 + 3] = 0
    const x = p % largura
    if (x > 0) colocar(p - 1)
    if (x < largura - 1) colocar(p + 1)
    if (p >= largura) colocar(p - largura)
    if (p < (altura - 1) * largura) colocar(p + largura)
  }
  return true
}

export const ERROS_MOSAICO = {
  proporcao: 'Essa imagem não tem o formato do mosaico (3 quadros na largura e 2 na altura). Confira se enviou o arquivo que a IA criou.',
  vazio: 'Um dos quadros está vazio. Peça para a IA gerar o mosaico de novo, com os 6 quadros preenchidos.',
  fundo: 'A imagem veio com fundo, e o PGC não conseguiu tirar sozinho. Peça para a IA gerar de novo, com fundo transparente.',
  tipo: 'Envie as imagens em PNG ou WebP (o formato que a IA entrega).',
}

// O pedido que a pessoa leva para a IA que cria imagens, junto com a imagem do personagem (texto do R, 12/10).
export const PEDIDO_GUIA = `Use a imagem de referência anexada como identidade visual. Esta tarefa deve produzir EXATAMENTE DUAS IMAGENS PNG FINAIS, separadas: uma para as expressões 01–06 e outra para as expressões 07–12. Cada imagem deve ser um mosaico uniforme de 3 colunas × 2 linhas. Não produza uma imagem única com os 12 quadros e não produza 12 arquivos separados.

O ChatGPT deve fazer EXATAMENTE UMA ÚNICA chamada à ferramenta nativa de geração de imagens, solicitando dois resultados separados na mesma chamada (use quantidade igual a 2, se houver esse parâmetro). O resultado 1 deve ser o arquivo \`bloco_01-06_mosaico.png\`; o resultado 2 deve ser o arquivo \`bloco_07-12_mosaico.png\`. Cada resultado é um PNG independente com seu próprio mosaico 3 × 2. Não faça uma segunda chamada, não peça ao usuário que envie os blocos separadamente e não una os dois mosaicos em uma única imagem. Se a ferramenta não puder devolver dois arquivos separados numa só chamada, informe essa limitação em vez de trocar para duas chamadas ou criar uma única grade com 12 quadros.

RESTRIÇÃO DE FERRAMENTA

Use somente a ferramenta nativa de geração de imagens estáticas do ChatGPT. Não abra nem use Runway ou qualquer aplicativo/serviço externo. Não gere vídeo, animação, clipe ou movimento. Se a ferramenta nativa não estiver disponível, informe a limitação e pare; não troque para outro serviço.

IDENTIDADE E ESTILO — OBRIGATÓRIO NOS DOIS MOSAICOS

- Preserve o mesmo personagem da referência: identidade, cores, textura, materiais, anatomia/estrutura, proporções e estilo artístico.
- Preserve o enquadramento da referência em todos os seis quadros. Não invente partes do corpo, não afaste a câmera e não revele áreas ausentes na referência.
- Mude somente os recursos expressivos necessários para comunicar a emoção de cada quadro.
- Mantenha escala, posição, direção e enquadramento consistentes entre os seis quadros de cada mosaico.
- Cada quadro contém uma única representação do personagem e uma única expressão.
- Sem texto, rótulos, números visíveis, molduras desenhadas, cenário, objetos decorativos, duplicatas ou elementos que invadam outro quadro.

LAYOUT E ESPECIFICAÇÕES PARA RECORTE AUTOMÁTICO

Cada mosaico deve ter exatamente 3 colunas e 2 linhas, com células quadradas iguais. A ordem é obrigatoriamente por linhas: primeiro a linha superior da esquerda para a direita; depois a linha inferior da esquerda para a direita. Nunca ordene da direita para a esquerda. A sequência começa no canto superior esquerdo e termina no canto inferior direito.

Tamanho-alvo do arquivo: 1536 × 1024 pixels, proporção 3:2. Limite máximo: 3072 × 2048 pixels. Não ultrapasse esse limite nem aumente artificialmente a resolução. Gere PNG com qualidade alta e bordas nítidas.

No tamanho-alvo de 1536 × 1024 px, use exatamente esta geometria:
- Células: 480 × 480 px cada.
- Margens externas: 16 px em todos os lados.
- Espaço vazio entre colunas: 32 px.
- Espaço vazio entre linhas: 32 px.
- Inícios das células no eixo X: 16 px, 528 px e 1040 px.
- Inícios das células no eixo Y: 16 px e 528 px.

Se o arquivo for gerado em outra resolução dentro do limite, mantenha rigorosamente as mesmas proporções relativas da grade; não distorça as células quadradas. Preserve os espaços entre os quadros e a margem externa. A imagem inteira deve ter fundo VERDADEIRAMENTE TRANSPARENTE: canal alfa real nas áreas fora do personagem, inclusive dentro de cada célula, nas margens e nos espaços entre células. Somente os pixels do personagem podem ser opacos. Não use fundo branco, preto, colorido, gradiente, cenário, sombra, brilho, quadriculado ou qualquer preenchimento atrás dos personagens. Não simule transparência. Se a ferramenta não conseguir produzir PNG com transparência real, não entregue uma imagem com fundo; informe que essa capacidade não está disponível.

Mantenha o personagem inteiramente dentro de sua própria célula, com uma margem de segurança interna equivalente a pelo menos 8% do lado da célula. Nenhuma orelha, pelo, bigode, sombra ou outra parte pode tocar ou cruzar o limite da célula, o espaço entre células ou o quadro vizinho. Os espaços vazios entre as células precisam permanecer limpos para que um sistema possa recortar cada quadrado sem capturar partes de outra expressão.

BLOCO 1 — PRIMEIRO MOSAICO — ARQUIVO: bloco_01-06_mosaico.png

Linha 1, da esquerda para a direita:
1. 01 — idle (Neutro): expressão calma, natural, relaxada e moderadamente atenta.
2. 02 — welcome (Feliz): expressão amigável, simpática e receptiva; felicidade perceptível sem exagero.
3. 03 — question (Curioso): expressão de interesse e questionamento, transmitindo curiosidade.

Linha 2, da esquerda para a direita:
4. 04 — thinking (Pensativo): expressão de concentração e reflexão, como se estivesse pensando em uma resposta; sem adicionar membros ou objetos.
5. 05 — discovery (Surpreso): surpresa positiva diante de uma descoberta inesperada, sem parecer assustado.
6. 06 — featureIntro (Empolgado): entusiasmo e animação claramente mais energéticos que a expressão feliz; sem inventar gestos corporais.

BLOCO 2 — SEGUNDO MOSAICO — ARQUIVO: bloco_07-12_mosaico.png

Linha 1, da esquerda para a direita:
7. 07 — instruction (Explicativo): expressão atenta, segura e comunicativa, como se estivesse explicando uma informação; sem braços ou objetos apontando.
8. 08 — error (Confuso): dúvida e dificuldade de compreensão, claramente diferente da curiosidade.
9. 09 — support (Acolhedor): expressão gentil, tranquila e compreensiva, transmitindo acolhimento e segurança.

Linha 2, da esquerda para a direita:
10. 10 — encouragement (Encorajador): motivação, confiança e otimismo; deve transmitir “Você consegue!”.
11. 11 — success (Orgulhoso): satisfação e realização, orgulho positivo sem arrogância.
12. 12 — completed (Comemorativo): grande alegria por uma tarefa concluída, mais intensa que a expressão orgulhosa; sem confetes ou acessórios.

VALIDAÇÃO ANTES DA ENTREGA

Confira cada mosaico antes de entregá-lo:
- Há exatamente 6 células quadradas, em uma grade regular de 3 colunas × 2 linhas?
- A ordem segue a leitura por linhas: superior esquerda → direita; depois inferior esquerda → direita?
- Cada célula contém um único personagem com a emoção correta?
- Nenhuma parte do personagem invade a célula vizinha ou a área de recorte?
- O enquadramento e a identidade do personagem foram preservados?
- O tamanho está dentro do limite e o PNG está íntegro?

Se um mosaico estiver incorreto, regenere somente aquele mosaico. Não tente corrigir criando uma grade irregular ou acrescentando mais quadros. Não declare a tarefa concluída sem entregar os dois arquivos PNG independentes. Se a ferramenta não conseguir respeitar a grade ou as especificações, informe o que falhou em vez de apresentar um resultado incompatível como concluído.

ENTREGA

Entregue exatamente estes dois arquivos PNG, com os nomes indicados:
- \`bloco_01-06_mosaico.png\`
- \`bloco_07-12_mosaico.png\`

Se possível, entregue também um ZIP contendo os dois PNGs com esses mesmos nomes. Os nomes devem estar nos arquivos, nunca escritos dentro das imagens.`
