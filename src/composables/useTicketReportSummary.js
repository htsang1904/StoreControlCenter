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
      label: 'Tổng vé hôm nay',
      value: numberFormatter.format(Number(reportSummary.value?.total_ticket || 0)),
      meta: 'Theo bộ lọc',
      icon: 'list_alt',
      tone: 'sky',
    },
    {
      key: 'in_progress',
      label: 'Đang chờ hỗ trợ',
      value: numberFormatter.format(Number(reportSummary.value?.in_progress || 0)),
      meta: 'Cần ưu tiên',
      icon: 'support_agent',
      tone: 'amber',
    },
    {
      key: 'resolved',
      label: 'Đã hoàn thành',
      value: numberFormatter.format(Number(reportSummary.value?.resolved || 0)),
      meta: 'Đã đóng',
      icon: 'task_alt',
      tone: 'emerald',
    },
    {
      key: 'overdue',
      label: 'Cần phản hồi',
      value: numberFormatter.format(Number(reportSummary.value?.overdue || 0)),
      meta: 'Quá hạn / sát hạn',
      icon: 'timer',
      tone: 'rose',
    },
  ])

  function syncReportRangeFromRoute(query = {}) {
    const range = normalizeDateRangeFromQuery(query, getDefaultDateRange())
    reportDateFrom.value = range.from
    reportDateTo.value = range.to
  }

  async function fetchTicketReports() {
    try {
      const result = await getDashboardOverview({
        date_from: reportDateFrom.value,
        date_to: reportDateTo.value,
        top_stores_limit: 20,
        activity_limit: 12,
      })
      const payload = result?.data || result || {}
      reportSummary.value = payload?.summary || createEmptySummary()
    } catch {
      reportSummary.value = createEmptySummary()
    }
  }

  return {
    fetchTicketReports,
    reportSummaryCards,
    syncReportRangeFromRoute,
  }
}
