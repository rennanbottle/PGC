// Matérias e assuntos da pessoa logada, com as ações de criar, editar, arquivar, excluir e reordenar.
// Uma busca só (chave "materias"), compartilhada entre lista, página da matéria, busca geral e estatísticas.
// Cada ação grava no banco e recarrega a lista; o banco (RLS) garante que só mexe no que é da pessoa.
// Erros viram mensagens em português (exceção com .message pronta para mostrar na tela).
// useNumerosMaterias(): questões, questões no banco, estado de cada assunto e revisões de hoje, por matéria e por assunto.
import { Briefcase, BookText, Code, Cog, FlaskConical, HeartPulse, Landmark, Languages, Palette, Scale, Shapes, Sigma } from '@lucide/vue'
import { AREAS_MATERIA } from '#shared/regras/materias.js'

// Ícone de cada área (listas de escolha e linhas de matéria).
export const ICONES_AREA = {
  matematica: Sigma,
  natureza: FlaskConical,
  humanas: Landmark,
  portugues: BookText,
  idiomas: Languages,
  programacao: Code,
  exatas: Cog,
  saude: HeartPulse,
  direito: Scale,
  negocios: Briefcase,
  artes: Palette,
  outra: Shapes,
}
export const OPCOES_AREA = AREAS_MATERIA.map((a) => ({ valor: a.id, texto: a.nome, icone: ICONES_AREA[a.id] }))

function traduzir(erro, alvo) {
  if (erro.code === '23505') return alvo === 'assunto' ? 'Já existe um assunto com esse nome nesta matéria.' : 'Você já tem uma matéria com esse nome.'
  if (erro.code === 'P0001') return erro.message
  if (erro.code === '23503') return 'A matéria escolhida não existe mais. Recarregue a página.'
  if (erro.code === '23514') return 'Algum valor não foi aceito. Confira os campos.'
  return 'Não deu para salvar agora. Confira a internet e tente de novo.'
}

export function useMaterias() {
  const supabase = useSupabaseClient()
  const usuario = useSupabaseUser()

  const consulta = useAsyncData(
    'materias',
    async () => {
      if (!usuario.value) return []
      const { data, error } = await supabase
        .from('materias')
        .select('id, nome, area, cor, descricao, ordem, arquivada_em, criado_em, atualizado_em, assuntos(id, nome, ordem, arquivado_em, criado_em, atualizado_em)')
        .order('ordem')
        .order('ordem', { referencedTable: 'assuntos' })
      if (error) throw error
      return data
    },
    { watch: [() => usuario.value?.sub], default: () => [] },
  )

  const recarregar = () => refreshNuxtData('materias')

  async function executar(pedido, alvo = 'materia') {
    const { data, error } = await pedido
    if (error) throw new Error(traduzir(error, alvo))
    return data
  }

  async function criarMateria({ nome, area, cor, assuntos = [] }) {
    const materia = await executar(supabase.from('materias').insert({ nome: nome.trim(), area, cor }).select('id').single())
    if (assuntos.length) {
      await executar(
        supabase.from('assuntos').insert(assuntos.map((n, i) => ({ materia_id: materia.id, nome: n, ordem: i + 1 }))),
        'assunto',
      )
    }
    await recarregar()
    return materia.id
  }

  async function atualizarMateria(id, campos) {
    await executar(supabase.from('materias').update(campos).eq('id', id))
    await recarregar()
  }

  const arquivarMateria = (id, arquivar = true) => atualizarMateria(id, { arquivada_em: arquivar ? new Date().toISOString() : null })

  // Os arquivos (materiais, bancos importados e imagens de questões) ficam no Storage, fora do banco:
  // saem antes, senão ficariam soltos lá.
  async function excluirMateria(id) {
    const [materiais, bancos, imagens] = await Promise.all([
      supabase.from('materiais').select('arquivo_caminho').eq('materia_id', id).not('arquivo_caminho', 'is', null),
      supabase.from('bancos_importados').select('arquivo_caminho').eq('materia_id', id).not('arquivo_caminho', 'is', null),
      supabase.from('questoes').select('imagem_caminho').eq('materia_id', id).not('imagem_caminho', 'is', null),
    ])
    const remover = async (bucket, linhas, coluna) => {
      const caminhos = (linhas ?? []).map((l) => l[coluna])
      if (caminhos.length) await supabase.storage.from(bucket).remove(caminhos)
    }
    await remover('materiais', materiais.data, 'arquivo_caminho')
    await remover('bancos', bancos.data, 'arquivo_caminho')
    await remover('questoes', imagens.data, 'imagem_caminho')
    await executar(supabase.from('materias').delete().eq('id', id))
    await recarregar()
    refreshNuxtData(['materiais', 'bancos', 'questoes-resumo', 'questoes-lista'])
  }

  async function reordenarMaterias(ids) {
    await executar(supabase.rpc('reordenar_materias', { ids }))
    await recarregar()
  }

  async function criarAssunto(materiaId, nome) {
    await executar(supabase.from('assuntos').insert({ materia_id: materiaId, nome: nome.trim() }), 'assunto')
    await recarregar()
  }

  // Vários de uma vez (sugestões do catálogo), sempre no fim da lista.
  async function criarAssuntos(materiaId, nomes) {
    const materia = (consulta.data.value ?? []).find((m) => m.id === materiaId)
    const ultima = Math.max(0, ...(materia?.assuntos ?? []).map((a) => a.ordem ?? 0))
    await executar(
      supabase.from('assuntos').insert(nomes.map((n, i) => ({ materia_id: materiaId, nome: n.trim(), ordem: ultima + i + 1 }))),
      'assunto',
    )
    await recarregar()
  }

  async function atualizarAssunto(id, campos) {
    await executar(supabase.from('assuntos').update(campos).eq('id', id), 'assunto')
    await recarregar()
  }

  const arquivarAssunto = (id, arquivar = true) => atualizarAssunto(id, { arquivado_em: arquivar ? new Date().toISOString() : null })

  async function excluirAssunto(id) {
    await executar(supabase.from('assuntos').delete().eq('id', id), 'assunto')
    await recarregar()
  }

  async function reordenarAssuntos(materiaId, ids) {
    await executar(supabase.rpc('reordenar_assuntos', { materia: materiaId, ids }), 'assunto')
    await recarregar()
  }

  return {
    data: consulta.data,
    pending: consulta.pending,
    error: consulta.error,
    pronto: consulta,
    recarregar,
    criarMateria,
    atualizarMateria,
    arquivarMateria,
    excluirMateria,
    reordenarMaterias,
    criarAssunto,
    criarAssuntos,
    atualizarAssunto,
    arquivarAssunto,
    excluirAssunto,
    reordenarAssuntos,
  }
}

