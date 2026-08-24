'use client'

import { Suspense, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import Sidebar from '@/components/Sidebar'
import Dashboard from '@/components/Dashboard'
import Conversations from '@/components/Conversations'
import Leads from '@/components/Leads'
import Disparos from '@/components/Disparos'
import Templates from '@/components/Templates'
import Reports from '@/components/Reports'
import AccountInfo from '@/components/AccountInfo'
import { parseTab, tabHref, type ActiveTab } from '@/lib/tabs'

export type { ActiveTab }

function HomeContent() {
  const searchParams = useSearchParams()
  const activeTab = parseTab(searchParams.get('tab'))
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({})

  // Troca de aba client-only: history.pushState atualiza a URL sem round-trip
  // de RSC. useSearchParams reage a pushState desde Next 14.1. É o que mantém o
  // deep-link `?tab=` funcionando ao compartilhar a URL.
  function handleTabChange(tab: ActiveTab) {
    window.history.pushState(null, '', tabHref(tab))
  }

  return (
    <div className="flex h-screen overflow-hidden bg-canvas">
      <Sidebar activeTab={activeTab} onTabChange={handleTabChange} unreadCounts={unreadCounts} />
      <main className="flex-1 overflow-hidden bg-canvas">
        {activeTab === 'dashboard' && <Dashboard />}
        {activeTab === 'conversations' && <Conversations onUpdateUnread={setUnreadCounts} />}
        {activeTab === 'leads' && <Leads />}
        {activeTab === 'disparos' && <Disparos />}
        {activeTab === 'templates' && <Templates />}
        {activeTab === 'reports' && <Reports />}
        {activeTab === 'account' && <AccountInfo />}
      </main>
    </div>
  )
}

export default function Home() {
  return (
    <Suspense fallback={null}>
      <HomeContent />
    </Suspense>
  )
}
