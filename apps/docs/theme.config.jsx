import React from 'react'

const Head = ({ title = 'Netlisian', description = 'Headless site-builder engine for React' } = {}) => (
  <>
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta property="og:title" content={title} />
    <meta property="og:description" content={description} />
    <meta name="description" content={description} />
  </>
)

export default {
  head: Head,
  logo: (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect width="24" height="24" rx="4" fill="currentColor" />
      </svg>
      <span>Netlisian</span>
    </div>
  ),
  project: {
    link: 'https://github.com/makhizco/netlisian'
  },
  docsRepositoryBase: 'https://github.com/makhizco/netlisian/tree/main/apps/docs',
  footer: {
    text: '© 2026 Netlisian'
  },
  chat: {
    link: 'https://discord.gg/D9e4E3MQVZ'
  }
  ,
  themeSwitch: false
}
