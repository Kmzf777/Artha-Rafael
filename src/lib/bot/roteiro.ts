// O roteiro do bot de qualificação, como DADO. Sem decisão nenhuma aqui — quem
// decide é `estado.ts`. Spec 2026-08-24 §3.2.
//
// OS IDS SÃO O CONTRATO; OS TÍTULOS SÃO COPY. Trocar "Minhas finanças" por
// "Minhas contas" não pode mexer no roteamento, e é por isso que o webhook
// guarda `button_id` além do `content`.
//
// VOZ: institucional. "Aqui é da Artha", "equipe da Artha". Nenhum nome de
// persona — há três em circulação (Lúcia, Clara, LucIA) e a escolha é do
// cliente.
import type { Segmento } from '@/mock/types'

/** Autoria das mensagens do bot na coluna `messages.enviado_por`. */
export const AUTOR_BOT = 'bot'

/** Limites da Cloud API para `interactive.type = 'button'`. */
export const MAX_BOTOES = 3
export const MAX_TITULO = 20

export type Botao = { id: string; titulo: string }
export type Pergunta = { corpo: string; botoes: Botao[] }

export const P1: Pergunta = {
  corpo: 'Oi! Aqui é da Artha. Para te direcionar certo, me diz o que você procura:',
  botoes: [
    { id: 'p1:artha', titulo: 'Minhas finanças' },
    { id: 'p1:dhana', titulo: 'Sou planejador' },
    { id: 'p1:outro', titulo: 'Outro assunto' },
  ],
}

/** A p2 ramifica pela resposta da p1. `p1:outro` não tem p2: encerra ali. */
export const P2_POR_RAMO: Record<string, Pergunta> = {
  'p1:artha': {
    corpo: 'Você já usou a Artha?',
    botoes: [
      { id: 'p2:assinante', titulo: 'Já sou assinante' },
      { id: 'p2:testou', titulo: 'Já testei' },
      { id: 'p2:nunca', titulo: 'Nunca usei' },
    ],
  },
  'p1:dhana': {
    corpo: 'Quantos clientes você atende hoje?',
    botoes: [
      { id: 'p2:ate20', titulo: 'Até 20' },
      { id: 'p2:20a100', titulo: '20 a 100' },
      { id: 'p2:100mais', titulo: 'Mais de 100' },
    ],
  },
}

export const FECHO =
  'Perfeito, obrigado! Já passei para a equipe da Artha — em instantes alguém te responde por aqui.'

export const REPETICAO = 'Te respondo já! Só me diz primeiro:'

/** Só artha e dhana decidem segmento. `p1:outro` não qualifica ninguém. */
export const SEGMENTO_POR_P1: Record<string, Segmento> = {
  'p1:artha': 'artha',
  'p1:dhana': 'dhana',
}

/** Toda resposta terminal vira uma tag no lead. */
export const TAG_POR_RESPOSTA: Record<string, string> = {
  'p1:outro': 'outro-assunto',
  'p2:assinante': 'assinante',
  'p2:testou': 'ja-testou',
  'p2:nunca': 'nunca-usou',
  'p2:ate20': 'carteira-ate-20',
  'p2:20a100': 'carteira-20-100',
  'p2:100mais': 'carteira-100-mais',
}

const IDS_P1 = new Set(P1.botoes.map((b) => b.id))
const IDS_P2 = new Set(Object.values(P2_POR_RAMO).flatMap((p) => p.botoes.map((b) => b.id)))

export function ehIdP1(id: string | null): boolean {
  return id !== null && IDS_P1.has(id)
}

export function ehIdP2(id: string | null): boolean {
  return id !== null && IDS_P2.has(id)
}

/** Um id que o roteiro não conhece veio de campanha antiga ou de roteiro trocado. */
export function ehIdConhecido(id: string | null): boolean {
  return ehIdP1(id) || ehIdP2(id)
}

export function perguntaP2(idP1: string): Pergunta | null {
  return P2_POR_RAMO[idP1] ?? null
}
