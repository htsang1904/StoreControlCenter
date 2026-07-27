<script setup>
import { computed, ref } from 'vue'

const props = defineProps({
  images: { type: Array, default: () => [] },
  source: { type: String, default: 'qc' },
  title: { type: String, default: 'Minh chứng' },
  emptyText: { type: String, default: 'Chưa có ảnh minh chứng.' },
  maxPreview: { type: Number, default: 3 },
  readonly: { type: Boolean, default: true },
})

const emit = defineEmits(['open'])
const failedImageKeys = ref(new Set())

const normalizedImages = computed(() => (
  Array.isArray(props.images) ? props.images.filter((image) => image?.url || image?.source || image?.previewUrl || image?.preview || image?.dataUrl) : []
))
const visibleLimit = computed(() => Math.max(Number(props.maxPreview || 3), 1))
const visibleImages = computed(() => normalizedImages.value.slice(0, visibleLimit.value))
const hiddenCount = computed(() => Math.max(normalizedImages.value.length - visibleImages.value.length, 0))

function imageUrl(image) {
  return image?.thumbnailUrl || image?.url || image?.source || image?.previewUrl || image?.preview || image?.dataUrl || ''
}

function imageName(image, index) {
  return image?.name || `Ảnh ${index + 1}`
}

function openAt(index) {
  if (!props.readonly || !normalizedImages.value.length) return
  emit('open', { image: normalizedImages.value[index], index, source: props.source })
}

function openHiddenStart() {
  openAt(visibleImages.value.length)
}

function imageKey(image, index) {
  return String(image?.id || `${props.source}-${imageName(image, index)}-${index}`)
}

function markImageFailed(image, index) {
  failedImageKeys.value = new Set([...failedImageKeys.value, imageKey(image, index)])
}
</script>

<template>
  <section class="space-y-2">
    <div class="flex items-center justify-between gap-2">
      <p class="text-xs font-semibold text-[var(--text-secondary)]">{{ title }}</p>
      <span v-if="normalizedImages.length" class="text-[11px] font-semibold text-[var(--text-muted)]">{{ normalizedImages.length }} ảnh</span>
    </div>

    <div v-if="normalizedImages.length" class="grid grid-cols-3 gap-2">
      <button
        v-for="(image, index) in visibleImages"
        :key="image.id || `${source}-${imageName(image, index)}-${index}`"
        type="button"
        :class="[
          'relative aspect-square w-full overflow-hidden rounded-lg border border-[var(--stroke)] bg-[var(--surface-muted)]',
          readonly ? 'transition-opacity hover:opacity-90' : 'cursor-default',
        ]"
        @click="openAt(index)"
      >
        <img v-if="!failedImageKeys.has(imageKey(image, index))" :src="imageUrl(image)" :alt="imageName(image, index)" class="size-full object-cover" @error="markImageFailed(image, index)" />
        <span v-else class="absolute inset-0 inline-flex flex-col items-center justify-center gap-1 text-[var(--text-muted)]">
          <span class="material-symbols-outlined text-[20px]">broken_image</span>
          <span class="text-[10px] font-semibold">Lỗi ảnh</span>
        </span>
        <span
          v-if="hiddenCount > 0 && index === visibleImages.length - 1"
          class="absolute inset-0 inline-flex items-center justify-center bg-slate-950/55 text-sm font-bold text-white"
          @click.stop="openHiddenStart"
        >
          +{{ hiddenCount }}
        </span>
      </button>
    </div>

    <p v-else class="text-xs text-[var(--text-secondary)]">{{ emptyText }}</p>
  </section>
</template>
