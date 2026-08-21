'use client'

import { useState } from 'react'
import { ThemeProvider } from 'next-themes'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

// O QueryClient nasce no state para não ser compartilhado entre requisições no
// SSR — um client no módulo vazaria cache de um usuário para outro.
export default function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            refetchOnWindowFocus: false,
            staleTime: 30_000,
            retry: 1,
          },
        },
      })
  )

  return (
    // `attribute="class"` casa com o `@custom-variant dark (&:is(.dark *))` do
    // globals.css. O next-themes injeta um script bloqueante no <head> que
    // aplica a classe antes da primeira pintura — sem flash de tema errado.
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </ThemeProvider>
  )
}
