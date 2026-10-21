// Avisos curtos no canto da tela ("Matéria criada", "Não deu para salvar"), com ação opcional ("Desfazer").
// Um lugar só para o app inteiro: as telas chamam avisar(...) e o <AppAvisos /> do layout mostra.
// Uso: const { avisar } = useAvisos(); avisar({ texto: 'Salvo.', tipo: 'ok' })
//      avisar({ texto: 'Assunto apagado.', acao: { texto: 'Desfazer', fazer: () => ... } })

let proximoId = 1

export function useAvisos() {
  const lista = useState('pgc-avisos', () => [])

  function fechar(id) {
    lista.value = lista.value.filter((a) => a.id !== id)
  }

  // tipo: 'ok' | 'erro' | 'info'. duracao em ms (0 = fica até fechar).
  function avisar({ texto, tipo = 'info', acao = null, duracao }) {
    const id = proximoId++
    const tempo = duracao ?? (tipo === 'erro' ? 8000 : acao ? 7000 : 4000)
    lista.value = [...lista.value.slice(-3), { id, texto, tipo, acao, tempo }]
    if (import.meta.client && tempo > 0) setTimeout(() => fechar(id), tempo)
    return id
  }

  return { lista, avisar, fechar }
}
