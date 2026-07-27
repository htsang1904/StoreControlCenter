<script setup>
import { computed, onBeforeUnmount, ref, watch } from 'vue'

const SOURCE_META = {
  qc: { label: 'QC ghi nhận', shortLabel: 'Trước khắc phục', empty: 'Chưa có ảnh minh chứng từ QC.' },
  remediation: { label: 'Cửa hàng khắc phục', shortLabel: 'Sau khắc phục', empty: 'Cửa hàng chưa gửi minh chứng khắc phục.' },
}

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  images: { type: Array, default: () => [] },
  initialSource: { type: String, default: 'qc' },
  initialIndex: { type: Number, default: 0 },
  title: { type: String, default: 'Minh chứng' },
  enableCompare: { type: Boolean, default: true },
})

const emit = defineEmits(['update:modelValue', 'close'])

const activeSource = ref('qc')
const activeIndex = ref(0)
const compareMode = ref(false)
const compareIndexes = ref({ qc: 0, remediation: 0 })
const failedImageKeys = ref(new Set())
const zoomScale = ref(1)
const panOffset = ref({ x: 0, y: 0 })
const dragState = ref({ active: false, pointerId: null, startX: 0, startY: 0, originX: 0, originY: 0 })
const touchState = ref({ startX: 0, startY: 0, lastTapAt: 0, pinchDistance: 0, pinchScale: 1, moved: false, originX: 0, originY: 0 })

const normalizedImages = computed(() => (
  Array.isArray(props.images)
    ? props.images.map((image, index) => ({
      ...image,
      id: String(image?.id || `${image?.source || 'evidence'}-${index}`),
      source: image?.source === 'remediation' ? 'remediation' : 'qc',
      url: String(image?.url || image?.sourceUrl || image?.source || image?.previewUrl || image?.preview || image?.dataUrl || ''),
      thumbnailUrl: String(image?.thumbnailUrl || image?.url || image?.sourceUrl || image?.source || image?.previewUrl || image?.preview || image?.dataUrl || ''),
      name: String(image?.name || `Ảnh ${index + 1}`),
      createdAt: image?.createdAt || image?.created_at || null,
      createdBy: image?.createdBy || image?.created_by || null,
      note: String(image?.note || ''),
    })).filter((image) => image.url)
    : []
))
const sourceImages = computed(() => ({
  qc: normalizedImages.value.filter((image) => image.source === 'qc'),
  remediation: normalizedImages.value.filter((image) => image.source === 'remediation'),
}))
const currentImages = computed(() => sourceImages.value[activeSource.value] || [])
const currentIndex = computed(() => {
  if (!currentImages.value.length) return 0
  return Math.min(Math.max(activeIndex.value, 0), currentImages.value.length - 1)
})
const currentImage = computed(() => currentImages.value[currentIndex.value] || null)
const canCompare = computed(() => props.enableCompare && sourceImages.value.qc.length > 0 && sourceImages.value.remediation.length > 0)
const currentImageKey = computed(() => `${activeSource.value}:${currentImage.value?.id || currentIndex.value}`)
const currentImageFailed = computed(() => failedImageKeys.value.has(currentImageKey.value))
const zoomPercent = computed(() => `${Math.round(zoomScale.value * 100)}%`)
const imageTransform = computed(() => ({ transform: `translate3d(${panOffset.value.x}px, ${panOffset.value.y}px, 0) scale(${zoomScale.value})` }))
const canPanImage = computed(() => zoomScale.value > 1.02 && !compareMode.value && !currentImageFailed.value)
const viewerTitle = computed(() => compareMode.value ? `So sánh trước / sau - ${props.title}` : props.title)
const sourceTabs = computed(() => ([
  { source: 'qc', label: 'Ghi nhận', count: sourceImages.value.qc.length },
  { source: 'remediation', label: 'Khắc phục', count: sourceImages.value.remediation.length },
]))

function closeViewer() {
  emit('update:modelValue', false)
  emit('close')
}

