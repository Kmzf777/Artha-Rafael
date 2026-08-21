// src/lib/disparos.ts
// Régua única do disparo. Duas coisas moram aqui porque tela e servidor têm de
// dar a MESMA resposta: o espaçamento da fila e quais campos do lead preenchem
// {{1}}, {{2}}… do corpo do template.
//
// O conteúdo anterior deste módulo era código morto de outro fluxo e carregava
// a convenção oposta ({{1}} = vendedora, {{2}} = lead). Foi removido: no
// caminho real quem preenche {{1}} é o primeiro nome do lead.
import { diasSemAcesso } from './regras'
import type { Lead } from '@/mock/types'

/** Campos do lead que a tela sabe preencher, NA ORDEM em que preenchem {{n}}. */
export type CampoVariavel = 'nome' | 'cidade' | 'diasSemAcesso'

/** A ordem é o contrato: o primeiro campo preenche {{1}}, o segundo {{2}}… */
export const CAMPOS_DE_VARIAVEL: CampoVariavel[] = ['nome', 'cidade', 'diasSemAcesso']

/** Teto de variáveis que esta tela consegue preencher. */
export const MAX_VARIAVEIS = CAMPOS_DE_VARIAVEL.length

const ROTULO: Record<CampoVariavel, string> = {
  nome: 'primeiro nome',
  cidade: 'cidade',
  diasSemAcesso: 'dias sem acesso',
}

/** Espaçamento entre um envio e o seguinte, na fila de agendamentos. */
export const SEGUNDOS_ENTRE_ENVIOS = 45

/** O primeiro envio da campanha sai este tanto depois de enfileirar. */
export const ATRASO_PRIMEIRO_ENVIO_MS = 5 * 60_000

/** Os campos que preenchem as `quantidade` primeiras variáveis do corpo. */
export function camposParaVariaveis(quantidade: number): CampoVariavel[] {
  return CAMPOS_DE_VARIAVEL.slice(0, quantidade)
}

/**
 * `null` quando o template cabe nesta tela; motivo legível quando não cabe.
 *
 * Template com mais {{n}} do que campos disponíveis não pode ser disparado
 * daqui: faltaria parâmetro e a Meta recusaria cada agendamento com 132000 —
 * três tentativas por lead e a campanha inteira em `falhou`.
 */
export function motivoNaoPreenchivel(quantidade: number): string | null {
  if (quantidade <= MAX_VARIAVEIS) return null
  return `Este modelo pede ${quantidade} variáveis; a tela preenche até ${MAX_VARIAVEIS}.`
}

/** Ex.: "{{1}} = primeiro nome · {{2}} = cidade". String vazia sem variável. */
export function descreverVariaveis(quantidade: number): string {
  return camposParaVariaveis(quantidade)
    .map((campo, i) => `{{${i + 1}}} = ${ROTULO[campo]}`)
    .join(' · ')
}

/**
 * Valor de um campo para um lead. String vazia significa "não dá para
 * preencher": a Meta recusa parâmetro de texto vazio, então é melhor o lead
 * sair do recorte do que virar três tentativas falhas no worker.
 */
export function valorDoCampo(campo: CampoVariavel, lead: Lead, agora: Date): string {
  if (campo === 'nome') return (lead.nome.trim().split(/\s+/)[0] ?? '').trim()
  if (campo === 'cidade') return lead.cidade.trim()
  // `diasSemAcesso` devolve Infinity para quem nunca acessou: não há número
  // honesto para pôr na mensagem, então o lead é pulado.
  const dias = diasSemAcesso(lead, agora)
  return Number.isFinite(dias) ? String(dias) : ''
}

/** Valores de {{1}}, {{2}}… para este lead, na ordem dos campos. */
export function valoresDoLead(lead: Lead, quantidade: number, agora: Date): string[] {
  return camposParaVariaveis(quantidade).map((campo) => valorDoCampo(campo, lead, agora))
}

/**
 * Preenche {{n}} pela posição, para a prévia da tela. Valor ausente ou vazio
 * preserva o placeholder — melhor mostrar {{2}} do que um buraco na frase.
 */
export function previaDoCorpo(corpo: string, valores: string[]): string {
  return corpo.replace(/\{\{(\d+)\}\}/g, (marcador, n) => valores[Number(n) - 1] || marcador)
}
