<script setup>
defineProps({
  label: {
    type: String,
    default: '',
  },
  value: {
    type: [String, Number],
    default: '',
  },
  meta: {
    type: String,
    default: '',
  },
  metaClass: {
    type: String,
    default: 'bg-slate-100 text-slate-600',
  },
  icon: {
    type: String,
    default: '',
  },
  iconClass: {
    type: String,
    default: 'bg-slate-100 text-slate-600',
  },
})
</script>

<template>
  <article class="rounded-xl border border-slate-200 bg-white p-4">
    <div class="flex items-start justify-between gap-3">
      <div class="min-w-0">
        <p class="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{{ label }}</p>
        <p class="mt-2 text-3xl font-semibold tracking-tight text-slate-900">{{ value }}</p>
      </div>

      <div
        v-if="icon"
        class="flex size-9 shrink-0 items-center justify-center rounded-lg border border-slate-200"
        :class="iconClass"
      >
        <span class="material-symbols-outlined text-[18px]">{{ icon }}</span>
      </div>
    </div>

    <div v-if="meta" class="mt-3">
      <span class="app-badge inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold" :class="metaClass">
        {{ meta }}
      </span>
    </div>
  </article>
</template>
