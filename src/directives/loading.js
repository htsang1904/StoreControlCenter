export default {
  mounted(el, binding) {
    const overlay = document.createElement('div')
    overlay.className =
      'absolute inset-0 z-50 flex items-center justify-center ' +
      'bg-white/70 transition-opacity duration-200 ' +
      'opacity-0 pointer-events-none'

    overlay.innerHTML = `
      <div class="flex flex-col items-center gap-2">
        <div class="h-10 w-10 animate-spin rounded-full border-4 border-slate-300 border-t-slate-700"></div>
        <p class="text-xs font-medium text-slate-600">Đang tải...</p>
      </div>
    `

    el.__overlay = overlay
    el.__loadingPosition = ''

    if (binding.value) {
      show(el)
    }
  },

  updated(el, binding) {
    if (binding.value !== binding.oldValue) {
      binding.value ? show(el) : hide(el)
    }
  },

  unmounted(el) {
    cleanup(el)
    delete el.__overlay
    delete el.__loadingPosition
  }
}

function show(el) {
  if (getComputedStyle(el).position === 'static') {
    el.__loadingPosition = el.style.position
    el.style.position = 'relative'
  }

  if (!el.contains(el.__overlay)) {
    el.appendChild(el.__overlay)
  }

  el.setAttribute('aria-busy', 'true')
  el.__overlay.classList.remove('opacity-0', 'pointer-events-none')
  el.__overlay.classList.add('opacity-100')
}

function hide(el) {
  if (!el.__overlay) return
  el.__overlay.classList.remove('opacity-100')
  el.__overlay.classList.add('opacity-0', 'pointer-events-none')
  el.removeAttribute('aria-busy')
}

function cleanup(el) {
  el.__overlay?.remove()
  if (el.__loadingPosition !== undefined) {
    el.style.position = el.__loadingPosition
  }
}
