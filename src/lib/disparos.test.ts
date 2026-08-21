import { describe, it, expect } from 'vitest'
import {
  CAMPOS_DE_VARIAVEL,
  MAX_VARIAVEIS,
  camposParaVariaveis,
  descreverVariaveis,
  motivoNaoPreenchivel,
  previaDoCorpo,
  valorDoCampo,
  valoresDoLead,
} from './disparos'
import type { Lead } from '@/mock/types'

const AGORA = new Date('2026-08-20T15:00:00.000Z')

function lead(patch: Partial<Lead> = {}): Lead {
  return {
    id: 'l1',
    nome: 'Ana Paula Ribeiro',
    telefone: '5534992114080',
    email: 'ana@exemplo.com',
    segmento: 'artha',
    stage: 'novo',
    planoStatus: 'cancelado',
    planoValor: 97,
    ultimoAcessoEm: '2026-06-21T15:00:00.000Z',
    primeiroContatoEm: '2026-01-10T15:00:00.000Z',
    ultimaInteracaoEm: '2026-06-21T15:00:00.000Z',
    cidade: 'Uberlândia',
    tags: [],
    notas: null,
    ...patch,
  }
}

describe('camposParaVariaveis', () => {
  it('a ordem é o contrato: {{1}} é o primeiro nome', () => {
    expect(CAMPOS_DE_VARIAVEL[0]).toBe('nome')
    expect(camposParaVariaveis(1)).toEqual(['nome'])
    expect(camposParaVariaveis(2)).toEqual(['nome', 'cidade'])
    expect(camposParaVariaveis(3)).toEqual(['nome', 'cidade', 'diasSemAcesso'])
  })
  it('corpo sem variável não recebe parâmetro nenhum', () => {
    expect(camposParaVariaveis(0)).toEqual([])
  })
})

describe('motivoNaoPreenchivel', () => {
  it('null até o teto de campos disponíveis', () => {
    for (let n = 0; n <= MAX_VARIAVEIS; n++) expect(motivoNaoPreenchivel(n)).toBeNull()
  })
  it('motivo legível acima do teto', () => {
    expect(motivoNaoPreenchivel(4)).toBe('Este modelo pede 4 variáveis; a tela preenche até 3.')
  })
})

describe('descreverVariaveis', () => {
  it('diz qual campo preenche cada {{n}}', () => {
    expect(descreverVariaveis(2)).toBe('{{1}} = primeiro nome · {{2}} = cidade')
  })
  it('vazio quando o corpo não tem variável', () => {
    expect(descreverVariaveis(0)).toBe('')
  })
})

describe('valorDoCampo', () => {
  it('nome vira o primeiro nome; cidade vem inteira', () => {
    expect(valorDoCampo('nome', lead(), AGORA)).toBe('Ana')
    expect(valorDoCampo('cidade', lead(), AGORA)).toBe('Uberlândia')
  })
  it('dias sem acesso conta do último acesso', () => {
    expect(valorDoCampo('diasSemAcesso', lead(), AGORA)).toBe('60')
  })
  it('quem nunca acessou não tem número honesto: string vazia', () => {
    expect(valorDoCampo('diasSemAcesso', lead({ ultimoAcessoEm: null }), AGORA)).toBe('')
  })
})

describe('valoresDoLead', () => {
  it('devolve um valor por variável, na ordem dos campos', () => {
    expect(valoresDoLead(lead(), 3, AGORA)).toEqual(['Ana', 'Uberlândia', '60'])
    expect(valoresDoLead(lead(), 1, AGORA)).toEqual(['Ana'])
  })
})

describe('previaDoCorpo', () => {
  it('preenche {{n}} pela posição', () => {
    expect(previaDoCorpo('Olá {{1}}, faz {{2}} dias.', ['Ana', '60'])).toBe('Olá Ana, faz 60 dias.')
  })
  it('valor ausente ou vazio preserva o placeholder', () => {
    expect(previaDoCorpo('{{1}} e {{1}} e {{2}}', ['A'])).toBe('A e A e {{2}}')
    expect(previaDoCorpo('{{1}} de {{2}}', ['A', ''])).toBe('A de {{2}}')
  })
})
