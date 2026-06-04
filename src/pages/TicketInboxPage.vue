<script setup>
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import TicketDetailPage from '@/pages/TicketDetailPage.vue'
import TicketCreateChat from '@/components/ticket-chat-create/TicketCreateChat.vue'
import { useTicketCreateChat } from '@/composables/useTicketCreateChat'
import { useTicketList } from '@/composables/useTicketList'
import {
  avatarInitials,
  formatDateTime,
  normalizeTicketStatus,
  requesterDisplay,
  storeDisplay,
  ticketProcessingAlertHint,
  ticketStatusClass,
  ticketStatusOptions,
} from '@/composables/useTicketPresentation'
import { useApp } from '@/plugins/app'

const router = useRouter()
const route = useRoute()
const { state } = useApp()

const userInfo = computed(() => state.userInfo || null)
const mobileSidebarOpen = ref(false)
const isCreatingTicket = ref(false)
const chatState = useTicketCreateChat()

const {
  applySearch: applySearchBase,
  errorMessage,
  fetchNextPage,
  fetchTickets,
  filters,
  loading,
  loadingMore,
  pagination,
  searchInput,
  tickets,
} = useTicketList(userInfo)

const selectedTicketId = computed(() => Number(route.query.ticket || 0))
const selectedStatusValue = computed(() => filters.statuses[0] || '')
const quickStatusOptions = computed(() => [{ value: '', label: 'Tất cả' }, ...ticketStatusOptions])
const showSidebarPane = computed(() => {
  if (isCreatingTicket.value) return false
  return !selectedTicketId.value || mobileSidebarOpen.value
})
const showDetailPane = computed(() => {
  if (isCreatingTicket.value) return true
  return Boolean(selectedTicketId.value) && !mobileSidebarOpen.value
})
const currentUserId = computed(() => Number(userInfo.value?.id || 0))
const hasMoreTickets = computed(() => {
  if (!pagination.pageCount) return false
  return pagination.page < pagination.pageCount
})
const sidebarViewportRef = ref(null)

const tabTickets = computed(() => tickets.value)

function goToManagementMode() {
  router.push('/ticket')
}

function goToAddTicket() {
  const query = { ...route.query }
  delete query.ticket
  router.push({ path: '/ticket/inbox', query })
  
  isCreatingTicket.value = true
  chatState.resetState()
  mobileSidebarOpen.value = false
}

function handleCloseCreateTicket() {
  isCreatingTicket.value = false
}

function handleTicketCreatedFromChat(newTicketId) {
  isCreatingTicket.value = false
  openTicket(newTicketId)
  fetchTickets()
}

function openTicket(ticketId) {
  const nextId = Number(ticketId || 0)
  if (!nextId) return

  router.push({
    path: '/ticket/inbox',
    query: {
      ...route.query,
      ticket: String(nextId),
    },
  })

  mobileSidebarOpen.value = false
}

function openSidebarPane() {
  mobileSidebarOpen.value = true
}

function closeSidebarPane() {
  mobileSidebarOpen.value = false
}

function isSelectedTicket(ticketId) {
  return Number(ticketId || 0) === selectedTicketId.value
}

function latestActivityLabel(ticket) {
  return formatDateTime(ticket?.updatedAt || ticket?.createdAt)
}

function scrollSidebarToTop() {
  sidebarViewportRef.value?.scrollTo({ top: 0 })
}

async function ensureSidebarScrollable() {
  await nextTick()

  while (sidebarViewportRef.value && hasMoreTickets.value && sidebarViewportRef.value.scrollHeight <= sidebarViewportRef.value.clientHeight + 24) {
    await fetchNextPage()
    await nextTick()
  }
}

async function handleSidebarScroll(event) {
  const target = event?.target
  if (!target || loading.value || loadingMore.value || !hasMoreTickets.value) return

  const remaining = target.scrollHeight - target.scrollTop - target.clientHeight
  if (remaining > 160) return

  await fetchNextPage()
  await ensureSidebarScrollable()
}

