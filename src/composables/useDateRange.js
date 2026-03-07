const DEFAULT_RECENT_RANGE_DAYS = 6

export function toIsoDate(date) {
  const normalized = new Date(date.getTime() - date.getTimezoneOffset() * 60000)
  return normalized.toISOString().slice(0, 10)
}

export function shiftDate(days, baseDate = new Date()) {
  const nextDate = new Date(baseDate)
  nextDate.setDate(nextDate.getDate() + days)
  return nextDate
}

export function shiftIsoDate(days, baseDate = new Date()) {
  return toIsoDate(shiftDate(days, baseDate))
}

export function isValidYmd(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ''))) return false
  const date = new Date(`${value}T00:00:00`)
  return !Number.isNaN(date.getTime())
}

export function getDefaultDateRange(days = DEFAULT_RECENT_RANGE_DAYS) {
  return {
    from: shiftIsoDate(-days),
    to: shiftIsoDate(0),
  }
}

export function normalizeDateRangeFromQuery(query = {}, fallback = getDefaultDateRange()) {
  const from = isValidYmd(query?.date_from) ? String(query.date_from) : fallback.from
  const to = isValidYmd(query?.date_to) ? String(query.date_to) : fallback.to

  if (from > to) return fallback
  return { from, to }
}

export function getTodayDateRange(baseDate = new Date()) {
  const date = new Date(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate())
  const day = toIsoDate(date)
  return { from: day, to: day }
}

export function getThisMonthDateRange(baseDate = new Date()) {
  return {
    from: toIsoDate(new Date(baseDate.getFullYear(), baseDate.getMonth(), 1)),
    to: toIsoDate(new Date(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate())),
  }
}

export { DEFAULT_RECENT_RANGE_DAYS }
