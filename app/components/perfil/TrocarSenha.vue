<script setup>
// Trocar a senha sem sair do perfil. Pede a senha atual (num computador da escola aberto, outra pessoa não troca a
// sua senha), confere, grava a nova e encerra a conta nos outros aparelhos. Uso: ref="janela" e janela.abrir().
import { KeyRound } from '@lucide/vue'
import { avaliarSenha } from '#shared/regras/senha.js'
import { mensagemDeErro } from '#shared/regras/errosAuth.js'

const supabase = useSupabaseClient()
const usuario = useSupabaseUser()
const { avisar } = useAvisos()

const janela = ref(null)
const atual = ref('')
const nova = ref('')
const erros = reactive({ atual: '', nova: '' })
const erroGeral = ref('')
const tentativa = ref(0)
const carregando = ref(false)
const descricaoNova = computed(() => ['requisitos-senha-perfil', erros.nova && 'erro-senha-nova-perfil'].filter(Boolean).join(' '))

function abrir() {
  atual.value = ''
  nova.value = ''
  Object.assign(erros, { atual: '', nova: '' })
  erroGeral.value = ''
  janela.value?.abrir()
}

async function salvar() {
  if (carregando.value) return
  tentativa.value += 1
  erroGeral.value = ''
  const avaliacao = avaliarSenha(nova.value)
  erros.atual = atual.value ? '' : 'Informe a senha que você usa hoje.'
  erros.nova = avaliacao.valida ? '' : avaliacao.comum ? 'Essa senha é muito comum. Escolha outra.' : 'A senha precisa ter 10 caracteres ou mais, com letras e números.'
  if (!erros.nova && nova.value === atual.value) erros.nova = 'A senha nova precisa ser diferente da atual.'
  if (erros.atual) return document.getElementById('senha-atual-perfil')?.focus()
  if (erros.nova) return document.getElementById('senha-nova-perfil')?.focus()

  carregando.value = true
  const conferida = await supabase.auth.signInWithPassword({ email: usuario.value?.email ?? '', password: atual.value })
  if (conferida.error) {
    carregando.value = false
    if (conferida.error.code === 'invalid_credentials') {
      erros.atual = 'A senha atual não confere.'
      atual.value = ''
      return document.getElementById('senha-atual-perfil')?.focus()
    }
    erroGeral.value = mensagemDeErro(conferida.error)
    return
  }
  const { error } = await supabase.auth.updateUser({ password: nova.value })
  if (error) {
    carregando.value = false
    if (error.code === 'same_password' || error.code === 'weak_password') {
      erros.nova = mensagemDeErro(error)
      return document.getElementById('senha-nova-perfil')?.focus()
    }
    erroGeral.value = mensagemDeErro(error)
    return
  }
  // Quem estava com a conta aberta em outro aparelho precisa entrar de novo.
  await supabase.auth.signOut({ scope: 'others' }).catch(() => {})
  carregando.value = false
  janela.value?.fechar()
  avisar({ texto: 'Senha trocada. Os outros aparelhos precisam entrar de novo.', tipo: 'ok' })
}

defineExpose({ abrir })
</script>

<template>
  <JanelaBase ref="janela" titulo="Trocar a senha" descricao="Depois de trocar, a conta sai dos outros aparelhos.">
    <form id="form-trocar-senha" class="flex flex-col gap-5" novalidate @submit.prevent="salvar">
      <EntradaCampoSenha
        id="senha-atual-perfil"
        v-model="atual"
        rotulo="Senha atual"
        autocomplete="current-password"
        :invalido="!!erros.atual"
        :descricao="erros.atual ? 'erro-senha-atual-perfil' : undefined"
      >
        <EntradaErroCampo id="erro-senha-atual-perfil" :mensagem="erros.atual" :vez="tentativa" />
      </EntradaCampoSenha>
      <EntradaCampoSenha
        id="senha-nova-perfil"
        v-model="nova"
        rotulo="Senha nova"
        autocomplete="new-password"
        :invalido="!!erros.nova"
        :descricao="descricaoNova"
      >
        <EntradaMedidorSenha id="requisitos-senha-perfil" :senha="nova" />
        <EntradaErroCampo id="erro-senha-nova-perfil" :mensagem="erros.nova" :vez="tentativa" />
      </EntradaCampoSenha>
      <EntradaAvisoErro caixa :mensagem="erroGeral" :vez="tentativa" />
    </form>
    <template #rodape>
      <button type="button" class="botao-fantasma" @click="janela.fechar()">Cancelar</button>
      <EntradaBotaoEnviar form="form-trocar-senha" :carregando="carregando" :icone="KeyRound" texto="Trocar a senha" texto-carregando="Trocando" />
    </template>
  </JanelaBase>
</template>