function selectSource(source) {
  if (!sourceImages.value[source]?.length) return
  activeSource.value = source
  activeIndex.value = Math.min(compareIndexes.value[source] || 0, sourceImages.value[source].length - 1)
  compareMode.value = false
  resetZoom()
}

function resetPan() {
  panOffset.value = { x: 0, y: 0 }
  dragState.value = { active: false, pointerId: null, startX: 0, startY: 0, originX: 0, originY: 0 }
}

function resetZoom() {
  zoomScale.value = 1
  resetPan()
}

function setZoom(value) {
  zoomScale.value = Math.min(Math.max(Number(value) || 1, 1), 4)
  if (zoomScale.value <= 1.02) resetPan()
}

function zoomIn() {
  setZoom(zoomScale.value + 0.25)
}

function zoomOut() {
  setZoom(zoomScale.value - 0.25)
}

function showPrevious(source = activeSource.value) {
  const images = sourceImages.value[source] || []
  if (!images.length) return
  const current = source === activeSource.value && !compareMode.value ? activeIndex.value : compareIndexes.value[source]
  const next = current <= 0 ? images.length - 1 : current - 1
  if (compareMode.value) compareIndexes.value = { ...compareIndexes.value, [source]: next }
  else {
    activeIndex.value = next
    resetZoom()
  }
}

function showNext(source = activeSource.value) {
  const images = sourceImages.value[source] || []
  if (!images.length) return
  const current = source === activeSource.value && !compareMode.value ? activeIndex.value : compareIndexes.value[source]
  const next = current >= images.length - 1 ? 0 : current + 1
  if (compareMode.value) compareIndexes.value = { ...compareIndexes.value, [source]: next }
  else {
    activeIndex.value = next
    resetZoom()
  }
}

function formatDate(value) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return new Intl.DateTimeFormat('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric' }).format(date)
}

function creatorName(image) {
  if (!image?.createdBy) return ''
  if (typeof image.createdBy === 'string') return image.createdBy
  return image.createdBy.name || ''
}

function markImageFailed(key) {
  failedImageKeys.value = new Set([...failedImageKeys.value, key])
}

function retryImage(key) {
  const next = new Set(failedImageKeys.value)
  next.delete(key)
  failedImageKeys.value = next
}

function imageKey(source, image, index) {
  return `${source}:${image?.id || index}`
}

function touchDistance(touches) {
  if (!touches || touches.length < 2) return 0
  const [first, second] = touches
  return Math.hypot(second.clientX - first.clientX, second.clientY - first.clientY)
}

function handleWheel(event) {
  if (compareMode.value || currentImageFailed.value) return
  event.preventDefault()
  setZoom(zoomScale.value + (event.deltaY < 0 ? 0.15 : -0.15))
}

function handlePointerDown(event) {
  if (!canPanImage.value || event.pointerType === 'touch') return
  event.preventDefault()
  event.currentTarget?.setPointerCapture?.(event.pointerId)
  dragState.value = {
    active: true,
    pointerId: event.pointerId,
    startX: event.clientX,
    startY: event.clientY,
    originX: panOffset.value.x,
    originY: panOffset.value.y,
  }
}

function handlePointerMove(event) {
  if (!dragState.value.active || dragState.value.pointerId !== event.pointerId) return
  event.preventDefault()
  panOffset.value = {
    x: dragState.value.originX + event.clientX - dragState.value.startX,
    y: dragState.value.originY + event.clientY - dragState.value.startY,
  }
}

function handlePointerUp(event) {
  if (dragState.value.pointerId === event.pointerId) resetPanDrag()
}

function resetPanDrag() {
  dragState.value = { active: false, pointerId: null, startX: 0, startY: 0, originX: panOffset.value.x, originY: panOffset.value.y }
}

