'use client'

import { useSyncExternalStore } from 'react'
import { useRouter } from 'next/navigation'
import { useTheme } from 'next-themes'
import {
  LayoutDashboard,
  MessageSquare,
  Users,
  Send,
  LayoutTemplate,
  CalendarClock,
  RefreshCw,
  BarChart3,
  LineChart,
  Settings,
  Sun,
  Moon,
  Monitor,
  LogOut,
  ChevronsUpDown,
} from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu'
import Badge from './ui/badge'
import { cn } from '@/lib/utils'
import { ACTIVE_TABS, type ActiveTab } from '@/lib/tabs'

type NavItem = { id: ActiveTab; label: string; icon: React.ElementType }

// A ordem espelha ACTIVE_TABS — as dez superfícies, sem gate: não há
// autenticação nesta fase.
const NAV_ITEMS: NavItem[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'conversations', label: 'Conversas', icon: MessageSquare },
  { id: 'leads', label: 'Leads', icon: Users },
  { id: 'disparos', label: 'Disparos', icon: Send },
  { id: 'templates', label: 'Templates', icon: LayoutTemplate },
  { id: 'agendamentos', label: 'Agendamentos', icon: CalendarClock },
  { id: 'reativacao', label: 'Reativação', icon: RefreshCw },
  { id: 'reports', label: 'Relatórios', icon: BarChart3 },
  { id: 'executivo', label: 'Painel executivo', icon: LineChart },
  { id: 'account', label: 'Configurações', icon: Settings },
]

if (process.env.NODE_ENV !== 'production' && NAV_ITEMS.length !== ACTIVE_TABS.length) {
  throw new Error('Sidebar e ACTIVE_TABS divergiram — toda aba registrada precisa de uma linha de nav.')
}

const THEMES = [
  { value: 'light', label: 'Tema claro', icon: Sun },
  { value: 'dark', label: 'Tema escuro', icon: Moon },
  { value: 'system', label: 'Tema do sistema', icon: Monitor },
] as const

const noopSubscribe = () => () => {}

/**
 * `false` no servidor, `true` depois da hidratação. O tema resolvido só existe
 * no cliente: marcar um segmento no HTML do servidor produziria exatamente o
 * salto visual que o script do next-themes evita.
 */
function useHydrated(): boolean {
  return useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false
  )
}

function ThemeSwitcher() {
  const { theme, setTheme } = useTheme()
  const mounted = useHydrated()

  return (
    <div
      role="group"
      aria-label="Tema"
      className="flex items-center rounded-pill bg-canvas-soft"
    >
      {THEMES.map(({ value, label, icon: Icon }) => {
        const active = mounted && theme === value
        return (
          <button
            key={value}
            type="button"
            onClick={() => setTheme(value)}
            aria-label={label}
            aria-pressed={active}
            className={cn(
              'flex size-11 items-center justify-center rounded-full transition-colors',
              active ? 'bg-canvas text-ink elev-3' : 'text-body hover:text-ink'
            )}
          >
            <Icon className="size-4" strokeWidth={2} aria-hidden />
          </button>
        )
      })}
    </div>
  )
}

type SidebarProps = {
  activeTab: ActiveTab
  onTabChange: (tab: ActiveTab) => void
  unreadCounts?: Record<string, number>
}

export default function Sidebar({ activeTab, onTabChange, unreadCounts }: SidebarProps) {
  const router = useRouter()
  const totalUnread = Object.values(unreadCounts ?? {}).reduce((s, v) => s + (v ?? 0), 0)

  return (
    <aside className="flex h-full w-60 shrink-0 flex-col border-r border-hairline bg-canvas">
      {/* Wordmark. Sentence-case, peso 700, sem letter-spacing — o doc é
          categórico: a face de display nunca é espaçada. */}
      <div className="px-5 pt-8 pb-6">
        <p className="t-display-md text-ink">
          Artha<span className="text-body"> System</span>
        </p>
      </div>

      <nav className="flex-1 space-y-1 px-3" aria-label="Seções do painel">
        {NAV_ITEMS.map((item, index) => {
          const Icon = item.icon
          const isActive = activeTab === item.id
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onTabChange(item.id)}
              aria-current={isActive ? 'page' : undefined}
              className={cn(
                'reveal-slide relative flex h-11 w-full items-center gap-3 rounded-md px-4 t-body-md-strong transition-colors',
                isActive ? 'bg-canvas-soft text-ink' : 'text-body hover:bg-canvas-soft hover:text-ink'
              )}
              style={{ animationDelay: `${index * 30}ms` }}
            >
              {isActive && <span aria-hidden className="nav-indicator" />}
              <Icon className="size-4 shrink-0" strokeWidth={isActive ? 2.2 : 1.8} aria-hidden />
              <span className="truncate">{item.label}</span>
              {item.id === 'conversations' && (
                <span className="ml-auto">
                  <Badge count={totalUnread} />
                </span>
              )}
            </button>
          )
        })}
      </nav>

      <div className="space-y-3 border-t border-hairline p-3">
        <ThemeSwitcher />

        <DropdownMenu>
          <DropdownMenuTrigger className="flex h-14 w-full items-center gap-3 rounded-md px-3 text-left transition-colors hover:bg-canvas-soft">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-ink t-body-sm-strong text-on-ink">
              AR
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate t-body-sm-strong text-ink">Equipe Artha</span>
              <span className="block truncate font-mono t-caption text-body">
                operacao@artha.ia.br
              </span>
            </span>
            <ChevronsUpDown className="size-4 shrink-0 text-mute" aria-hidden />
          </DropdownMenuTrigger>
          <DropdownMenuContent side="top" align="start" sideOffset={8} className="min-w-52">
            <DropdownMenuLabel>Minha conta</DropdownMenuLabel>
            <DropdownMenuItem onClick={() => onTabChange('account')}>
              <Settings aria-hidden />
              Configurações da conta
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onClick={() => router.push('/login')}>
              <LogOut aria-hidden />
              Sair
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </aside>
  )
}
