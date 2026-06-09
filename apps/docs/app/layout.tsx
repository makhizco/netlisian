import { Layout, Navbar, Footer } from 'nextra-theme-docs'
import { getPageMap } from 'nextra/page-map'
import 'nextra-theme-docs/style.css'
import '../styles.css'
import React from 'react'
import type { Metadata } from 'next'
import Image from 'next/image'

export const metadata: Metadata = {
  title: {
    template: '%s | Netlisian',
    default: 'Netlisian Documentation'
  }
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const pageMap = await getPageMap()

  const navbar = (
    <Navbar 
        logo={
          <span>
            <Image src="/logo-icon.png" alt="Netlisian Logo" width={32} height={32} />
          </span>
        }
        projectLink="https://github.com/makhizco/netlisian" 
    />
  )
  
  const footer = (
     <Footer>MIT License © 2026 Netlisian</Footer>
  )

  return (
    <html lang="en" suppressHydrationWarning>
      <head />
      <body>
        <Layout
          navbar={navbar}
          pageMap={pageMap}
          darkMode={false}
          // themeSwitch={{}}
          docsRepositoryBase="https://github.com/makhizco/netlisian/tree/main/apps/docs"
          footer={footer}
        >
          {children}
        </Layout>
      </body>
    </html>
  )
}
