export function parseSlashCommand(text: string): string | null {
  const match = /^\/(\S*)$/.exec(text)
  return match ? match[1] : null
}

export function normalizeShortcut(input: string): string {
  return input.replace(/^\//, '').trim().toLowerCase()
}

export function isValidShortcut(input: string): boolean {
  const s = normalizeShortcut(input)
  return s.length > 0 && !/\s/.test(s)
}

export type QuickReplyItem = { id: string; shortcut: string; message: string }

export function filterQuickReplies<T extends QuickReplyItem>(replies: T[], query: string): T[] {
  const q = query.toLowerCase()
  return replies
    .filter((r) => r.shortcut.toLowerCase().includes(q))
    .sort((a, b) => a.shortcut.localeCompare(b.shortcut))
}

export type LeadVars = { contact_name?: string | null }

export function applyLeadVariables(message: string, lead: LeadVars): string {
  const nome = lead.contact_name ?? ''
  return message.replace(/\{nome\}/gi, nome)
}
