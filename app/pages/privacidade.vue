<script setup>
// Página da política de privacidade. No cadastro ela abre numa janela; esta página serve para acesso direto.
import { ChevronLeft } from '@lucide/vue'

definePageMeta({ layout: 'entrada', semAbas: true })
useHead({ title: 'Privacidade | PGC' })

const router = useRouter()
// Volta para a tela de onde a pessoa veio; se abriu direto, vai para a entrada.
function voltar() {
  if (window.history.state?.back) router.back()
  else navigateTo('/entrar')
}
</script>

<template>
  <div class="flex flex-col gap-5">
    <TituloPagina>Privacidade</TituloPagina>
    <PoliticaPrivacidade />
    <button type="button" class="volta self-start pl-0" @click="voltar">
      <ChevronLeft :size="17" :stroke-width="1.9" aria-hidden="true" />
      <span>Voltar</span>
    </button>
  </div>
</template>
