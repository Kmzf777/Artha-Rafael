import { z } from 'zod'

// Espelha TemplateComponent de lib/metaApi. Compartilhado pelas rotas que
// recebem componentes de template no corpo (send-disparo, schedule-disparo,
// reativacao/enqueue), para validar de verdade em vez de castar o body.
export const TemplateComponentSchema = z.object({
  type: z.string(),
  parameters: z.array(z.object({ type: z.literal('text'), text: z.string() })),
})

export type TemplateComponentInput = z.infer<typeof TemplateComponentSchema>
