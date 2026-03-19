<script setup>
import { nextTick, onMounted, ref, watch } from 'vue'
import HSFileUpload from '@preline/file-upload'

const props = defineProps({
  modelValue: {
    type: Array,
    default: () => [],
  },
  uploadHandler: {
    type: Function,
    required: true, // Should be a function returning a promise that resolves to { id, url, name, ... }
  },
  maxFiles: {
    type: Number,
    default: 5,
  },
  maxSizeMb: {
    type: Number,
    default: 5,
  },
  uploadUrl: {
    type: String,
    default: '/api/tickets/upload-attachments', // Default for BC
  },
  compact: {
    type: Boolean,
    default: false,
  },
  iconOnly: {
    type: Boolean,
    default: false,
  }
})

const emit = defineEmits(['update:modelValue'])
const upload = ref(null)
const dropzoneRef = ref(null)
const MAX_UPLOAD_FILES = props.maxFiles
const MAX_UPLOAD_FILE_SIZE_BYTES = props.maxSizeMb * 1024 * 1024

const getApiBaseUrl = () => String(import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '')
const normalizeFileId = (value) => {
  if (value === null || value === undefined) return ''
  if (typeof value === 'number') {
    if (!Number.isFinite(value) || value <= 0) return ''
    return String(Math.trunc(value))
  }
  const text = String(value).trim()
  if (!text || text === '0') return ''
  return text
}
const toAbsoluteUrl = (url) => {
  if (!url) return ''
  if (/^https?:\/\//i.test(url)) return url
  return `${getApiBaseUrl()}${url.startsWith('/') ? '' : '/'}${url}`
}

const normalizeModelFiles = (source) => {
  const items = Array.isArray(source) ? source : []
  return items
    .map((file) => ({
      id: normalizeFileId(file?.id),
      name: String(file?.name || ''),
      url: String(file?.url || ''),
      size: Number(file?.size || 0),
    }))
    .filter((file) => file.id && file.url)
}

const emitModelFiles = (files) => {
  emit('update:modelValue', files)
}

const upsertModelFile = (file) => {
  const next = Array.isArray(props.modelValue) ? [...props.modelValue] : []
  const targetId = normalizeFileId(file?.id)
  if (!targetId) return

  const index = next.findIndex((item) => normalizeFileId(item?.id) === targetId)
  if (index >= 0) {
    next[index] = { ...file, id: targetId }
  } else {
    next.push({ ...file, id: targetId })
  }
  emitModelFiles(next)
}

const removeModelFile = (dropzoneFile) => {
  const targetId = normalizeFileId(dropzoneFile?.__uploadedId || dropzoneFile?.id)
  if (!targetId) return

  const next = (Array.isArray(props.modelValue) ? props.modelValue : []).filter(
    (item) => normalizeFileId(item?.id) !== targetId
  )
  emitModelFiles(next)
}

const syncModelToDropzone = () => {
  const dropzone = dropzoneRef.value
  if (!dropzone) return

  const existingIds = new Set(
    (dropzone.files || [])
      .map((file) => normalizeFileId(file?.__uploadedId || file?.id))
      .filter(Boolean)
  )

  normalizeModelFiles(props.modelValue).forEach((file) => {
    if (existingIds.has(file.id)) return

    const mockFile = {
      name: file.name || `image-${file.id}`,
      size: file.size || 0,
      accepted: true,
      status: 'success',
      __isMock: true,
      __uploadedId: file.id,
      __uploadedUrl: file.url,
    }

    dropzone.emit('addedfile', mockFile)
    dropzone.emit('thumbnail', mockFile, toAbsoluteUrl(file.url))
    dropzone.emit('success', mockFile)
    dropzone.emit('complete', mockFile)
    dropzone.files.push(mockFile)
  })
}

onMounted(async () => {
  await nextTick()
  HSFileUpload.autoInit()

  const instance = HSFileUpload.getInstance(upload.value, true)
  const dropzone = instance?.element?.dropzone
  if (!dropzone) return

  dropzoneRef.value = dropzone
  dropzone.options.url = `${getApiBaseUrl()}/api/tickets/upload-attachments`
  dropzone.options.paramName = 'files'
  dropzone.options.acceptedFiles = 'image/*'
  dropzone.options.maxFiles = MAX_UPLOAD_FILES
  dropzone.options.autoProcessQueue = false
  dropzone.options.dictMaxFilesExceeded = `Chỉ được tải tối đa ${MAX_UPLOAD_FILES} ảnh`

  dropzone.on('addedfile', async (file) => {
    if (file?.__isMock) return

    if (file.type && !file.type.startsWith('image/')) {
      dropzone.emit('error', file, 'Chỉ cho phép tải lên file ảnh')
      dropzone.removeFile(file)
      return
    }

    const fileSize = Number(file?.size || 0)
    if (Number.isFinite(fileSize) && fileSize > MAX_UPLOAD_FILE_SIZE_BYTES) {
      dropzone.emit('error', file, 'Mỗi ảnh không được vượt quá 5MB')
      dropzone.removeFile(file)
      return
    }

    try {
      const currentUploadedCount = normalizeModelFiles(props.modelValue).length
      if (currentUploadedCount >= MAX_UPLOAD_FILES) {
        const message = `Chỉ được tải tối đa ${MAX_UPLOAD_FILES} ảnh`
        dropzone.emit('error', file, message)
        dropzone.removeFile(file)
        return
      }

      const formData = new FormData()
      formData.append('files', file)

      const uploadedFile = await props.uploadHandler(formData)
      if (!uploadedFile?.id) {
        throw new Error('Upload không trả về file hợp lệ')
      }

      file.__uploadedId = uploadedFile.id
      file.__uploadedUrl = uploadedFile.url

      dropzone.emit('thumbnail', file, toAbsoluteUrl(uploadedFile.url))
      dropzone.emit('uploadprogress', file, 100)
      dropzone.emit('success', file, uploadedFile)
      dropzone.emit('complete', file)

      upsertModelFile({
        id: uploadedFile.id,
        name: uploadedFile.name,
        url: uploadedFile.url,
        mime: uploadedFile.mime,
        size: uploadedFile.size,
        ext: uploadedFile.ext,
        formats: uploadedFile.formats || null,
      })
    } catch (error) {
      const message =
        error?.response?.data?.message || error?.message || 'Tải ảnh lên thất bại'
      dropzone.emit('error', file, message)
      dropzone.emit('complete', file)
    }
  })

  dropzone.on('removedfile', (file) => {
    removeModelFile(file)
  })

  dropzone.on('maxfilesexceeded', (file) => {
    dropzone.removeFile(file)
  })

  syncModelToDropzone()
})

watch(
  () => props.modelValue,
  () => {
    syncModelToDropzone()
  },
  { deep: true }
)
</script>
<template>
<div ref="upload" data-hs-file-upload='{
    "url": "/api/tickets/upload-attachments",
    "acceptedFiles": "image/*",
    "extensions": {
        "default": {
        "class": "shrink-0 size-5"
        },
        "xls": {
        "class": "shrink-0 size-5"
        },
        "zip": {
        "class": "shrink-0 size-5"
        },
        "csv": {
        "icon": "<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"24\" height=\"24\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M4 22h14a2 2 0 0 0 2-2V7l-5-5H6a2 2 0 0 0-2 2v4\"/><path d=\"M14 2v4a2 2 0 0 0 2 2h4\"/><path d=\"m5 12-3 3 3 3\"/><path d=\"m9 18 3-3-3-3\"/></svg>",
        "class": "shrink-0 size-5"
        }
    }
    }'>
    <div class="hidden" data-hs-file-upload-preview="">
        <div class="p-3 bg-white border border-solid border-gray-300 rounded-xl dark:bg-neutral-800 dark:border-neutral-600">
        <div class="mb-1 flex justify-between items-center">
            <div class="flex items-center gap-x-3">
                <span class="size-10 shrink-0 overflow-hidden flex justify-center items-center border border-gray-200 text-gray-500 rounded-lg dark:border-neutral-700 dark:text-neutral-500" data-hs-file-upload-file-icon="">
                    <img class="block w-full h-full object-cover rounded-lg" data-dz-thumbnail="">
                </span>
                <div>
                    <p class="text-sm font-medium text-gray-800 dark:text-white">
                    <span class="truncate inline-block max-w-75 align-bottom" data-hs-file-upload-file-name=""></span>.<span data-hs-file-upload-file-ext=""></span>
                    </p>
                    <p class="text-xs text-gray-500 dark:text-neutral-500" data-hs-file-upload-file-size=""></p>
                </div>
            </div>
            <div class="flex items-center gap-x-2">
            <button type="button" class="text-gray-500 hover:text-gray-800 focus:outline-hidden focus:text-gray-800 dark:text-neutral-500 dark:hover:text-neutral-200 dark:focus:text-neutral-200" data-hs-file-upload-remove="">
                <svg class="shrink-0 size-4" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M3 6h18"></path>
                <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path>
                <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path>
                <line x1="10" x2="10" y1="11" y2="17"></line>
                <line x1="14" x2="14" y1="11" y2="17"></line>
                </svg>
            </button>
            </div>
        </div>

        <div class="flex items-center gap-x-3 whitespace-nowrap">
            <div class="flex w-full h-2 bg-gray-200 rounded-full overflow-hidden dark:bg-neutral-700" role="progressbar" aria-valuenow="0" aria-valuemin="0" aria-valuemax="100" data-hs-file-upload-progress-bar="">
            <div class="flex flex-col justify-center rounded-full overflow-hidden bg-slate-700 text-xs text-white text-center whitespace-nowrap transition-all duration-500 hs-file-upload-complete:bg-slate-700" style="width: 0" data-hs-file-upload-progress-bar-pane=""></div>
            </div>
            <div class="w-10 text-end">
            <span class="text-sm text-gray-800 dark:text-white">
                <span data-hs-file-upload-progress-bar-value="">0</span>%
            </span>
            </div>
        </div>
        </div>
    </div>

    <div v-if="iconOnly"
      class="cursor-pointer inline-flex items-center justify-center rounded-xl p-2 text-slate-500 transition-colors hover:bg-indigo-50 hover:text-indigo-600" 
      data-hs-file-upload-trigger="" title="Đính kèm hình ảnh">
        <span class="material-symbols-outlined text-[22px]">image</span>
    </div>
    <div v-else
      class="cursor-pointer flex justify-center bg-white border border-dashed border-gray-300 rounded-xl dark:bg-neutral-800 dark:border-neutral-600" 
      :class="compact ? 'p-6' : 'p-12'"
      data-hs-file-upload-trigger="">
        <div class="text-center">
        <span class="inline-flex justify-center items-center" :class="compact ? 'size-10' : 'size-16'">
            <svg class="shrink-0 h-auto" :class="compact ? 'w-10' : 'w-16'" width="71" height="51" viewBox="0 0 71 51" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M6.55172 8.74547L17.7131 6.88524V40.7377L12.8018 41.7717C9.51306 42.464 6.29705 40.3203 5.67081 37.0184L1.64319 15.7818C1.01599 12.4748 3.23148 9.29884 6.55172 8.74547Z" stroke="currentColor" stroke-width="2" class="stroke-slate-400 dark:stroke-slate-400"></path>
            <path d="M64.4483 8.74547L53.2869 6.88524V40.7377L58.1982 41.7717C61.4869 42.464 64.703 40.3203 65.3292 37.0184L69.3568 15.7818C69.984 12.4748 67.7685 9.29884 64.4483 8.74547Z" stroke="currentColor" stroke-width="2" class="stroke-slate-400 dark:stroke-slate-400"></path>
            <g filter="url(#filter4)">
                <rect x="17.5656" y="1" width="35.8689" height="42.7541" rx="5" stroke="currentColor" stroke-width="2" class="stroke-slate-400 dark:stroke-slate-400" shape-rendering="crispEdges"></rect>
            </g>
            <path d="M39.4826 33.0893C40.2331 33.9529 41.5385 34.0028 42.3537 33.2426L42.5099 33.0796L47.7453 26.976L53.4347 33.0981V38.7544C53.4346 41.5156 51.1959 43.7542 48.4347 43.7544H22.5656C19.8043 43.7544 17.5657 41.5157 17.5656 38.7544V35.2934L29.9728 22.145L39.4826 33.0893Z" class="fill-slate-100 stroke-slate-400 dark:fill-slate-200 dark:stroke-slate-400" fill="currentColor" stroke="currentColor" stroke-width="2"></path>
            <circle cx="40.0902" cy="14.3443" r="4.16393" class="fill-slate-100 stroke-slate-400 dark:fill-slate-200 dark:stroke-slate-400" fill="currentColor" stroke="currentColor" stroke-width="2"></circle>
            <defs>
                <filter id="filter4" x="13.5656" y="0" width="43.8689" height="50.7541" filterUnits="userSpaceOnUse" color-interpolation-filters="sRGB">
                <feFlood flood-opacity="0" result="BackgroundImageFix"></feFlood>
                <feColorMatrix in="SourceAlpha" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0" result="hardAlpha"></feColorMatrix>
                <feOffset dy="3"></feOffset>
                <feGaussianBlur stdDeviation="1.5"></feGaussianBlur>
                <feComposite in2="hardAlpha" operator="out"></feComposite>
                <feColorMatrix type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.12 0"></feColorMatrix>
                <feBlend mode="normal" in2="BackgroundImageFix" result="effect4"></feBlend>
                <feBlend mode="normal" in="SourceGraphic" in2="effect4" result="shape"></feBlend>
                </filter>
            </defs>
            </svg>
        </span>

        <div class="flex flex-wrap justify-center text-gray-600" :class="compact ? 'mt-2 text-xs' : 'mt-4 text-sm/6'">
            <span class="pe-1 font-medium text-gray-800 dark:text-neutral-200">
            Kéo thả ảnh vào đây hoặc
            </span>
            <span class="rounded-lg bg-white font-semibold text-slate-700 decoration-2 hover:underline hover:text-slate-900 focus-within:outline-hidden focus-within:ring-2 focus-within:ring-slate-400 focus-within:ring-offset-2 dark:bg-neutral-800 dark:text-slate-200 dark:hover:text-white">tải ảnh lên</span>
        </div>

        <p class="mt-1 text-xs text-gray-400 dark:text-neutral-400">
            Kích thước ảnh tối đa {{ maxSizeMb }}MB.
        </p>
        </div>
    </div>

  <div class="mt-4 space-y-2 empty:mt-0" data-hs-file-upload-previews=""></div>
</div>
</template>
