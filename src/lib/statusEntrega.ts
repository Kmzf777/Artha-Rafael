// src/lib/statusEntrega.ts
// A Meta entrega callbacks de status FORA DE ORDEM: um `sent` atrasado pode
// chegar depois de um `read`. Sem esta régua, a bolha rebaixa na tela e o
// operador acha que a mensagem não foi lida. Ver spec §6.2.
import type { DeliveryStatus } from '@/mock/types'

/** Posição no caminho. `falhou` é terminal e vence tudo. */
const RANK: Record<DeliveryStatus, number> = {
  enviado: 1,
  entregue: 2,
  lido: 3,
  falhou: 4,
}

/** Devolve o status que deve ficar gravado. Nunca retrocede. */
export function avancarStatus(
  atual: DeliveryStatus | null,
  novo: DeliveryStatus
): DeliveryStatus {
  if (atual === null) return novo
  return RANK[novo] > RANK[atual] ? novo : atual
}

/**
 * Estados que `novo` promove — os únicos que ele pode sobrescrever.
 *
 * Existe para tornar a ESCRITA monotônica, e não só o cálculo. Ler o status,
 * decidir em memória e gravar deixa uma janela: dois callbacks simultâneos leem
 * `null`, um calcula `lido` e outro `entregue`, e o mais lento sobrescreve o
 * mais rápido. O rebaixamento fica permanente, porque não vem callback depois
 * para corrigir. Usada como guarda no `where` do update, a decisão passa a
 * acontecer sob o lock da linha e as duas ordens convergem para `lido`.
 */
export function estadosPromovidosPor(novo: DeliveryStatus): DeliveryStatus[] {
  return (Object.keys(RANK) as DeliveryStatus[]).filter((s) => RANK[novo] > RANK[s])
}

const DA_META: Record<string, DeliveryStatus> = {
  sent: 'enviado',
  delivered: 'entregue',
  read: 'lido',
  failed: 'falhou',
}

/** Traduz o `status` do webhook. Desconhecido → null (ignorar, não adivinhar). */
export function statusDaMeta(bruto: string): DeliveryStatus | null {
  return DA_META[bruto] ?? null
}