function ticketAssignees(ticket) {
  const source = Array.isArray(ticket?.assignees) && ticket.assignees.length
    ? ticket.assignees
    : ticket?.assigned_to
      ? [ticket.assigned_to]
      : []

  const seen = new Set()
  return source
    .map((member, index) => {
      const id = Number(member?.id || 0)
      const name = String(member?.name || '').trim() || `#${id || index + 1}`
      const key = id > 0 ? `assignee-${id}` : `assignee-name-${name.toLowerCase()}`
      return { id, key, name }
    })
    .filter((member) => {
      if (seen.has(member.key)) return false
      seen.add(member.key)
      return true
    })
}

function ticketAssigneePreview(ticket) {
  return ticketAssignees(ticket).slice(0, 3)
}

function ticketAssigneeOverflowCount(ticket) {
  return Math.max(ticketAssignees(ticket).length - 3, 0)
}

function ticketAssigneeSummary(ticket) {
  const assignees = ticketAssignees(ticket)
  if (!assignees.length) return 'Chưa phân công'

  const containsCurrentUser = currentUserId.value > 0 && assignees.some((member) => member.id === currentUserId.value)
  if (containsCurrentUser) {
    return assignees.length > 1 ? `Bạn +${assignees.length - 1}` : 'Bạn đang xử lý'
  }

  return assignees.length > 1 ? `${assignees[0].name} +${assignees.length - 1}` : assignees[0].name
}

function ticketProcessingAlertCompactLabel(ticket) {
  const reason = String(ticket?.processing_alert_reason || '')
  if (reason === 'unconfirmed_over_2h') return '2h+'
  if (reason === 'confirmed_over_24h') return '24h+'
  return ''
}

async function applySearch() {
  await applySearchBase()
  await nextTick()
  scrollSidebarToTop()
  await ensureSidebarScrollable()
}

async function applyQuickStatus(value) {
  filters.statuses = value ? [value] : []
  pagination.page = 1
  await fetchTickets()
  await nextTick()
  scrollSidebarToTop()
  await ensureSidebarScrollable()
}

onMounted(async () => {
  pagination.pageSize = 20
  await fetchTickets()
  await ensureSidebarScrollable()
})

watch(
  () => selectedTicketId.value,
  (nextId) => {
    if (!nextId) return
    mobileSidebarOpen.value = false
    isCreatingTicket.value = false
  }
)
</script>

