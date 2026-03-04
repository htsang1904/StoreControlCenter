<script setup>
import { nextTick, onMounted, ref, watch } from 'vue'
import HSFileUpload from '@preline/file-upload'
import { uploadTicketAttachments } from '@/services/ticket_service'

const props = defineProps({
  modelValue: {
    type: Array,
    default: () => [],
  },
})

const emit = defineEmits(['update:modelValue'])
const upload = ref(null)
const dropzoneRef = ref(null)
const MAX_UPLOAD_FILES = 5
const MAX_UPLOAD_FILE_SIZE_BYTES = 5 * 1024 * 1024

const getApiBaseUrl = () => String(import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '')
const toAbsoluteUrl = (url) => {
  if (!url) return ''
  if (/^https?:\/\//i.test(url)) return url
  return `${getApiBaseUrl()}${url.startsWith('/') ? '' : '/'}${url}`
}

const normalizeModelFiles = (source) => {
  const items = Array.isArray(source) ? source : []
  return items
    .map((file) => ({
      id: Number(file?.id),
      name: String(file?.name || ''),
      url: String(file?.url || ''),
      size: Number(file?.size || 0),
    }))
    .filter((file) => Number.isInteger(file.id) && file.id > 0 && file.url)
}

const emitModelFiles = (files) => {
  emit('update:modelValue', files)
}

const upsertModelFile = (file) => {
  const next = Array.isArray(props.modelValue) ? [...props.modelValue] : []
  const targetId = Number(file?.id)
  const index = next.findIndex((item) => Number(item?.id) === targetId)
  if (index >= 0) {
    next[index] = file
  } else {
    next.push(file)
  }
  emitModelFiles(next)
}

const removeModelFile = (dropzoneFile) => {
  const targetId = Number(dropzoneFile?.__uploadedId || dropzoneFile?.id)
  if (!Number.isInteger(targetId) || targetId <= 0) return

  const next = (Array.isArray(props.modelValue) ? props.modelValue : []).filter(
    (item) => Number(item?.id) !== targetId
  )
  emitModelFiles(next)
}

const syncModelToDropzone = () => {
  const dropzone = dropzoneRef.value
  if (!dropzone) return

  const existingIds = new Set(
    (dropzone.files || [])
      .map((file) => Number(file?.__uploadedId || file?.id))
      .filter((id) => Number.isInteger(id) && id > 0)
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

      const result = await uploadTicketAttachments(formData)
      const uploadedFile = result?.data?.files?.[0] || result?.files?.[0]
      if (!uploadedFile?.id) {
        throw new Error('Upload không trả về file hợp lệ')
      }

      file.__uploadedId = uploadedFile.id
      file.__uploadedUrl = uploadedFile.url

      dropzone.emit('thumbnail', file, toAbsoluteUrl(uploadedFile.url))
      dropzone.emit('uploadprogress', file, 100)
      dropzone.emit('success', file, result)
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
            <div class="flex flex-col justify-center rounded-full overflow-hidden bg-blue-600 text-xs text-white text-center whitespace-nowrap transition-all duration-500 hs-file-upload-complete:bg-green-500" style="width: 0" data-hs-file-upload-progress-bar-pane=""></div>
            </div>
            <div class="w-10 text-end">
            <span class="text-sm text-gray-800 dark:text-white">
                <span data-hs-file-upload-progress-bar-value="">0</span>%
            </span>
            </div>
        </div>
        </div>
    </div>

    <div class="cursor-pointer p-12 flex justify-center bg-white border border-dashed border-gray-300 rounded-xl dark:bg-neutral-800 dark:border-neutral-600" data-hs-file-upload-trigger="">
        <div class="text-center">
        <span class="inline-flex justify-center items-center size-16">
            <svg class="shrink-0 w-16 h-auto" width="71" height="51" viewBox="0 0 71 51" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M6.55172 8.74547L17.7131 6.88524V40.7377L12.8018 41.7717C9.51306 42.464 6.29705 40.3203 5.67081 37.0184L1.64319 15.7818C1.01599 12.4748 3.23148 9.29884 6.55172 8.74547Z" stroke="currentColor" stroke-width="2" class="stroke-blue-600 dark:stroke-blue-500"></path>
            <path d="M64.4483 8.74547L53.2869 6.88524V40.7377L58.1982 41.7717C61.4869 42.464 64.703 40.3203 65.3292 37.0184L69.3568 15.7818C69.984 12.4748 67.7685 9.29884 64.4483 8.74547Z" stroke="currentColor" stroke-width="2" class="stroke-blue-600 dark:stroke-blue-500"></path>
            <g filter="url(#filter4)">
                <rect x="17.5656" y="1" width="35.8689" height="42.7541" rx="5" stroke="currentColor" stroke-width="2" class="stroke-blue-600 dark:stroke-blue-500" shape-rendering="crispEdges"></rect>
            </g>
            <path d="M39.4826 33.0893C40.2331 33.9529 41.5385 34.0028 42.3537 33.2426L42.5099 33.0796L47.7453 26.976L53.4347 33.0981V38.7544C53.4346 41.5156 51.1959 43.7542 48.4347 43.7544H22.5656C19.8043 43.7544 17.5657 41.5157 17.5656 38.7544V35.2934L29.9728 22.145L39.4826 33.0893Z" class="fill-blue-50 stroke-blue-600 dark:fill-blue-900/50 dark:stroke-blue-500" fill="currentColor" stroke="currentColor" stroke-width="2"></path>
            <circle cx="40.0902" cy="14.3443" r="4.16393" class="fill-blue-50 stroke-blue-600 dark:fill-blue-900/50 dark:stroke-blue-500" fill="currentColor" stroke="currentColor" stroke-width="2"></circle>
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

        <div class="mt-4 flex flex-wrap justify-center text-sm/6 text-gray-600">
            <span class="pe-1 font-medium text-gray-800 dark:text-neutral-200">
            Kéo thả ảnh vào đây hoặc
            </span>
            <span class="bg-white font-semibold text-blue-600 hover:text-blue-700 rounded-lg decoration-2 hover:underline focus-within:outline-hidden focus-within:ring-2 focus-within:ring-blue-600 focus-within:ring-offset-2 dark:bg-neutral-800 dark:text-blue-500 dark:hover:text-blue-600">tải ảnh lên</span>
        </div>

        <p class="mt-1 text-xs text-gray-400 dark:text-neutral-400">
            Kích thước ảnh tối đa 5MB.
        </p>
        </div>
    </div>

  <div class="mt-4 space-y-2 empty:mt-0" data-hs-file-upload-previews=""></div>
</div>
</template>
