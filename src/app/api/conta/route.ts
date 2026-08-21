// GET /api/conta — o número que de fato envia, direto da Graph API.
//
// É a rota da aba de Configurações, onde o operador CONFERE qual número está
// conectado. Por isso não há fallback nenhum aqui: se a Meta não responde, a
// resposta é erro, e a tela mostra que não conseguiu consultar. Devolver um
// número de reserva seria mostrar um número que talvez não esteja no ar.
import { NextResponse } from 'next/server'
import type { Conta } from '@/hooks/useConta'
import { dadosDoNumero, MetaError } from '@/server/meta/client'
import { env } from '@/server/env'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const numero = await dadosDoNumero()
    const conta: Conta = {
      id: env.phoneNumberId,
      telefone: numero.display_phone_number,
      nomeExibicao: numero.verified_name,
      qualidade: numero.quality_rating,
      verificacao: numero.code_verification_status,
      statusDoNome: numero.name_status,
    }
    return NextResponse.json(conta)
  } catch (e) {
    if (e instanceof MetaError) {
      return NextResponse.json({ erro: `Meta ${e.codigo}: ${e.detalhe}` }, { status: 502 })
    }
    throw e
  }
}
