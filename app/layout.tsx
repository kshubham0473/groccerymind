import type { Metadata, Viewport } from 'next'
import { Inter, Lora } from 'next/font/google'
import './globals.css'
import { AppProvider } from '@/components/AppProvider'
import BottomNavWrapper from '@/components/BottomNavWrapper'
import { TourProvider } from '@/components/TourProvider'
import TourOverlay from '@/components/TourOverlay'
import { Analytics } from '@vercel/analytics/next'

// Self-hosted + preloaded. Playfair Display and DM Sans were being downloaded
// on every cold load and never rendered — removed.
const inter = Inter({ subsets: ['latin'], weight: ['400','500','600','700'], variable: '--font-inter', display: 'swap' })
const lora  = Lora({  subsets: ['latin'], weight: ['500','600','700'],       variable: '--font-lora',  display: 'swap' })

export const metadata: Metadata = {
  title: 'GroceryMind',
  description: 'Smart grocery companion for your Indian kitchen',
  manifest: '/manifest.json',
  appleWebApp: { capable: true, statusBarStyle: 'black-translucent', title: 'GroceryMind' },
  icons: { apple: '/icon-192.png', icon: '/icon-192.png' },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',   // so env(safe-area-inset-*) actually resolves
  themeColor: '#14372A',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${lora.variable}`}>
      <head>
        <link rel="apple-touch-icon" href="/icon-192.png" />
      </head>
      <body>
        <AppProvider>
          <TourProvider>
            <div className="app-shell">
              <main>{children}</main>
              <BottomNavWrapper />
            </div>
            <TourOverlay />
          </TourProvider>
        </AppProvider>
        <Analytics />
      </body>
    </html>
  )
}
