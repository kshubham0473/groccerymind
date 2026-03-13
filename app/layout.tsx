import type { Metadata, Viewport } from 'next'
import './globals.css'
import { AppProvider } from '@/components/AppProvider'
import BottomNav from '@/components/BottomNav'

export const metadata: Metadata = {
  title: 'GroceryMind',
  description: 'Smart grocery companion for your Indian kitchen',
  manifest: '/manifest.json',
  appleWebApp: { capable: true, statusBarStyle: 'default', title: 'GroceryMind' },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#2D6A4F',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;600;700&family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500;9..40,600&display=swap" rel="stylesheet" />
      </head>
      <body>
        <AppProvider>
          <div style={{ maxWidth: '430px', margin: '0 auto', minHeight: '100vh', background: 'var(--cream)' }}>
            <main style={{ paddingBottom: '72px' }}>
              {children}
            </main>
            <BottomNav />
          </div>
        </AppProvider>
      </body>
    </html>
  )
}
