// Questões da pessoa logada: resumo do banco, ações em uma ou várias questões e imagem da questão.
// A lista em si é montada na tela (filtros e "mostrar mais" pedem ao banco só o que aparece).
// Erros viram mensagens em português (exceção com .message pronta para mostrar).

import { ArrowDownUp, CalendarClock, CircleCheck, Combine, FileText, Hash, Layers, LayoutGrid, Lightbulb, Link2, ListChecks, ListTodo, MessageSquareText, PenLine, SearchX, SquareCheck, TextCursorInput, ToggleLeft } from '@lucide/vue'

// Ícone de cada tipo de questão (e das técnicas que tiram questões do texto). Usado por <QuestoesIconeTipo> e nas
// opções de <Selecao> (que recebem o componente do ícone). Sempre com o nome do tipo ao lado.
export const ICONES_TIPO = {
  multipla_escolha: ListChecks,
  multipla_resposta: ListTodo,
  verdadeiro_falso: ToggleLeft,
  certo_errado: CircleCheck,
  assercao_razao: Link2,
  texto_base: FileText,
  numerica: Hash,
  lacuna_digitada: TextCursorInput,
  lacuna_opcoes: SquareCheck,
  encontrar_erro: SearchX,
  prever_resultado: Lightbulb,
  cartao: Layers,
  associar: Combine,
  ordenar: ArrowDownUp,
  classificar: LayoutGrid,
  resposta_curta: PenLine,
  explicar: MessageSquareText,
  lacuna: TextCursorInput,
  cronologia: CalendarClock,
}

const COLUNAS = 'id, materia_id, assunto_id, material_id, trecho_id, banco_id, tipo, nivel, bloom, enunciado, conteudo, explicacao, fonte, origem, status, gabarito_confirmado, resolver_comparar, qualidade_aprovada, avisos_qualidade, precisa_imagem, imagem_caminho, material_mudou, numero_original, trecho_original, em_revisao, criado_em, atualizado_em'
export const COLUNAS_QUESTAO = COLUNAS

function traduzir(erro) {
  if (erro?.code === 'P0001') return erro.message
  if (erro?.code === '23503') return 'A matéria ou o assunto escolhido não existe mais. Recarregue a página.'
  if (erro?.code === '23514') return 'Algum valor não foi aceito. Confira os campos.'
  return 'Não deu para salvar agora. Confira a internet e tente de novo.'
}

export const RESUMO_VAZIO = { total: 0, em_revisao: 0, rascunhos: 0, arquivadas: 0, fora: { gabarito: 0, qualidade: 0, imagem: 0, material: 0 }, por_nivel: [0, 0, 0, 0, 0], por_tipo: {}, semana_origem: {}, dias: Array(14).fill(0) }

// Resumo do banco (uma consulta só no servidor): totais, motivos de estar fora das revisões, nível, tipo e dias.
export function useResumoQuestoes() {
  const supabase = useSupabaseClient()
  const usuario = useSupabaseUser()
  return useAsyncData('questoes-resumo', async () => {
    if (!usuario.value) return RESUMO_VAZIO
    const { data, error } = await supabase.rpc('resumo_questoes')
    if (error) throw error
    return { ...RESUMO_VAZIO, ...data }
  }, { watch: [() => usuario.value?.sub], default: () => RESUMO_VAZIO })
}

export function useQuestoes() {
  const supabase = useSupabaseClient()
  const usuario = useSupabaseUser()

  // Depois de qualquer mudança: resumo, lista da tela e estatísticas.
  function recarregar() {
    refreshNuxtData(['questoes-resumo', 'questoes-lista', 'bancos'])
  }

  async function executar(pedido) {
    const { data, error } = await pedido
    if (error) throw new Error(traduzir(error))
    return data
  }

  async function criar(campos) {
    const q = await executar(supabase.from('questoes').insert(campos).select('id').single())
    recarregar()
    return q.id
  }

  async function atualizar(id, campos) {
    await executar(supabase.from('questoes').update(campos).eq('id', id))
    recarregar()
    refreshNuxtData(`questao-${id}`)
  }

  async function atualizarVarias(ids, campos) {
    if (!ids.length) return
    await executar(supabase.from('questoes').update(campos).in('id', ids))
    recarregar()
  }

  const arquivar = (ids, sim = true) => atualizarVarias(ids, { status: sim ? 'arquivada' : 'ativa' })

  async function excluir(ids) {
    if (!ids.length) return
    const { data: comImagem } = await supabase.from('questoes').select('imagem_caminho').in('id', ids).not('imagem_caminho', 'is', null)
    const caminhos = (comImagem ?? []).map((q) => q.imagem_caminho)
    if (caminhos.length) await supabase.storage.from('questoes').remove(caminhos)
    await executar(supabase.from('questoes').delete().in('id', ids))
    recarregar()
  }

  // Cópia como questão "minha": sem ligação com o material ou com o banco importado.
  async function duplicar(id) {
    const q = await executar(supabase.from('questoes').select(COLUNAS).eq('id', id).single())
    return criar({
      materia_id: q.materia_id,
      assunto_id: q.assunto_id,
      tipo: q.tipo,
      nivel: q.nivel,
      bloom: q.bloom,
      enunciado: q.enunciado,
      conteudo: q.conteudo,
      explicacao: q.explicacao,
      fonte: q.fonte,
      origem: 'minha',
      qualidade_aprovada: q.qualidade_aprovada,
      avisos_qualidade: q.avisos_qualidade,
      gabarito_confirmado: q.gabarito_confirmado,
      resolver_comparar: q.resolver_comparar,
      precisa_imagem: q.precisa_imagem && !q.imagem_caminho,
    })
  }

  // Imagem da questão: reduzida no navegador e guardada no bucket privado, na pasta da pessoa.
  async function enviarImagem(id, blob) {
    const caminho = `${usuario.value.sub}/${id}/imagem.jpg`
    const { error } = await supabase.storage.from('questoes').upload(caminho, blob, { contentType: 'image/jpeg', upsert: true })
    if (error) throw new Error('Não deu para enviar a imagem. Tente de novo.')
    await atualizar(id, { imagem_caminho: caminho })
    return caminho
  }

  async function tirarImagem(id, caminho) {
    if (caminho) await supabase.storage.from('questoes').remove([caminho])
    await atualizar(id, { imagem_caminho: null })
  }

  // Baixa a imagem e devolve como "data:" (a política de segurança do site só libera imagens do próprio site e data:).
  async function imagemParaMostrar(caminho) {
    if (!caminho) return ''
    const { data, error } = await supabase.storage.from('questoes').download(caminho)
    if (error || !data) return ''
    return blobParaDataUrl(data)
  }

  return { recarregar, criar, atualizar, atualizarVarias, arquivar, excluir, duplicar, enviarImagem, tirarImagem, imagemParaMostrar }
}

// Uma questão (editor).
export function useQuestao(id) {
  const supabase = useSupabaseClient()
  return useAsyncData(`questao-${id}`, async () => {
    if (!id) return null
    const { data, error } = await supabase.from('questoes').select(COLUNAS).eq('id', id).maybeSingle()
    if (error) throw error
    return data
  })
}
