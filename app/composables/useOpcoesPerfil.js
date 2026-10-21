// Opções do perfil já no formato da <Selecao> (valor, texto, descricao, icone): objetivo, áreas e ritmo.
// Usadas no cadastro e na tela de perfil. Os valores são os mesmos que o banco confere.
import {
  BookOpenText, Briefcase, CodeXml, Coffee, Compass, Flame, FlaskConical, Footprints, Globe, GraduationCap, HeartPulse,
  Landmark, Languages, NotebookPen, Palette, Ruler, Scale, School, Sigma, Target, Wrench,
} from '@lucide/vue'
import { AREAS, OBJETIVOS, RESUMOS_RITMO } from '#shared/regras/perfil.js'
import { RITMOS } from '#shared/regras/ritmo.js'

const ICONES_OBJETIVO = {
  enem: NotebookPen,
  vestibular: School,
  concurso: Landmark,
  faculdade: GraduationCap,
  curso_tecnico: Wrench,
  por_conta_propria: Compass,
}
const ICONES_AREA = {
  matematica: Sigma,
  natureza: FlaskConical,
  humanas: Globe,
  portugues: BookOpenText,
  idiomas: Languages,
  programacao: CodeXml,
  exatas: Ruler,
  saude: HeartPulse,
  direito: Scale,
  negocios: Briefcase,
  artes: Palette,
}

const ICONES_RITMO = { tranquilo: Coffee, normal: Footprints, focado: Target, obcecado: Flame }

export function useOpcoesPerfil() {
  return {
    // '' = ainda não decidiu (vai para o banco como null).
    objetivos: [
      { valor: '', texto: 'Ainda não decidi' },
      ...OBJETIVOS.map((o) => ({ valor: o.id, texto: o.nome, icone: ICONES_OBJETIVO[o.id] })),
    ],
    areas: AREAS.map((a) => ({ valor: a.id, texto: a.nome, icone: ICONES_AREA[a.id] })),
    ritmos: Object.entries(RITMOS).map(([id, r]) => ({
      valor: id,
      texto: r.nome,
      resumo: RESUMOS_RITMO[id],
      meta: r.metaDiariaQuestoes,
      icone: ICONES_RITMO[id],
      descricao: `${RESUMOS_RITMO[id]} ${r.metaDiariaQuestoes} questões por dia.`,
    })),
  }
}
