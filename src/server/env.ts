// Leitura validada de ambiente. Falha ALTO no boot em vez de devolver
// `undefined` que só estoura três camadas abaixo, dentro de um fetch pra Meta.
import 'server-only'

function obrigatorio(nome: string): string {
  const v = process.env[nome]
  if (!v) throw new Error(`Variável de ambiente ausente: ${nome}. Veja .env.local.example.`)
  return v
}

export const env = {
  get supabaseUrl() {
    return obrigatorio('NEXT_PUBLIC_SUPABASE_URL')
  },
  get supabaseServiceKey() {
    return obrigatorio('SUPABASE_SERVICE_ROLE_KEY')
  },
  get whatsappToken() {
    return obrigatorio('WHATSAPP_ACCESS_TOKEN')
  },
  get phoneNumberId() {
    return obrigatorio('WHATSAPP_PHONE_NUMBER_ID')
  },
  get wabaId() {
    return obrigatorio('WHATSAPP_BUSINESS_ACCOUNT_ID')
  },
  get graphVersion() {
    return process.env.GRAPH_API_VERSION ?? 'v21.0'
  },
  get appSecret() {
    return obrigatorio('META_APP_SECRET')
  },
  get verifyToken() {
    return obrigatorio('WEBHOOK_VERIFY_TOKEN')
  },
  get cronSecret() {
    return obrigatorio('CRON_SECRET')
  },
  get limiteDiario() {
    // Valor inválido viraria NaN e seria passado como limite para a RPC da
    // fila, onde `Math.min(LOTE, NaN)` é NaN e o disparo para sem explicação.
    // Cai no degrau conservador em vez de falhar em silêncio.
    const bruto = Number(process.env.DISPARO_LIMITE_DIARIO)
    return Number.isFinite(bruto) && bruto > 0 ? Math.floor(bruto) : 250
  },
}
