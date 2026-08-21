// src/server/meta/assinatura.ts
// Verificação de X-Hub-Signature-256. Sem isto, qualquer um injeta mensagem no
// painel com um POST. Spec §6.2 e §8.
import { createHmac, timingSafeEqual } from 'node:crypto'

export function assinaturaConfere(
  corpoCru: string,
  header: string | null,
  segredo: string
): boolean {
  if (!header?.startsWith('sha256=')) return false

  const recebida = Buffer.from(header.slice('sha256='.length), 'hex')
  const esperada = createHmac('sha256', segredo).update(corpoCru).digest()

  // timingSafeEqual estoura se os tamanhos diferirem — compare antes.
  if (recebida.length !== esperada.length) return false
  return timingSafeEqual(recebida, esperada)
}
