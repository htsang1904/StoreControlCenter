export default {
  mounted(el, binding) {
    const overlay = document.createElement('div')
  overlay.className =
      'absolute inset-0 z-50 flex items-center justify-center ' +
      'bg-white/10 backdrop-blur-sm'

    overlay.innerHTML = `
      <div class="h-12 w-12 animate-spin rounded-full
                  border-4 border-gray-300 border-t-blue-500"></div>
    `

    el.__overlay = overlay

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
    hide(el)
    delete el.__overlay
  }
}

function show(el) {
  if (getComputedStyle(el).position === 'static') {
    el.style.position = 'relative'
  }
  el.appendChild(el.__overlay)
}

function hide(el) {
  el.__overlay?.remove()
}
