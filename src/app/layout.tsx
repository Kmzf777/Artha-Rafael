import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import { TooltipProvider } from '@/components/ui/tooltip'
import { Toaster } from '@/components/ui/sonner'
import Providers from './providers'
import './globals.css'

// Uma família, dois papéis. A nota de substitutos do DESIGN.md indica Inter 700
// com `font-feature-settings: "ss01"` como a aproximação da face de display, e
// Inter 400/500 para corpo, botão e link.
const inter = Inter({
  variable: '--font-inter',
  subsets: ['latin'],
  weight: ['400', '500', '700'],
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'Artha System',
  description: 'Sistema operacional de WhatsApp da Artha — planejamento e educação financeira',
}

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    // suppressHydrationWarning vive no <html> porque é nele que o next-themes
    // escreve a classe de tema antes da hidratação.
    <html lang="pt-BR" className={`${inter.variable} h-full`} suppressHydrationWarning>
      <body className="h-full antialiased">
        <Providers>
          <TooltipProvider>
            {children}
            <Toaster position="bottom-right" />
          </TooltipProvider>
        </Providers>
      </body>
    </html>
  )
}
