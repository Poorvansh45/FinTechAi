'use client'

import { useEffect } from 'react'

export function ScrollToAnchor() {
  useEffect(() => {
    const isSamePageHash = (href: string) => href.startsWith('#') || href.startsWith('/#')

    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      const link = target.closest('a') as HTMLAnchorElement | null
      if (!link || !link.href) return

      const url = new URL(link.href)
      const hash = url.hash
      if (!hash || !isSamePageHash(hash)) return

      const el = document.querySelector(hash) as HTMLElement | null
      if (!el) return

      e.preventDefault()
      // Scroll the element roughly to the vertical center of the viewport.
      el.scrollIntoView({ behavior: 'smooth', block: 'center' })
      // Update URL without reloading
      history.pushState(null, '', hash)
    }

    const handleInitialHash = () => {
      const { hash } = window.location
      if (!hash) return
      const el = document.querySelector(hash) as HTMLElement | null
      if (!el) return
      // Delay to allow layout to settle
      setTimeout(() => {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }, 50)
    }

    document.addEventListener('click', handleClick)
    handleInitialHash()
    window.addEventListener('hashchange', handleInitialHash)

    return () => {
      document.removeEventListener('click', handleClick)
      window.removeEventListener('hashchange', handleInitialHash)
    }
  }, [])

  return null
}