// Dia de hoje no horário de Brasília (AAAA-MM-DD).
const hojeEmBrasilia = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())

// Números de cada matéria, assunto e texto: questões (sem as arquivadas), questões no banco de estudo,
// estado do assunto (proficiencias) e questões que vencem hoje (agenda_revisoes conta as atrasadas hoje).
export function useNumerosMaterias() {
  const supabase = useSupabaseClient()
  const usuario = useSupabaseUser()
  const vazio = () => ({ porMateria: {}, porAssunto: {}, porTexto: {}, estados: {} })
  return useAsyncData(
    'materias-numeros',
    async () => {
      if (!usuario.value) return vazio()
      const hoje = hojeEmBrasilia()
      const [questoes, profs, revisoes] = await Promise.all([
        supabase.from('questoes').select('materia_id, assunto_id, material_id, em_revisao').neq('status', 'arquivada').limit(10000),
        supabase.from('proficiencias').select('assunto_id, estado, proficiencia'),
        supabase.rpc('agenda_revisoes', { p_inicio: hoje, p_fim: hoje }),
      ])
      const saida = vazio()
      const somar = (mapa, id, q) => {
        if (!id) return
        const n = (mapa[id] ??= { questoes: 0, noBanco: 0, vencidas: 0 })
        n.questoes++
        if (q.em_revisao) n.noBanco++
      }
      for (const q of questoes.data ?? []) {
        somar(saida.porMateria, q.materia_id, q)
        somar(saida.porAssunto, q.assunto_id, q)
        somar(saida.porTexto, q.material_id, q)
      }
      for (const p of profs.data ?? []) saida.estados[p.assunto_id] = { estado: p.estado, proficiencia: p.proficiencia }
      for (const dia of revisoes.data ?? []) {
        for (const { materia_id: id, n } of dia.materias ?? []) {
          const m = (saida.porMateria[id] ??= { questoes: 0, noBanco: 0, vencidas: 0 })
          m.vencidas += n
        }
      }
      return saida
    },
    { watch: [() => usuario.value?.sub], default: vazio },
  )
}