<template>
  <div class="h-full min-h-0 overflow-hidden">
    <section class="app-inbox-shell">
      <aside
        class="relative min-h-0 border-b border-[var(--stroke)] bg-white text-[var(--text-primary)] pc:border-b-0 pc:border-r pc:border-[var(--stroke)]"
        :class="showSidebarPane ? 'flex flex-col' : 'hidden pc:flex pc:flex-col'"
      >
        <div class="relative flex h-full min-h-0 flex-col">
          <div class="flex flex-col px-4 pt-4 tablet:px-5 tablet:pt-5">
            <div class="flex items-center justify-between gap-3">
              <div class="flex items-center gap-3 min-w-0">
                <button
                  type="button"
                  class="app-button-secondary inline-flex size-9 shrink-0 items-center justify-center rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--primary-soft)]"
                  aria-label="Quay lại quản lý ticket"
                  title="Quay lại quản lý ticket"
                  @click="goToManagementMode"
                >
                  <span class="material-symbols-outlined text-[18px]">arrow_back</span>
                </button>
                <h2 class="min-w-0 truncate text-lg font-semibold text-[var(--text-primary)]">Danh sách ticket</h2>
              </div>

              <div class="flex shrink-0 items-center gap-2">

                <div class="group relative">
                  <button
                    type="button"
                    class="inline-flex size-9 items-center justify-center rounded-xl text-[var(--text-secondary)] transition-colors hover:bg-[var(--primary-softer)] hover:text-[var(--text-primary)] focus:bg-[var(--primary-softer)] focus:text-[var(--text-primary)] focus:outline-hidden"
                    title="Tạo ticket mới"
                    aria-label="Tạo ticket mới"
                    @click="goToAddTicket"
                  >
                    <svg
                      class="size-[18px]"
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="2.1"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                    >
                      <path d="M12 5v14" />
                      <path d="M5 12h14" />
                    </svg>
                  </button>
                  <span class="pointer-events-none absolute right-0 top-full z-10 mt-2 hidden whitespace-nowrap rounded-md bg-[var(--primary)] px-2 py-1 text-[11px] font-medium text-white group-hover:block group-focus-within:block">
                    Tạo ticket mới
                  </span>
                </div>
              </div>
            </div>

            <div class="app-toolbar mt-4">
              <div class="relative min-w-0 flex-1">
                <input
                  v-model="searchInput"
                  type="text"
                  class="app-input h-11 w-full rounded-2xl pl-10 pr-3 text-sm"
                  placeholder="Tìm mã ticket hoặc tiêu đề"
                  @keyup.enter="applySearch"
                />
                <div class="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                  <svg class="size-4 text-[var(--text-muted)]" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor">
                    <path d="M11.742 10.344a6.5 6.5 0 1 0-1.397 1.398h-.001c.03.04.062.078.098.115l3.85 3.85a1 1 0 0 0 1.415-1.414l-3.85-3.85a1.007 1.007 0 0 0-.115-.1zM12 6.5a5.5 5.5 0 1 1-11 0 5.5 5.5 0 0 1 11 0z"/>
                  </svg>
                </div>
              </div>

              <button
                v-if="selectedTicketId"
                type="button"
                class="inline-flex h-11 w-full shrink-0 items-center justify-center rounded-2xl border border-[var(--stroke)] bg-white px-3 text-sm font-semibold text-[var(--text-secondary)] transition-colors hover:bg-[var(--surface-muted)] tablet:w-auto pc:hidden"
                @click="closeSidebarPane"
              >
                Đóng
              </button>
            </div>

            <div class="ticket-chip-scroll -mx-1 mt-3 flex gap-2 overflow-x-auto px-1 pb-1.5">
              <button
                v-for="status in quickStatusOptions"
                :key="status.value || 'all'"
                type="button"
                class="inline-flex shrink-0 items-center rounded-full px-3 py-1.5 text-xs font-semibold transition-colors"
                :class="selectedStatusValue === status.value ? 'border border-[var(--primary)] bg-[var(--primary)] text-white' : 'border border-[var(--stroke)] bg-white text-[var(--text-secondary)] hover:bg-[var(--surface-muted)]'"
                @click="applyQuickStatus(status.value)"
              >
                {{ status.label }}
              </button>
            </div>


          </div>

          <div
            ref="sidebarViewportRef"
            class="ticket-inbox-scrollbar min-h-0 flex-1 overflow-y-auto px-4 py-3 tablet:px-5"
            @scroll.passive="handleSidebarScroll"
          >
            <div v-if="errorMessage" class="app-state-banner">
              {{ errorMessage }}
            </div>

            <div v-else-if="loading" class="space-y-3">
              <div
                v-for="item in 6"
                :key="item"
                class="animate-pulse rounded-2xl border border-[var(--stroke)] bg-white px-4 py-3"
              >
                <div class="h-3 w-24 rounded bg-[var(--primary-soft)]"></div>
                <div class="mt-3 h-4 w-3/4 rounded bg-[var(--primary-soft)]"></div>
                <div class="mt-2 h-3 w-1/2 rounded bg-[var(--primary-soft)]"></div>
              </div>
            </div>

            <div v-else-if="tabTickets.length">
              <button
                v-for="ticket in tabTickets"
                :key="ticket.id"
                type="button"
                class="mb-3 flex w-full flex-col overflow-hidden rounded-2xl border px-4 py-3.5 text-left transition-colors last:mb-0"
                :class="isSelectedTicket(ticket.id) ? 'border-[var(--stroke-strong)] bg-[var(--surface-muted)]' : 'border-[var(--stroke)] bg-white hover:border-[var(--stroke-strong)] hover:bg-[var(--surface-muted)]'"
                @click="openTicket(ticket.id)"
              >
                <div class="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
                  <div class="min-w-0 pr-1">
                    <p class="truncate text-[11px] font-bold uppercase tracking-wide text-[var(--text-muted)]">
                      {{ ticket.ticket_code || `#${ticket.id}` }}
                    </p>
                    <p class="mt-1 line-clamp-2 text-sm font-semibold leading-5 text-[var(--text-primary)]">{{ ticket.title || '--' }}</p>
                  </div>

                  <div class="flex min-h-7 min-w-0 shrink-0 flex-wrap items-center justify-end gap-1.5 tablet:min-w-[9.5rem]">
                    <span
                      v-if="!ticketProcessingAlertCompactLabel(ticket)"
                      class="invisible inline-flex items-center rounded-full px-2 py-1 text-[11px] font-semibold"
                    >
                      24h+
                    </span>
                    <span class="app-badge inline-flex items-center rounded-full px-2 py-1 text-[11px] font-semibold" :class="ticketStatusClass(ticket.status)">
                      {{ normalizeTicketStatus(ticket.status) }}
                    </span>
                    <span
                      v-if="ticketProcessingAlertCompactLabel(ticket)"
                      class="app-badge app-badge--danger inline-flex items-center rounded-full px-2 py-1 text-[11px] font-semibold"
                      :title="ticketProcessingAlertHint(ticket)"
                    >
                      {{ ticketProcessingAlertCompactLabel(ticket) }}
                    </span>
                  </div>
                </div>

                <p class="mt-2 line-clamp-2 text-sm leading-5 text-[var(--text-secondary)]">{{ storeDisplay(ticket) }}</p>

                <div class="mt-3 flex flex-col gap-1.5 text-xs text-[var(--text-secondary)] tablet:flex-row tablet:items-center tablet:justify-between tablet:gap-2.5">
                  <p class="truncate">Người gửi: <span class="font-medium text-[var(--text-secondary)]">{{ requesterDisplay(ticket) }}</span></p>
                  <p class="shrink-0">{{ latestActivityLabel(ticket) }}</p>
                </div>

                <div class="mt-3 flex flex-col gap-2 tablet:flex-row tablet:items-center tablet:justify-between tablet:gap-3">
                  <div v-if="ticketAssigneePreview(ticket).length" class="flex min-w-0 items-center gap-2">
                    <div class="flex shrink-0 -space-x-2">
                      <span
                        v-for="member in ticketAssigneePreview(ticket)"
                        :key="member.key"
                        class="inline-flex size-6 items-center justify-center rounded-full border border-white bg-[var(--primary-soft)] text-[10px] font-semibold uppercase text-[var(--text-secondary)]"
                      >
                        {{ avatarInitials(member.name) }}
                      </span>
                      <span
                        v-if="ticketAssigneeOverflowCount(ticket)"
                        class="inline-flex size-6 items-center justify-center rounded-full border border-white bg-[var(--primary)] text-[10px] font-semibold text-white"
                      >
                        +{{ ticketAssigneeOverflowCount(ticket) }}
                      </span>
                    </div>

                    <p class="truncate text-xs text-[var(--text-secondary)]">
                      Xử lý:
                      <span class="font-medium text-[var(--text-secondary)]">{{ ticketAssigneeSummary(ticket) }}</span>
                    </p>
                  </div>

                  <p v-else class="truncate text-xs text-[var(--text-muted)]">Chưa phân công</p>
                </div>

              </button>
            </div>

            <div v-else class="flex h-full min-h-[320px] items-center justify-center px-6">
              <div class="app-state-panel app-state-panel--compact w-full max-w-sm">
                <div class="app-state-stack mx-auto">
                  <div class="app-state-icon mx-auto">
                    <span class="material-symbols-outlined text-[28px]">search_off</span>
                  </div>
                  <p class="app-state-title">Không có ticket phù hợp.</p>
                  <p class="app-state-body">Thử nới bộ lọc hoặc tìm theo từ khóa khác.</p>
                </div>
              </div>
            </div>

            <div v-if="loadingMore" class="app-state-inline mt-3 text-center text-xs font-medium">
              Đang tải thêm ticket...
            </div>
          </div>
        </div>
      </aside>

      <div class="relative min-h-0 overflow-hidden bg-white" :class="showDetailPane ? 'flex flex-col flex-1' : 'hidden pc:flex pc:flex-col pc:flex-1'">
        <TicketCreateChat 
          v-if="isCreatingTicket" 
          :chat-state="chatState" 
          @close="handleCloseCreateTicket" 
          @ticket-created="handleTicketCreatedFromChat" 
        />
        <template v-else>
          <div v-if="selectedTicketId" class="relative shrink-0 border-b border-[var(--stroke)] bg-white px-3 py-2 pc:hidden">
          <button
            type="button"
            class="app-button-secondary inline-flex min-h-9 items-center rounded-xl px-3 py-1.5 text-sm font-semibold"
            @click="openSidebarPane"
          >
            Danh sách ticket
          </button>
        </div>

        <div v-if="selectedTicketId" class="relative min-h-0 flex-1 flex flex-col p-0">
          <TicketDetailPage :id="selectedTicketId" embedded />
        </div>

        <div v-else class="relative flex h-full min-h-[520px] items-center justify-center px-6 py-8 tablet:px-8 pc:px-10 pc:py-10">
          <div class="mx-auto max-w-2xl text-center pc:mx-0 pc:text-left">
            <div class="inline-flex size-20 items-center justify-center rounded-[28px] bg-[var(--primary-softer)] text-[var(--text-secondary)]">
              <span class="material-symbols-outlined text-[40px]">forum</span>
            </div>

            <p class="mt-8 text-4xl font-semibold tracking-tight text-[var(--text-primary)] pc:text-5xl">
              Chọn ticket để bắt đầu theo dõi
            </p>
            <p class="mt-4 max-w-xl text-base leading-7 text-[var(--text-secondary)]">
              Bên trái là danh sách ticket hoạt động như một sidebar inbox: lọc nhanh, tìm kiếm tức thì và mở đúng ticket cần xử lý ngay trong cùng một workspace.
            </p>

            <div class="mt-6 flex flex-wrap justify-center gap-2 text-sm font-medium text-[var(--text-secondary)] pc:justify-start">
              <span class="rounded-full border border-[var(--stroke)] bg-white px-3 py-1.5">Tìm kiếm nhanh</span>
              <span class="rounded-full border border-[var(--stroke)] bg-white px-3 py-1.5">Lọc trạng thái</span>
              <span class="rounded-full border border-[var(--stroke)] bg-white px-3 py-1.5">Mở ticket tức thì</span>
            </div>
          </div>
        </div>
        </template>
      </div>
    </section>
  </div>
</template>

<style scoped>
.ticket-inbox-scrollbar {
  scrollbar-width: thin;
  scrollbar-color: #b8d7f4 transparent;
}

.ticket-inbox-scrollbar::-webkit-scrollbar {
  width: 8px;
}

.ticket-inbox-scrollbar::-webkit-scrollbar-track {
  background: transparent;
}

.ticket-inbox-scrollbar::-webkit-scrollbar-thumb {
  border-radius: 9999px;
  background-color: #b8d7f4;
}

.ticket-chip-scroll {
  scrollbar-width: none;
}

.ticket-chip-scroll::-webkit-scrollbar {
  display: none;
}
</style>
