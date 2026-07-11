import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { loadPack, applyTheme, type Pack } from './config'
import { hydrateTokens } from './tokens'

const root = createRoot(document.getElementById('root')!)

function applyBranding(pack: Pack) {
  document.title = pack.brand.name
  document.documentElement.lang = pack.locale.code

  if (pack.brand.faviconEmoji) {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y=".9em" font-size="90">${pack.brand.faviconEmoji}</text></svg>`
    let link = document.querySelector<HTMLLinkElement>('link[rel="icon"]')
    if (!link) {
      link = document.createElement('link')
      link.rel = 'icon'
      document.head.appendChild(link)
    }
    link.type = 'image/svg+xml'
    link.href = `data:image/svg+xml,${encodeURIComponent(svg)}`
  }

  const url = pack.brand.fonts.googleUrl
  if (url && !document.querySelector(`link[href="${url}"]`)) {
    const link = document.createElement('link')
    link.rel = 'stylesheet'
    link.href = url
    document.head.appendChild(link)
  }
}

function renderError(message: string) {
  root.render(
    <div style={{
      height: '100%', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', gap: 16,
      fontFamily: 'system-ui, sans-serif', color: '#1a1a1a', padding: 24, textAlign: 'center',
    }}>
      <div style={{ fontSize: 15, fontWeight: 600 }}>Could not load configuration</div>
      <div style={{ fontSize: 13, opacity: 0.7, maxWidth: 420 }}>{message}</div>
      <button
        onClick={() => { void boot() }}
        style={{
          padding: '8px 18px', border: '1px solid #1a1a1a', background: 'transparent',
          cursor: 'pointer', fontSize: 13, borderRadius: 2,
        }}
      >
        Retry
      </button>
    </div>
  )
}

async function boot() {
  try {
    const pack = await loadPack()
    hydrateTokens(pack)
    applyTheme(pack)
    applyBranding(pack)
    const { default: App } = await import('./App.tsx')
    root.render(
      <StrictMode>
        <App />
      </StrictMode>
    )
  } catch (e) {
    renderError(e instanceof Error ? e.message : String(e))
  }
}

void boot()
