// Envio direto para um bucket do Storage com XMLHttpRequest, que informa o progresso (o cliente padrão não informa).
// Usado por materiais (bucket "materiais") e bancos importados (bucket "bancos").
export async function enviarParaBucket({ supabase, url, chave, bucket, caminho, corpo, tipo, aoProgredir, sinal }) {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) throw new Error('Sua sessão terminou. Entre de novo.')
  await new Promise((resolver, falhar) => {
    const xhr = new XMLHttpRequest()
    xhr.open('POST', `${url}/storage/v1/object/${bucket}/${caminho}`)
    xhr.setRequestHeader('Authorization', `Bearer ${session.access_token}`)
    xhr.setRequestHeader('apikey', chave)
    xhr.setRequestHeader('Content-Type', tipo)
    xhr.setRequestHeader('x-upsert', 'true')
    xhr.upload.onprogress = (e) => e.lengthComputable && aoProgredir?.(Math.round((e.loaded / e.total) * 100))
    xhr.onload = () => (xhr.status < 300 ? resolver() : falhar(new Error(xhr.status === 413 ? 'O arquivo passa do limite de 10 MB.' : 'O envio falhou. Tente de novo.')))
    xhr.onerror = () => falhar(new Error('Sem conexão. Confira a internet e tente de novo.'))
    xhr.onabort = () => falhar(Object.assign(new Error('Envio cancelado.'), { cancelado: true }))
    sinal?.addEventListener('abort', () => xhr.abort())
    xhr.send(corpo)
  })
}