function handleTouchStart(event) {
  if (compareMode.value || currentImageFailed.value) return
  if (event.touches.length === 2) {
    touchState.value = { ...touchState.value, pinchDistance: touchDistance(event.touches), pinchScale: zoomScale.value, moved: false, originX: panOffset.value.x, originY: panOffset.value.y }
    return
  }
  const touch = event.touches[0]
  touchState.value = { ...touchState.value, startX: touch.clientX, startY: touch.clientY, pinchDistance: 0, pinchScale: zoomScale.value, moved: false, originX: panOffset.value.x, originY: panOffset.value.y }
}

function handleTouchMove(event) {
  if (compareMode.value || currentImageFailed.value) return
  if (event.touches.length === 2) {
    const startDistance = touchState.value.pinchDistance || touchDistance(event.touches)
    const nextDistance = touchDistance(event.touches)
    if (startDistance > 0) setZoom(touchState.value.pinchScale * (nextDistance / startDistance))
    touchState.value = { ...touchState.value, moved: true }
    return
  }
  if (event.touches.length === 1) {
    const touch = event.touches[0]
    const deltaX = touch.clientX - touchState.value.startX
    const deltaY = touch.clientY - touchState.value.startY
    if (Math.abs(deltaX) > 8 || Math.abs(deltaY) > 8) touchState.value = { ...touchState.value, moved: true }
    if (canPanImage.value) {
      panOffset.value = {
        x: touchState.value.originX + deltaX,
        y: touchState.value.originY + deltaY,
      }
    }
  }
}

function handleTouchEnd(event) {
  if (compareMode.value || currentImageFailed.value || event.touches.length > 0) return
  const changed = event.changedTouches[0]
  const deltaX = changed.clientX - touchState.value.startX
  const deltaY = changed.clientY - touchState.value.startY
  const now = Date.now()

  if (!touchState.value.moved && now - touchState.value.lastTapAt < 280) {
    setZoom(zoomScale.value > 1 ? 1 : 2)
    touchState.value = { ...touchState.value, lastTapAt: 0 }
    return
  }

  if (zoomScale.value <= 1.05 && Math.abs(deltaX) > 60 && Math.abs(deltaX) > Math.abs(deltaY) * 1.5) {
    if (deltaX > 0) showPrevious()
    else showNext()
    touchState.value = { ...touchState.value, lastTapAt: 0 }
    return
  }

  touchState.value = { ...touchState.value, lastTapAt: now }
}

function handleKeydown(event) {
  if (!props.modelValue) return
  if (event.key === 'Escape') closeViewer()
  if (compareMode.value) return
  if (event.key === 'ArrowLeft') showPrevious()
  if (event.key === 'ArrowRight') showNext()
}

watch(
  () => props.modelValue,
  (open) => {
    if (typeof document === 'undefined') return
    if (open) {
      const requestedSource = props.initialSource === 'remediation' ? 'remediation' : 'qc'
      const fallbackSource = sourceImages.value[requestedSource]?.length ? requestedSource : (sourceImages.value.qc.length ? 'qc' : 'remediation')
      activeSource.value = fallbackSource
      activeIndex.value = Math.min(Math.max(Number(props.initialIndex || 0), 0), Math.max((sourceImages.value[fallbackSource]?.length || 1) - 1, 0))
      compareIndexes.value = { qc: 0, remediation: 0, [fallbackSource]: activeIndex.value }
      compareMode.value = false
      resetZoom()
      document.body.classList.add('overflow-hidden')
      document.addEventListener('keydown', handleKeydown)
      return
    }
    document.body.classList.remove('overflow-hidden')
    document.removeEventListener('keydown', handleKeydown)
  },
  { immediate: true }
)

onBeforeUnmount(() => {
  if (typeof document === 'undefined') return
  document.body.classList.remove('overflow-hidden')
  document.removeEventListener('keydown', handleKeydown)
})
</script>

