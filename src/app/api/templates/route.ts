// GET /api/templates — o cache local. POST — cria na Meta.
import { NextResponse } from 'next/server'
import { validarTemplate, type RascunhoTemplate } from '@/lib/templates'
import { criarTemplateNaMeta, MetaError } from '@/server/meta/client'
import { listarTemplates } from '@/server/repo/templates'
import { db } from '@/server/supabase'

export const dynamic = 'force-dynamic'

export async function GET() {
  return NextResponse.json(await listarTemplates())
}

export async function POST(req: Request) {
  const rascunho = (await req.json()) as RascunhoTemplate

  // Validação LOCAL, ANTES de qualquer chamada à Meta: é o que impede repetir o
  // erro 132018 que a conta levou no teste real (botão URL estático não aceita
  // parâmetro). Rascunho inválido não gasta round-trip nem sujeita a conta a
  // recusa da Graph. Spec §7.1.
  const erros = validarTemplate(rascunho)
  if (erros.length > 0) return NextResponse.json({ erros }, { status: 422 })

  const componentes: Record<string, unknown>[] = []
  if (rascunho.cabecalho) {
    componentes.push({ type: 'HEADER', format: 'TEXT', text: rascunho.cabecalho })
  }
  componentes.push({
    type: 'BODY',
    text: rascunho.corpo,
    ...(rascunho.exemplos.length > 0 ? { example: { body_text: [rascunho.exemplos] } } : {}),
  })
  if (rascunho.rodape) componentes.push({ type: 'FOOTER', text: rascunho.rodape })
  if (rascunho.botoes.length > 0) {
    componentes.push({
      type: 'BUTTONS',
      buttons: rascunho.botoes.map((b) =>
        b.tipo === 'URL'
          ? { type: 'URL', text: b.texto, url: b.url }
          : b.tipo === 'PHONE_NUMBER'
            ? { type: 'PHONE_NUMBER', text: b.texto, phone_number: b.telefone }
            : { type: 'QUICK_REPLY', text: b.texto }
      ),
    })
  }

  try {
    const criado = await criarTemplateNaMeta({
      name: rascunho.nome,
      language: rascunho.idioma,
      category: rascunho.categoria,
      components: componentes,
    })

    // Grava o cache local. A Meta é a fonte da verdade e `POST /api/templates/sync`
    // reconcilia — por isso uma falha aqui não desfaz o template já criado lá.
    await db()
      .from('templates')
      .upsert(
        {
          nome: rascunho.nome,
          meta_id: criado.id,
          categoria: rascunho.categoria,
          idioma: rascunho.idioma,
          corpo: rascunho.corpo,
          componentes,
          botoes: rascunho.botoes.map((b) => b.texto),
          status: 'pendente',
          // Reenvio de um nome que a Meta já recusou: sem zerar aqui, o motivo
          // antigo ficaria na linha e reapareceria na tela na próxima recusa.
          motivo_rejeicao: null,
        },
        { onConflict: 'nome' }
      )

    return NextResponse.json({ ok: true, meta_id: criado.id })
  } catch (e) {
    // O que a Meta recusou volta como 422 com a mesma forma da validação local,
    // para a tela ter um caminho só de exibição de erro.
    if (e instanceof MetaError) {
      return NextResponse.json({ erros: [`Meta ${e.codigo}: ${e.detalhe}`] }, { status: 422 })
    }
    throw e
  }
}
