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
        <link href="https://fonts.googleapis.com/css2?family=Lora:ital,wght@0,400;0,600;0,700;1,400;1,600&family=Nunito:wght@300;400;500;600;700&display=swap" rel="stylesheet" />
      </head>
      <body>
        <AppProvider>
          <main style={{ paddingBottom: '80px' }}>
            {children}
          </main>
          <BottomNav />
        </AppProvider>
      </body>
    </html>
  )
}
