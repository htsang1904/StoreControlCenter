import { computed, onBeforeUnmount, onMounted, ref } from 'vue'

const FALLBACK_BREAKPOINTS = Object.freeze({
  tablet: 768,
  pc: 1024,
})

function resolveCssLengthToPx(value, fallback) {
  const normalizedValue = String(value || '').trim()
  if (!normalizedValue) return fallback

  const parsedValue = Number.parseFloat(normalizedValue)
  if (!Number.isFinite(parsedValue)) return fallback

  if (normalizedValue.endsWith('rem')) {
    const rootFontSize = Number.parseFloat(
      getComputedStyle(document.documentElement).fontSize || '16'
    )
    return Math.round(parsedValue * (Number.isFinite(rootFontSize) ? rootFontSize : 16))
  }

  if (normalizedValue.endsWith('px')) {
    return Math.round(parsedValue)
  }

  return fallback
}

function readBreakpointPx(name) {
  if (typeof window === 'undefined') return FALLBACK_BREAKPOINTS[name]

  const cssValue = getComputedStyle(document.documentElement)
    .getPropertyValue(`--breakpoint-${name}`)

  return resolveCssLengthToPx(cssValue, FALLBACK_BREAKPOINTS[name])
}

function resolveViewportMode(width, breakpoints) {
  if (width >= breakpoints.pc) return 'pc'
  if (width >= breakpoints.tablet) return 'tablet'
  return 'mobile'
}

function bindMediaQuery(mediaQuery, handler) {
  if (typeof mediaQuery.addEventListener === 'function') {
    mediaQuery.addEventListener('change', handler)
    return () => mediaQuery.removeEventListener('change', handler)
  }

  mediaQuery.addListener(handler)
  return () => mediaQuery.removeListener(handler)
}

export function useResponsive() {
  const initialWidth = typeof window === 'undefined' ? FALLBACK_BREAKPOINTS.pc : window.innerWidth
  const viewportMode = ref(resolveViewportMode(initialWidth, FALLBACK_BREAKPOINTS))
  const viewportWidth = ref(initialWidth)

  let activeBreakpoints = { ...FALLBACK_BREAKPOINTS }
  let removeMediaListeners = []

  const syncViewportMode = () => {
    if (typeof window === 'undefined') return

    viewportWidth.value = window.innerWidth
    viewportMode.value = resolveViewportMode(viewportWidth.value, activeBreakpoints)
  }

  onMounted(() => {
    activeBreakpoints = {
      tablet: readBreakpointPx('tablet'),
      pc: readBreakpointPx('pc'),
    }

    const mediaQueries = [
      window.matchMedia(`(min-width: ${activeBreakpoints.tablet}px)`),
      window.matchMedia(`(min-width: ${activeBreakpoints.pc}px)`),
    ]

    removeMediaListeners = mediaQueries.map((mediaQuery) => bindMediaQuery(mediaQuery, syncViewportMode))

    window.addEventListener('orientationchange', syncViewportMode)
    syncViewportMode()
  })

  onBeforeUnmount(() => {
    removeMediaListeners.forEach((removeListener) => removeListener())
    removeMediaListeners = []
    if (typeof window === 'undefined') return
    window.removeEventListener('orientationchange', syncViewportMode)
  })

  return {
    viewportMode,
    viewportWidth,
    isMobileViewport: computed(() => viewportMode.value === 'mobile'),
    isTabletViewport: computed(() => viewportMode.value === 'tablet'),
    isPcViewport: computed(() => viewportMode.value === 'pc'),
  }
}