<template>
  <Teleport to="body">
    <div
      v-if="modelValue"
      class="fixed inset-0 z-[100] flex items-end justify-center bg-slate-950/70 p-0 backdrop-blur-sm tablet:items-center tablet:p-5"
      role="dialog"
      aria-modal="true"
      aria-label="Evidence viewer"
      @click.self="closeViewer"
    >
      <div class="flex h-full w-full flex-col overflow-hidden bg-white shadow-2xl ring-1 ring-white/20 tablet:h-[92vh] tablet:max-w-6xl tablet:rounded-2xl">
        <header class="flex h-16 shrink-0 items-center justify-between gap-4 border-b border-slate-200 bg-white px-4 tablet:px-6">
          <div class="min-w-0">
            <h3 class="truncate text-base font-extrabold text-slate-950">{{ viewerTitle }}</h3>
            <p v-if="!compareMode && currentImage" class="mt-0.5 text-xs font-semibold text-slate-500">
              {{ SOURCE_META[activeSource].label }} · {{ currentIndex + 1 }}/{{ currentImages.length }}
            </p>
          </div>

          <div class="flex shrink-0 items-center gap-2">
            <button
              v-if="canCompare"
              type="button"
              class="hidden h-9 items-center gap-1.5 rounded-lg px-3 text-xs font-extrabold transition-colors tablet:inline-flex"
              :class="compareMode ? 'bg-slate-950 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'"
              @click="compareMode = !compareMode; resetZoom()"
            >
              <span class="material-symbols-outlined text-[17px]">compare</span>
              So sánh
            </button>
            <button
              type="button"
              class="inline-flex size-9 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100 hover:text-slate-950"
              aria-label="Đóng"
              @click="closeViewer"
            >
              <span class="material-symbols-outlined text-[20px]">close</span>
            </button>
          </div>
        </header>

        <div v-if="!compareMode" class="flex min-h-0 flex-1 flex-col tablet:grid tablet:grid-cols-[minmax(0,1fr)_320px]">
          <section class="flex min-h-0 flex-1 flex-col bg-slate-950">
            <div class="grid h-12 shrink-0 grid-cols-2 border-b border-white/10 bg-slate-900/80 px-3 text-center tablet:hidden">
              <button
                v-for="tab in sourceTabs"
                :key="tab.source"
                type="button"
                class="relative text-xs font-extrabold transition-colors disabled:cursor-not-allowed disabled:opacity-35"
                :class="activeSource === tab.source ? 'text-white after:absolute after:bottom-0 after:left-5 after:right-5 after:h-0.5 after:rounded-full after:bg-blue-400' : 'text-slate-400'"
                :disabled="tab.count <= 0"
                @click="selectSource(tab.source)"
              >
                {{ tab.label }} ({{ tab.count }})
              </button>
            </div>

            <main
              class="relative min-h-0 flex-1 touch-pan-y overflow-hidden p-3 tablet:p-6"
              @wheel="handleWheel"
              @touchstart.passive="handleTouchStart"
              @touchmove.passive="handleTouchMove"
              @touchend="handleTouchEnd"
              @pointerdown="handlePointerDown"
              @pointermove="handlePointerMove"
              @pointerup="handlePointerUp"
              @pointercancel="handlePointerUp"
            >
              <template v-if="currentImage">
                <div v-if="currentImageFailed" class="flex h-full min-h-[320px] flex-col items-center justify-center gap-3 rounded-xl border border-white/10 bg-white/5 text-slate-300">
                  <span class="material-symbols-outlined text-[34px]">broken_image</span>
                  <p class="text-sm font-bold">Không thể tải ảnh.</p>
                  <button type="button" class="rounded-lg bg-white px-3 py-2 text-xs font-extrabold text-slate-950 shadow" @click="retryImage(currentImageKey)">Thử lại</button>
                </div>
                <img
                  v-else
                  :src="currentImage.url"
                  :alt="currentImage.name"
                  :class="[
                    'mx-auto h-full max-h-full w-full select-none rounded-xl object-contain transition-transform duration-150',
                    canPanImage ? (dragState.active ? 'cursor-grabbing' : 'cursor-grab') : '',
                  ]"
                  :style="imageTransform"
                  draggable="false"
                  @dblclick="setZoom(zoomScale > 1 ? 1 : 2)"
                  @error="markImageFailed(currentImageKey)"
                />
                <button v-if="currentImages.length > 1" type="button" class="absolute left-3 top-1/2 inline-flex size-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/95 text-slate-900 shadow-lg ring-1 ring-black/10 hover:bg-white tablet:left-5" aria-label="Ảnh trước" @click="showPrevious()">
                  <span class="material-symbols-outlined">chevron_left</span>
                </button>
                <button v-if="currentImages.length > 1" type="button" class="absolute right-3 top-1/2 inline-flex size-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/95 text-slate-900 shadow-lg ring-1 ring-black/10 hover:bg-white tablet:right-5" aria-label="Ảnh tiếp theo" @click="showNext()">
                  <span class="material-symbols-outlined">chevron_right</span>
                </button>
              </template>
              <div v-else class="flex h-full items-center justify-center rounded-xl border border-white/10 bg-white/5 text-sm font-bold text-slate-300">
                {{ SOURCE_META[activeSource].empty }}
              </div>
            </main>

            <div v-if="currentImage && !currentImageFailed" class="hidden h-14 shrink-0 items-center justify-center gap-2 border-t border-white/10 bg-slate-900/80 tablet:flex">
              <button type="button" class="inline-flex size-8 items-center justify-center rounded-lg bg-white/10 text-white hover:bg-white/15 disabled:opacity-35" :disabled="zoomScale <= 1" aria-label="Thu nhỏ" @click="zoomOut">
                <span class="material-symbols-outlined text-[18px]">zoom_out</span>
              </button>
              <button type="button" class="inline-flex h-8 min-w-16 items-center justify-center rounded-lg bg-white/10 px-2 text-xs font-extrabold text-white hover:bg-white/15" @click="resetZoom">{{ zoomPercent }}</button>
              <button type="button" class="inline-flex size-8 items-center justify-center rounded-lg bg-white/10 text-white hover:bg-white/15 disabled:opacity-35" :disabled="zoomScale >= 4" aria-label="Phóng to" @click="zoomIn">
                <span class="material-symbols-outlined text-[18px]">zoom_in</span>
              </button>
            </div>
          </section>

          <aside class="flex max-h-[44vh] shrink-0 flex-col border-t border-slate-200 bg-white tablet:max-h-none tablet:border-l tablet:border-t-0">
            <div class="hidden grid-cols-2 border-b border-slate-200 px-4 text-center tablet:grid">
              <button
                v-for="tab in sourceTabs"
                :key="tab.source"
                type="button"
                class="relative h-12 text-xs font-extrabold transition-colors disabled:cursor-not-allowed disabled:opacity-35"
                :class="activeSource === tab.source ? 'text-blue-600 after:absolute after:bottom-0 after:left-4 after:right-4 after:h-0.5 after:rounded-full after:bg-blue-500' : 'text-slate-500 hover:text-slate-800'"
                :disabled="tab.count <= 0"
                @click="selectSource(tab.source)"
              >
                {{ tab.label }} ({{ tab.count }})
              </button>
            </div>

            <div class="min-h-0 flex-1 overflow-y-auto p-4 tablet:p-5">
              <div class="mb-3 flex items-center justify-between gap-3">
                <div class="min-w-0">
                  <p class="text-sm font-extrabold text-slate-900">Danh sách ảnh</p>
                  <p class="mt-0.5 text-xs font-semibold text-slate-500">{{ SOURCE_META[activeSource].label }}</p>
                </div>
                <p class="shrink-0 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-extrabold text-slate-600">{{ currentImages.length }} ảnh</p>
              </div>

              <div v-if="currentImages.length" class="grid grid-cols-4 gap-2 tablet:grid-cols-3">
                <button
                  v-for="(image, index) in currentImages"
                  :key="image.id || index"
                  type="button"
                  class="relative aspect-square overflow-hidden rounded-lg border bg-slate-100 transition"
                  :class="index === currentIndex ? 'border-blue-500 ring-2 ring-blue-500/25' : 'border-slate-200 hover:border-slate-300'"
                  @click="activeIndex = index; resetZoom()"
                >
                  <img :src="image.thumbnailUrl || image.url" :alt="image.name" class="size-full object-cover" />
                  <span class="absolute bottom-1 right-1 rounded bg-slate-950/70 px-1.5 py-0.5 text-[10px] font-extrabold text-white">{{ index + 1 }}</span>
                </button>
              </div>
              <p v-else class="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4 text-center text-xs font-semibold text-slate-500">
                {{ SOURCE_META[activeSource].empty }}
              </p>
            </div>
          </aside>
        </div>

        <main v-else class="min-h-0 flex-1 overflow-hidden bg-slate-50 p-3 tablet:p-5">
          <div class="grid h-full min-h-0 gap-3 tablet:grid-cols-2">
            <section v-for="source in ['qc', 'remediation']" :key="source" class="flex min-h-0 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div class="flex shrink-0 items-start justify-between gap-3 border-b border-slate-200 p-3 tablet:p-4">
                <div class="min-w-0">
                  <p class="text-xs font-extrabold" :class="source === 'qc' ? 'text-red-500' : 'text-emerald-600'">
                    {{ source === 'qc' ? 'Trước khắc phục' : 'Sau khắc phục' }}
                  </p>
                  <p class="mt-1 truncate text-xs font-semibold text-slate-500">
                    {{ [formatDate(sourceImages[source][compareIndexes[source] || 0]?.createdAt), creatorName(sourceImages[source][compareIndexes[source] || 0])].filter(Boolean).join(' · ') || sourceImages[source][compareIndexes[source] || 0]?.name }}
                  </p>
                </div>
                <span class="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-extrabold text-slate-700">
                  {{ (compareIndexes[source] || 0) + 1 }}/{{ sourceImages[source].length }}
                </span>
              </div>
              <div class="relative min-h-0 flex-1 bg-slate-950">
                <template v-if="failedImageKeys.has(imageKey(source, sourceImages[source][compareIndexes[source] || 0], compareIndexes[source] || 0))">
                  <div class="flex h-full flex-col items-center justify-center gap-2 text-slate-300">
                    <span class="material-symbols-outlined text-[28px]">broken_image</span>
                    <p class="text-xs font-bold">Không thể tải ảnh.</p>
                    <button type="button" class="rounded-lg bg-white px-3 py-1.5 text-xs font-extrabold text-slate-950 shadow" @click="retryImage(imageKey(source, sourceImages[source][compareIndexes[source] || 0], compareIndexes[source] || 0))">Thử lại</button>
                  </div>
                </template>
                <img v-else :src="sourceImages[source][compareIndexes[source] || 0]?.url" :alt="sourceImages[source][compareIndexes[source] || 0]?.name" class="h-full w-full object-contain" @error="markImageFailed(imageKey(source, sourceImages[source][compareIndexes[source] || 0], compareIndexes[source] || 0))" />
                <button v-if="sourceImages[source].length > 1" type="button" class="absolute left-3 top-1/2 inline-flex size-9 -translate-y-1/2 items-center justify-center rounded-full bg-white/95 text-slate-900 shadow ring-1 ring-black/10" @click="showPrevious(source)">
                  <span class="material-symbols-outlined text-[18px]">chevron_left</span>
                </button>
                <button v-if="sourceImages[source].length > 1" type="button" class="absolute right-3 top-1/2 inline-flex size-9 -translate-y-1/2 items-center justify-center rounded-full bg-white/95 text-slate-900 shadow ring-1 ring-black/10" @click="showNext(source)">
                  <span class="material-symbols-outlined text-[18px]">chevron_right</span>
                </button>
              </div>
            </section>
          </div>
        </main>
      </div>
    </div>
  </Teleport>
</template>
