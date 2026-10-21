// Guia do guia: o balão com as dicas da tela e o passeio que acende cada parte dela.
// O que fica salvo neste navegador: as telas cujo passeio a pessoa já viu, se o guia está escondido e o jeito do
// passeio no computador ("balao": balão perto da parte acesa, com o guia por cima; "painel": painel de conversa
// embaixo). No celular o passeio é sempre o painel.
import { passeioDaRota } from '#shared/regras/guia.js'

const CHAVE = 'pgc-guia'

export function useGuia() {
  const estado = useState('pgc-guia', () => ({ balao: false, convite: false, passeio: null, passo: 0, escondido: false, vistos: {}, estilo: 'balao', carregado: false }))
  const route = useRoute()
  const atual = computed(() => passeioDaRota(route.path))

  function carregar() {
    if (estado.value.carregado) return
    try {
      const salvo = JSON.parse(localStorage.getItem(CHAVE) || '{}')
      estado.value.escondido = !!salvo.escondido
      estado.value.vistos = salvo.vistos && typeof salvo.vistos === 'object' ? salvo.vistos : {}
      estado.value.estilo = salvo.estilo === 'painel' ? 'painel' : 'balao'
    }
    catch {
      // Sem acesso ao armazenamento: o guia funciona, só não lembra.
    }
    estado.value.carregado = true
  }
  function salvar() {
    try {
      localStorage.setItem(CHAVE, JSON.stringify({ escondido: estado.value.escondido, vistos: estado.value.vistos, estilo: estado.value.estilo }))
    }
    catch {
      // Nada a fazer.
    }
  }

  function abrirBalao() {
    estado.value.escondido = false
    estado.value.convite = false
    estado.value.balao = true
    salvar()
  }
  function fecharBalao() {
    estado.value.balao = false
  }
  function iniciar(id = atual.value?.id) {
    if (!id) return
    estado.value.balao = false
    estado.value.convite = false
    estado.value.passeio = id
    estado.value.passo = 0
  }
  function encerrar({ marcarVisto = true } = {}) {
    if (estado.value.passeio && marcarVisto) estado.value.vistos = { ...estado.value.vistos, [estado.value.passeio]: true }
    estado.value.passeio = null
    estado.value.passo = 0
    salvar()
  }
  function dispensarConvite() {
    if (atual.value) estado.value.vistos = { ...estado.value.vistos, [atual.value.id]: true }
    estado.value.convite = false
    salvar()
  }
  function esconder() {
    estado.value.escondido = true
    estado.value.balao = false
    estado.value.convite = false
    salvar()
  }
  function mostrar() {
    estado.value.escondido = false
    salvar()
  }
  function definirEstilo(estilo) {
    estado.value.estilo = estilo === 'painel' ? 'painel' : 'balao'
    salvar()
  }
  function reverTudo() {
    estado.value.vistos = {}
    estado.value.escondido = false
    salvar()
  }

  return { estado, atual, carregar, salvar, abrirBalao, fecharBalao, iniciar, encerrar, dispensarConvite, esconder, mostrar, definirEstilo, reverTudo }
}
