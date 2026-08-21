/**
 * As dez superfícies do painel. Registro único: a Sidebar itera esta lista e o
 * switch de render de `src/app/(app)/page.tsx` casa com ela.
 *
 * Não há autenticação nesta fase — nenhuma aba é restrita.
 */
export const ACTIVE_TABS = [
  'dashboard',
  'conversations',
  'leads',
  'disparos',
  'templates',
  'agendamentos',
  'reativacao',
  'reports',
  'executivo',
  'account',
] as const

export type ActiveTab = (typeof ACTIVE_TABS)[number]

export const DEFAULT_TAB: ActiveTab = 'dashboard'

export function isActiveTab(value: string | null | undefined): value is ActiveTab {
  return value != null && (ACTIVE_TABS as readonly string[]).includes(value)
}

/** Deriva a aba a partir do query param `tab`. Ausente/inválido → DEFAULT_TAB. */
export function parseTab(value: string | null | undefined): ActiveTab {
  return isActiveTab(value) ? value : DEFAULT_TAB
}

/** Href da aba: dashboard (default) usa a raiz limpa `/`, as demais usam `/?tab=<id>`. */
export function tabHref(tab: ActiveTab): string {
  return tab === DEFAULT_TAB ? '/' : `/?tab=${tab}`
}
