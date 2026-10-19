import { describe, it, expect } from 'vitest'
import { avaliarSenha, emailValido, nomeValido, SENHA_MINIMA } from './senha.js'
import { contaJaExiste, mensagemDeErro, erroSilencioso, esperaAposFalhas } from './errosAuth.js'
import { destinoSeguro } from './redirecionamento.js'

describe('senha', () => {
  it('vazia não tem nível', () => {
    expect(avaliarSenha('').nivel).toBe(0)
    expect(avaliarSenha('').valida).toBe(false)
  })
  it('curta ou só letras é fraca e inválida', () => {
    expect(avaliarSenha('abc123').nivel).toBe(1)
    expect(avaliarSenha('abcdefghijkl').valida).toBe(false)
  })
  it(`${SENHA_MINIMA} caracteres com letras e números é média e válida`, () => {
    const r = avaliarSenha('estudo2026x')
    expect(r.valida).toBe(true)
    expect(r.nivel).toBe(2)
  })
  it('símbolo ou 14 caracteres deixa forte', () => {
    expect(avaliarSenha('estudo2026!x').nivel).toBe(3)
    expect(avaliarSenha('estudodemais2026').nivel).toBe(3)
  })
  it('aceita letras com acento', () => {
    expect(avaliarSenha('ação2026çéxy').valida).toBe(true)
  })
  it('recusa senha muito comum', () => {
    const r = avaliarSenha('senha12345')
    expect(r.valida).toBe(false)
    expect(r.nome).toBe('Senha muito comum')
  })
})

describe('e-mail e nome', () => {
  it('e-mail', () => {
    expect(emailValido('ana@exemplo.com')).toBe(true)
    expect(emailValido('ana@exemplo')).toBe(false)
    expect(emailValido('ana exemplo.com')).toBe(false)
  })
  it('nome de exibição de 1 a 60 caracteres', () => {
    expect(nomeValido('  ')).toBe(false)
    expect(nomeValido('Ana')).toBe(true)
    expect(nomeValido('a'.repeat(61))).toBe(false)
  })
})

describe('erros do login', () => {
  it('credencial errada não diz qual campo errou', () => {
    expect(mensagemDeErro({ code: 'invalid_credentials' })).toContain('E-mail ou senha')
  })
  it('e-mail já cadastrado é avisado no cadastro', () => {
    expect(erroSilencioso({ code: 'user_already_exists' })).toBe(false)
    expect(mensagemDeErro({ code: 'user_already_exists' })).toBe('Este e-mail já tem conta no PGC.')
  })
  it('reconhece a conta que já existe, com ou sem confirmação de e-mail', () => {
    expect(contaJaExiste({ error: { code: 'user_already_exists' } })).toBe(true)
    expect(contaJaExiste({ error: { code: 'email_exists' } })).toBe(true)
    expect(contaJaExiste({ data: { user: { id: 'x', identities: [] }, session: null } })).toBe(true)
    expect(contaJaExiste({ data: { user: { id: 'x', identities: [{ id: 'i' }] }, session: null } })).toBe(false)
    expect(contaJaExiste({ error: { code: 'weak_password' } })).toBe(false)
    expect(contaJaExiste({})).toBe(false)
  })
  it('limite de requisições', () => {
    expect(mensagemDeErro({ status: 429 })).toContain('Muitas tentativas')
  })
  it('sem rede', () => {
    expect(mensagemDeErro({ name: 'AuthRetryableFetchError', message: 'Failed to fetch' })).toContain('Sem conexão')
  })
  it('erro desconhecido tem mensagem genérica', () => {
    expect(mensagemDeErro({ code: 'qualquer_coisa' })).toContain('Algo deu errado')
  })
  it('pausa depois de 5 erros, dobrando até 15 minutos', () => {
    expect(esperaAposFalhas(4)).toBe(0)
    expect(esperaAposFalhas(5)).toBe(30)
    expect(esperaAposFalhas(6)).toBe(60)
    expect(esperaAposFalhas(20)).toBe(900)
  })
})

describe('destino depois de entrar', () => {
  it('aceita caminho interno', () => {
    expect(destinoSeguro('/materias?x=1')).toBe('/materias?x=1')
  })
  it('recusa outro site e truques', () => {
    expect(destinoSeguro('https://golpe.com')).toBe('/inicio')
    expect(destinoSeguro('//golpe.com')).toBe('/inicio')
    expect(destinoSeguro('/\\golpe.com')).toBe('/inicio')
    expect(destinoSeguro(undefined)).toBe('/inicio')
  })
  it('não volta para as telas de entrada', () => {
    expect(destinoSeguro('/entrar')).toBe('/inicio')
  })
  it('usa o padrão pedido', () => {
    expect(destinoSeguro('', '/redefinir-senha')).toBe('/redefinir-senha')
  })
})
