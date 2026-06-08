import { computed, ref } from 'vue'
import { getDefaultDateRange, normalizeDateRangeFromQuery } from '@/composables/useDateRange'
import { getDashboardOverview } from '@/services/ticket_service'

const numberFormatter = new Intl.NumberFormat('vi-VN')

function createEmptySummary() {
  return {
    total_ticket: 0,
    in_progress: 0,
    resolved: 0,
    overdue: 0,
  }
}

export function useTicketReportSummary() {
  const initialReportRange = getDefaultDateRange()
  const reportDateFrom = ref(initialReportRange.from)
  const reportDateTo = ref(initialReportRange.to)
  const reportSummary = ref(createEmptySummary())

  const reportSummaryCards = computed(() => [
    {
      key: 'total_ticket',
      label: 'Tổng ticket',
      value: numberFormatter.format(Number(reportSummary.value?.total_ticket || 0)),
      meta: 'Theo bộ lọc',
      hint: 'Tổng số ticket phát sinh theo bộ lọc hiện tại.',
      tone: 'sky',
    },
    {
      key: 'in_progress',
      label: 'Đang chờ hỗ trợ',
      value: numberFormatter.format(Number(reportSummary.value?.in_progress || 0)),
      meta: 'Cần ưu tiên',
      hint: 'Số ticket đang mở hoặc đang được xử lý, cần theo dõi tiến độ.',
      tone: 'amber',
    },
    {
      key: 'resolved',
      label: 'Đã hoàn thành',
      value: numberFormatter.format(Number(reportSummary.value?.resolved || 0)),
      meta: 'Đã đóng',
      hint: 'Số ticket đã hoàn tất xử lý trong phạm vi bộ lọc.',
      tone: 'emerald',
    },
    {
      key: 'overdue',
      label: 'Cần phản hồi',
      value: numberFormatter.format(Number(reportSummary.value?.overdue || 0)),
      meta: 'Quá hạn / sát hạn',
      hint: 'Số ticket đã quá hạn hoặc cần phản hồi gấp theo SLA.',
      tone: 'rose',
    },
  ])

  const storeIdsFilter = ref('')

  function syncReportRangeFromRoute(query = {}) {
    const range = normalizeDateRangeFromQuery(query, getDefaultDateRange())
    reportDateFrom.value = range.from
    reportDateTo.value = range.to
    storeIdsFilter.value = query.store_ids || ''
  }

  async function fetchTicketReports() {
    try {
      const result = await getDashboardOverview({
        date_from: reportDateFrom.value,
        date_to: reportDateTo.value,
        store_ids: storeIdsFilter.value || undefined,
        top_stores_limit: 20,
        activity_limit: 12,
      })
      
      const rootData = result?.data?.data || result?.data || result || {}
      
      const summaryPayload = rootData?.summary || {}
      
      reportSummary.value = {
        total_ticket: Number(summaryPayload.total_ticket || 0),
        in_progress: Number(summaryPayload.in_progress || 0),
        resolved: Number(summaryPayload.resolved || 0),
        overdue: Number(summaryPayload.overdue || 0)
      }
    } catch (err) {
      reportSummary.value = createEmptySummary()
    }
  }

  return {
    fetchTicketReports,
    reportSummaryCards,
    syncReportRangeFromRoute,
  }
}
