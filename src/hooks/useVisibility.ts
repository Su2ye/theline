import { useEffect, useRef, useCallback } from 'react'

interface Callbacks {
  onHide?: () => void
  onShow?: () => void
}

export function useVisibility({ onHide, onShow }: Callbacks) {
  const hideRef = useRef(onHide)
  const showRef = useRef(onShow)
  hideRef.current = onHide
  showRef.current = onShow

  useEffect(() => {
    const handleChange = () => {
      if (document.hidden) {
        hideRef.current?.()
      } else {
        showRef.current?.()
      }
    }

    document.addEventListener('visibilitychange', handleChange)
    return () => document.removeEventListener('visibilitychange', handleChange)
  }, [])

  const isVisible = useCallback(() => !document.hidden, [])
  return { isVisible }
}
