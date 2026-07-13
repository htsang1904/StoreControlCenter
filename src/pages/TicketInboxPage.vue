<script setup>
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import TicketDetailPage from '@/pages/TicketDetailPage.vue'
import TicketCreateChat from '@/components/ticket-chat-create/TicketCreateChat.vue'
import { useTicketCreateChat } from '@/composables/useTicketCreateChat'
import { useTicketList } from '@/composables/useTicketList'
import {
  formatDateTime,
  normalizeTicketStatus,
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
const sidebarCollapsed = ref(false)
const ticketInfoPanelOpen = ref(false)
const isCreatingTicket = ref(false)
const chatState = useTicketCreateChat()

const {
  applySearch: applySearchBase,
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
const hasMoreTickets = computed(() => {
  if (!pagination.pageCount) return false
  return pagination.page < pagination.pageCount
})
const effectiveSidebarCollapsed = computed(() => sidebarCollapsed.value || ticketInfoPanelOpen.value)
const chipScrollRef = ref(null)
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

function toggleSidebarCollapsed() {
  if (ticketInfoPanelOpen.value) {
    ticketInfoPanelOpen.value = false
    sidebarCollapsed.value = false
    return
  }

  sidebarCollapsed.value = !sidebarCollapsed.value
}

function handleTicketInfoPanelChange(isOpen) {
  ticketInfoPanelOpen.value = Boolean(isOpen)
  if (!ticketInfoPanelOpen.value) return

  sidebarCollapsed.value = true
  mobileSidebarOpen.value = false
}

function isSelectedTicket(ticketId) {
  return Number(ticketId || 0) === selectedTicketId.value
}

function ticketCreatedAtLabel(ticket) {
  return formatDateTime(ticket?.created_at || ticket?.createdAt)
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

function ticketProcessingAlertCompactLabel(ticket) {
  const reason = String(ticket?.processing_alert_reason || '')
  if (reason === 'unconfirmed_over_2h') return '2h+'
  if (reason === 'confirmed_over_24h') return '24h+'
  return ''
}

function handleChipWheel(event) {
  const target = event?.currentTarget
  if (!target || Math.abs(event.deltaX) >= Math.abs(event.deltaY)) return
  if (target.scrollWidth <= target.clientWidth) return

  event.preventDefault()
  target.scrollLeft += event.deltaY
}

async function applySearch() {
  await applySearchBase()
  await nextTick()
  scrollSidebarToTop()
  await ensureSidebarScrollable()
}

async function applyQuickStatus(value, event) {
  const selectedChip = event?.currentTarget || null
  filters.statuses = value ? [value] : []
  pagination.page = 1
  await fetchTickets()
  await nextTick()
  centerSelectedStatusChip(selectedChip)
  scrollSidebarToTop()
  await ensureSidebarScrollable()
}

function centerSelectedStatusChip(selectedChip) {
  const container = chipScrollRef.value
  if (!container || !selectedChip) return

  const targetLeft = selectedChip.offsetLeft - (container.clientWidth - selectedChip.offsetWidth) / 2
  container.scrollTo({ left: Math.max(0, targetLeft), behavior: 'smooth' })
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
    <section class="app-inbox-shell ticket-inbox-shell" :class="effectiveSidebarCollapsed ? 'ticket-inbox-shell--collapsed' : ''">
      <aside
        class="relative min-h-0 border-b border-[var(--stroke)] bg-white text-[var(--text-primary)] transition-[width] duration-200 pc:border-b-0 pc:border-r pc:border-[var(--stroke)]"
        :class="[
          showSidebarPane ? 'flex flex-col' : 'hidden pc:flex pc:flex-col',
          'pc:w-full pc:shrink-0'
        ]"
      >
        <div class="relative flex h-full min-h-0 flex-col">
          <div class="flex flex-col px-4 pt-4 tablet:px-5 tablet:pt-5" :class="effectiveSidebarCollapsed ? 'pc:px-2' : ''">
            <div class="flex items-center justify-between gap-3" :class="effectiveSidebarCollapsed ? 'pc:justify-center' : ''">
              <div class="flex min-w-0 items-center gap-3" :class="effectiveSidebarCollapsed ? 'pc:justify-center' : ''">
                <button
                  type="button"
                  class="hidden size-9 shrink-0 items-center justify-center rounded-lg border border-[var(--stroke)] bg-white text-[var(--text-secondary)] transition-colors hover:bg-[var(--surface-muted)] hover:text-[var(--text-primary)] focus:bg-[var(--surface-muted)] focus:text-[var(--text-primary)] focus:outline-hidden pc:inline-flex"
                  :title="effectiveSidebarCollapsed ? 'Mở rộng danh sách ticket' : 'Thu gọn danh sách ticket'"
                  :aria-label="effectiveSidebarCollapsed ? 'Mở rộng danh sách ticket' : 'Thu gọn danh sách ticket'"
                  @click="toggleSidebarCollapsed"
                >
                  <span class="material-symbols-outlined text-[18px]">{{ effectiveSidebarCollapsed ? 'keyboard_double_arrow_right' : 'keyboard_double_arrow_left' }}</span>
                </button>
                <button
                  type="button"
                  class="inline-flex size-9 shrink-0 items-center justify-center rounded-lg text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)] focus:outline-hidden pc:hidden"
                  title="Quay về quản lý ticket"
                  aria-label="Quay về quản lý ticket"
                  @click="goToManagementMode"
                >
                  <span class="material-symbols-outlined text-[20px]">arrow_back</span>
                </button>
                <Transition name="ticket-sidebar-fade">
                  <h2 v-if="!effectiveSidebarCollapsed" class="min-w-0 truncate text-base font-semibold text-[var(--text-primary)]">Danh sách ticket</h2>
                </Transition>
              </div>

              <Transition name="ticket-sidebar-fade">
                <div v-if="!effectiveSidebarCollapsed" class="flex shrink-0 items-center gap-1.5">
                <div class="group relative">
                  <button
                    type="button"
                    class="inline-flex size-9 items-center justify-center rounded-lg border border-[var(--stroke)] bg-white text-[var(--text-secondary)] transition-colors hover:bg-[var(--surface-muted)] hover:text-[var(--text-primary)] focus:bg-[var(--surface-muted)] focus:text-[var(--text-primary)] focus:outline-hidden"
                    title="Tạo ticket mới"
                    aria-label="Tạo ticket mới"
                    @click="goToAddTicket"
                  >
                    <svg
                      class="size-[17px]"
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
              </Transition>
            </div>

            <Transition name="ticket-sidebar-fade">
            <div v-if="!effectiveSidebarCollapsed" class="app-toolbar mt-4">
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
            </div>
            </Transition>

            <Transition name="ticket-sidebar-fade">
            <div
              v-if="!effectiveSidebarCollapsed"
              ref="chipScrollRef"
              class="ticket-chip-scroll -mx-1 mt-3 flex gap-2 overflow-x-auto px-1 pb-1.5"
              @wheel="handleChipWheel"
            >
              <button
                v-for="status in quickStatusOptions"
                :key="status.value || 'all'"
                type="button"
                class="inline-flex shrink-0 items-center rounded-full px-3 py-1.5 text-xs font-semibold transition-colors"
                :class="selectedStatusValue === status.value ? 'border border-[var(--primary)] bg-[var(--primary)] text-white' : 'border border-[var(--stroke)] bg-white text-[var(--text-secondary)] hover:bg-[var(--surface-muted)]'"
                @click="applyQuickStatus(status.value, $event)"
              >
                {{ status.label }}
              </button>
            </div>
            </Transition>


          </div>

          <div
            ref="sidebarViewportRef"
            class="ticket-inbox-scrollbar relative min-h-0 flex-1 overflow-y-auto px-4 py-3 tablet:px-5"
            :class="effectiveSidebarCollapsed ? 'pc:px-2' : ''"
            @scroll.passive="handleSidebarScroll"
          >
            <div
              v-if="loading && tabTickets.length"
              class="pointer-events-none sticky top-0 z-10 -mx-1 mb-2 flex justify-center"
            >
              <span class="inline-flex items-center gap-2 rounded-full border border-[var(--stroke)] bg-white/95 px-3 py-1.5 text-xs font-semibold text-[var(--text-secondary)] shadow-sm backdrop-blur">
                <span class="inline-block size-3 animate-spin rounded-full border-2 border-[var(--primary-soft)] border-t-[var(--primary)]"></span>
                Đang cập nhật
              </span>
            </div>

            <div v-if="loading && !tabTickets.length" class="space-y-3">
              <div
                v-for="item in 6"
                :key="item"
                class="rounded-2xl border border-[var(--stroke)] bg-white px-4 py-3"
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
                class="mb-2.5 flex w-full flex-col overflow-hidden rounded-2xl border px-3.5 py-3 text-left transition-colors last:mb-0"
                :title="effectiveSidebarCollapsed ? `${ticket.ticket_code || `#${ticket.id}`} - ${ticket.title || '--'}\n${storeDisplay(ticket)}\n${ticketCreatedAtLabel(ticket)}` : undefined"
                :class="[
                  isSelectedTicket(ticket.id) ? 'border-[var(--stroke-strong)] bg-[var(--surface-muted)]' : 'border-[var(--stroke)] bg-white hover:border-[var(--stroke-strong)] hover:bg-[var(--surface-muted)]',
                  effectiveSidebarCollapsed ? 'pc:items-center pc:rounded-xl' : ''
                ]"
                @click="openTicket(ticket.id)"
              >
                <div v-if="effectiveSidebarCollapsed" class="flex w-full flex-col items-center gap-1.5 text-center">
                  <span class="w-full truncate text-[10px] font-bold uppercase tracking-wide text-[var(--text-secondary)]">
                    {{ ticket.ticket_code || `#${ticket.id}` }}
                  </span>
                  <span class="inline-flex size-2.5 rounded-full" :class="ticketStatusClass(ticket.status)"></span>
                  <span
                    v-if="ticketProcessingAlertCompactLabel(ticket)"
                    class="app-badge app-badge--danger inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-semibold"
                    :title="ticketProcessingAlertHint(ticket)"
                  >
                    {{ ticketProcessingAlertCompactLabel(ticket) }}
                  </span>
                </div>

                <template v-else>
                <div class="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
                  <div class="min-w-0 pr-1">
                    <p class="truncate text-[11px] font-bold uppercase tracking-wide text-[var(--text-muted)]">
                      {{ ticket.ticket_code || `#${ticket.id}` }}
                    </p>
                    <p class="mt-1 line-clamp-2 text-sm font-semibold leading-5 text-[var(--text-primary)]">{{ ticket.title || '--' }}</p>
                  </div>

                  <div class="flex min-w-0 shrink-0 flex-wrap items-center justify-end gap-1.5">
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

                <div class="mt-2 flex min-w-0 items-center justify-between gap-3 text-xs text-[var(--text-secondary)]">
                  <p class="min-w-0 truncate">{{ storeDisplay(ticket) }}</p>
                  <p class="shrink-0 whitespace-nowrap text-[var(--text-muted)]">{{ ticketCreatedAtLabel(ticket) }}</p>
                </div>
                </template>

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
        <div v-if="selectedTicketId" class="relative min-h-0 flex-1 flex flex-col p-0">
          <TicketDetailPage
            :id="selectedTicketId"
            :ticket-info-panel-open="ticketInfoPanelOpen"
            embedded
            @ticket-info-panel-change="handleTicketInfoPanelChange"
            @open-ticket-list="openSidebarPane"
          />
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

.ticket-inbox-shell {
  transition: grid-template-columns 220ms ease;
}

.ticket-sidebar-fade-enter-active,
.ticket-sidebar-fade-leave-active {
  overflow: hidden;
  transition: opacity 140ms ease, transform 140ms ease, max-width 180ms ease, max-height 180ms ease;
}

.ticket-sidebar-fade-enter-from,
.ticket-sidebar-fade-leave-to {
  max-width: 0;
  max-height: 0;
  opacity: 0;
  transform: translateX(-0.25rem);
}

.ticket-sidebar-fade-enter-to,
.ticket-sidebar-fade-leave-from {
  max-width: 32rem;
  max-height: 8rem;
  opacity: 1;
  transform: translateX(0);
}

@media (min-width: 1024px) {
  .ticket-inbox-shell--collapsed {
    grid-template-columns: 4rem minmax(0, 1fr);
  }
}
</style>
