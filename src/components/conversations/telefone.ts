import { telNorm11 } from '@/lib/phoneUtils'

/**
 * Telefone para leitura humana: `5534999887766` → `(34) 99988-7766`.
 *
 * A normalização é a de `telNorm11` (a mesma régua de 11 dígitos que o resto do
 * sistema usa para casar número). Número que não é celular brasileiro
 * reconhecível aparece como veio — inventar formatação seria mentir sobre o dado.
 */
export function formatarTelefone(bruto: string | null): string {
  if (!bruto) return '—'
  const n = telNorm11(bruto)
  if (!n) return bruto
  return `(${n.slice(0, 2)}) ${n.slice(2, 7)}-${n.slice(7)}`
}
