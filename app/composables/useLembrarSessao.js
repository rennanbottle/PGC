// "Continuar conectado".
// - pgc_lembrar: guarda a escolha por um ano ("sim" ou "nao").
// - pgc_aba_aberta: cookie sem validade, que o navegador apaga ao ser fechado.
// Se a pessoa escolheu "nao" e o navegador foi fechado e aberto de novo, o segundo cookie sumiu:
// o middleware encerra a sessão antes de mostrar qualquer tela interna.
// Os dois cookies ficam legíveis no servidor, então a decisão vale já na primeira página carregada.

const UM_ANO = 60 * 60 * 24 * 365
// Lê e grava o texto como está (sem isso, "1" viraria o número 1).
const comoTexto = { encode: (v) => String(v), decode: (v) => String(v) }

export function useLembrarSessao() {
  const lembrar = useCookie('pgc_lembrar', { ...comoTexto, maxAge: UM_ANO, sameSite: 'lax', path: '/' })
  const abaAberta = useCookie('pgc_aba_aberta', { ...comoTexto, sameSite: 'lax', path: '/' })

  function definir(continuarConectado) {
    lembrar.value = continuarConectado ? 'sim' : 'nao'
    abaAberta.value = '1'
  }

  function marcarAbaAberta() {
    if (abaAberta.value !== '1') abaAberta.value = '1'
  }

  const sessaoDeveTerminar = () => lembrar.value === 'nao' && abaAberta.value !== '1'

  // Valor inicial da chave "Continuar conectado": quem desligou da última vez (computador da escola) vê desligada.
  const continuarPorPadrao = () => lembrar.value !== 'nao'

  return { definir, marcarAbaAberta, sessaoDeveTerminar, continuarPorPadrao }
}
