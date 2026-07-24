import getClient from './http'

const DEFAULT_PASS_THRESHOLD = 40
const INTERNAL_DEFAULT_TEMPLATE = { id: 'default', name: 'QC Form', version: '1.0' }
const QC_SESSIONS_OVERVIEW_MAX_PAGE_SIZE = 100
const QC_SESSIONS_OVERVIEW_DEFAULT_PAGE_SIZE = 100
const QC_STORES_OVERVIEW_MAX_PAGE_SIZE = 500
const QC_STORES_OVERVIEW_DEFAULT_PAGE_SIZE = 500
const http = getClient()

const toNumber = (value, fallback = 0) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

const clamp = (value, min, max) => Math.min(Math.max(value, min), max)

const orderingToParts = (value) => String(value || '')
  .split('.')
  .map((part) => String(part || '').trim().toUpperCase())
  .filter(Boolean)

const compareOrderingPart = (leftPart, rightPart) => {
  const isLeftNumeric = /^\d+$/.test(leftPart)
  const isRightNumeric = /^\d+$/.test(rightPart)

  if (isLeftNumeric && isRightNumeric) {
    return Number(leftPart) - Number(rightPart)
  }

  return leftPart.localeCompare(rightPart, 'en', {
    numeric: true,
    sensitivity: 'base',
  })
}

const compareOrdering = (left, right) => {
  const leftParts = orderingToParts(left)
  const rightParts = orderingToParts(right)
  const maxLength = Math.max(leftParts.length, rightParts.length)

  for (let index = 0; index < maxLength; index += 1) {
    const diff = compareOrderingPart(leftParts[index] || '', rightParts[index] || '')
    if (diff !== 0) return diff
  }

  return 0
}

const compareCriteriaOrder = (left, right) => (
  compareOrdering(left?.ordering, right?.ordering)
  || toNumber(left?.sortOrder) - toNumber(right?.sortOrder)
  || toNumber(left?.id) - toNumber(right?.id)
)

const normalizePassThreshold = (value, fallback = DEFAULT_PASS_THRESHOLD) => {
  if (value === undefined || value === null || String(value).trim() === '') {
    return clamp(toNumber(fallback, DEFAULT_PASS_THRESHOLD), 0, 100)
  }

  return clamp(toNumber(value, fallback), 0, 100)
}

const getRequiredScoreFromThreshold = ({ maxScore = 0, passThreshold = DEFAULT_PASS_THRESHOLD } = {}) => {
  const normalizedMaxScore = Math.max(toNumber(maxScore), 0)
  if (normalizedMaxScore <= 0) return 0

  return (normalizedMaxScore * normalizePassThreshold(passThreshold)) / 100
}

const isBelowPassThreshold = ({ totalScore = 0, maxScore = 0, passThreshold = DEFAULT_PASS_THRESHOLD } = {}) => {
  const normalizedMaxScore = Math.max(toNumber(maxScore), 0)
  if (normalizedMaxScore <= 0) return false

  return toNumber(totalScore) < getRequiredScoreFromThreshold({ maxScore: normalizedMaxScore, passThreshold })
}

const normalizeCriterionStatus = (value) => {
  const normalized = String(value || '').trim().toLowerCase()
  if (normalized === 'pass' || normalized === 'passed') return 'pass'
  if (normalized === 'fail' || normalized === 'failed') return 'fail'
  if (normalized === 'na' || normalized === 'not_applicable') return 'na'
  if (normalized === 'skipped_weekly' || normalized === 'weekly_skipped') return 'skipped_weekly'
  if (normalized === 'pending') return 'pending'
  return null
}

const normalizeCriterionMode = (value) => {
  const normalized = String(value || '').trim().toLowerCase()
  if (normalized === 'pass_fail' || normalized === 'passfail' || normalized === 'binary') return 'pass_fail'
  if (normalized === 'deduction' || normalized === 'deduct') return 'deduction'
  if (normalized === 'point' || normalized === 'score') return 'point'
  return null
}

const normalizeCriterionAttachments = (attachments = []) => {
  const source = Array.isArray(attachments) ? attachments : []

  return source
    .map((item, index) => ({
      id: String(item?.id || `attachment-${index + 1}`),
      name: String(item?.name || `image-${index + 1}`),
      type: String(item?.type || 'image/*'),
      size: Math.max(toNumber(item?.size), 0),
      previewUrl: String(item?.previewUrl || item?.url || item?.dataUrl || '').trim(),
      preview: String(item?.preview || item?.previewUrl || item?.url || item?.dataUrl || '').trim(),
      url: String(item?.url || item?.previewUrl || item?.dataUrl || '').trim(),
    }))
    .filter((item) => item.previewUrl || item.preview || item.url)
}

const canUseStorage = () => typeof window !== 'undefined' && typeof window.localStorage !== 'undefined'

const safeParseList = (raw) => {
  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch (_error) {
    return []
  }
}

const parseDate = (value, fallback = new Date()) => {
  const date = value ? new Date(value) : new Date(fallback)
  return Number.isNaN(date.getTime()) ? new Date(fallback) : date
}

const toDateLabel = (value) => {
  const date = parseDate(value)
  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

const buildSessionCode = (date, seq) => {
  const safeDate = parseDate(date)
  const year = String(safeDate.getFullYear()).slice(-2)
  const month = String(safeDate.getMonth() + 1).padStart(2, '0')
  return `QC-${year}${month}-${String(seq).padStart(4, '0')}`
}


const normalizeCriteria = (criteria = []) => {
  const source = Array.isArray(criteria) ? criteria : []
  return source.map((item, index) => {
    const mode = normalizeCriterionMode(item?.mode || item?.scoreType) || 'point'
    const incomingStatus = normalizeCriterionStatus(item?.status)
    const explicitNonScoredStatus = incomingStatus === 'na' || incomingStatus === 'skipped_weekly'
    const maxScore = mode === 'deduction' ? 0 : Math.max(toNumber(item?.maxScore, mode === 'pass_fail' ? 1 : 0), 0)
    const minPassScore = mode === 'point' ? clamp(toNumber(item?.minPassScore ?? item?.min_pass_score ?? (maxScore / 2)), 0, maxScore) : 0
    const deductionPercent = mode === 'deduction'
      ? clamp(toNumber(item?.deductionPercent ?? item?.deduction_percent ?? item?.maxScore), 0, 100)
      : 0

    const rawScore = item?.score
    const hasScore = rawScore !== null && rawScore !== undefined && String(rawScore) !== ''
    let score = null
    if (!explicitNonScoredStatus) {
      if (hasScore) {
        score = clamp(toNumber(rawScore), 0, maxScore)
      } else if (mode === 'pass_fail') {
        if (incomingStatus === 'pass') score = maxScore
        if (incomingStatus === 'fail') score = 0
      }
    }

    let status = incomingStatus
    if (!explicitNonScoredStatus) {
      if (mode === 'point') {
        status = score === null ? 'pending' : (score >= minPassScore ? 'pass' : 'fail')
      } else if (!status) {
        status = 'pending'
      }
    }

    return {
      id: String(item?.id || `criterion-${index + 1}`),
      name: String(item?.name || `Tiêu chí ${index + 1}`),
      category: String(item?.category || item?.categoryName || 'Tổng quát'),
      mode,
      status,
      score,
      maxScore,
      minPassScore,
      deductionPercent,
      applicable: item?.applicable !== false,
      note: String(item?.note || '').trim(),
      attachments: normalizeCriterionAttachments(item?.attachments),
    }
  })
}

const normalizeTemplate = (payload = {}) => {
  const template = payload?.template || {}
  const passThreshold = normalizePassThreshold(
    payload?.templatePassThreshold ??
    template?.passThreshold ??
    payload?.passThreshold
  )

  return {
    id: String(payload?.templateId || template?.id || INTERNAL_DEFAULT_TEMPLATE.id),
    name: String(payload?.templateName || template?.name || INTERNAL_DEFAULT_TEMPLATE.name),
    version: String(payload?.templateVersion || template?.version || INTERNAL_DEFAULT_TEMPLATE.version),
    passThreshold,
  }
}

const evaluateSession = ({ criteria = [], passThreshold = DEFAULT_PASS_THRESHOLD }) => {
  const normalizedCriteria = normalizeCriteria(criteria)
  const threshold = normalizePassThreshold(passThreshold)

  const metrics = normalizedCriteria.reduce(
    (acc, item) => {
      const isExcluded = item.applicable === false || item.status === 'na' || item.status === 'skipped_weekly'
      if (isExcluded) {
        acc.excludedCount += 1
        return acc
      }

      if (item.mode === 'deduction') {
        const isPass = item.status === 'pass'
        const isFail = item.status === 'fail'
        if (!isPass && !isFail) {
          acc.incompleteCount += 1
          return acc
        }
        if (isPass) acc.passedCount += 1
        if (isFail) {
          acc.failedCount += 1
          acc.totalDeduction += item.deductionPercent
        }
        return acc
      }

      if (item.mode === 'pass_fail') {
        const isPass = item.status === 'pass'
        const isFail = item.status === 'fail'
        acc.maxScore += item.maxScore

        if (!isPass && !isFail) {
          acc.incompleteCount += 1
          return acc
        }

        if (isPass) {
          acc.passedCount += 1
          acc.totalScore += item.maxScore
        } else {
          acc.failedCount += 1
        }

        return acc
      }

      const hasScore = item.score !== null && item.score !== undefined
      const maxScore = Math.max(toNumber(item.maxScore), 0)
      acc.maxScore += maxScore

      if (!hasScore) {
        acc.incompleteCount += 1
        return acc
      }

      const score = clamp(toNumber(item.score), 0, maxScore)
      acc.totalScore += score
      if (item.status === 'fail') {
        acc.failedCount += 1
      } else {
        acc.passedCount += 1
      }

      return acc
    },
    {
      totalScore: 0,
      maxScore: 0,
      incompleteCount: 0,
      passedCount: 0,
      failedCount: 0,
      excludedCount: 0,
      totalDeduction: 0,
    }
  )

  const reasons = []
  if (metrics.incompleteCount > 0) reasons.push('incomplete')
  const baseScoreRate = metrics.maxScore > 0 ? (metrics.totalScore / metrics.maxScore) * 100 : 0
  const totalDeduction = clamp(metrics.totalDeduction, 0, 100)
  const finalScoreRate = Math.max(baseScoreRate - totalDeduction, 0)
  if (metrics.maxScore <= 0 || finalScoreRate < threshold) reasons.push('threshold')

  const status = reasons.length === 0 ? 'passed' : 'failed'

  return {
    ...metrics,
    evaluationMode: 'mixed',
    passThreshold: threshold,
    baseScoreRate,
    totalDeduction,
    finalScoreRate,
    reasons,
    status,
  }
}


const normalizeFinding = (finding = {}) => {
  return {
    id: String(finding.id || ''),
    findingCode: finding.findingCode || finding.finding_code || '',
    sessionId: finding.session?.id || finding.session_id || null,
    sessionItemId: finding.session_item?.id || finding.session_item_id || null,
    storeId: finding.store?.id || finding.store_id || null,
    criterionName: finding.criterionName || finding.criterion_name || '',
    severity: finding.severity || 'medium',
    status: finding.status || 'open',
    assignee: finding.assignee || null,
    dueDate: finding.due_date || null,
    correctiveAction: finding.correctiveAction || finding.corrective_action || '',
    correctiveNote: finding.correctiveNote || finding.corrective_note || '',
    resolvedAt: finding.resolved_at || null,
    verifiedAt: finding.verified_at || null,
    verifier: finding.verifier || null,
    evidence: Array.isArray(finding.evidence) ? finding.evidence : [],
    metaInfo: finding.metaInfo || finding.meta_info || {},
    createdAt: finding.createdAt || null,
    updatedAt: finding.updatedAt || null,
  }
}

const unwrapQcFindingPayload = (response) => (
  response?.data && typeof response.data === 'object'
    ? response.data
    : response
)

const unwrapQcFindingListPayload = (response) => (
  Array.isArray(response?.data)
    ? response.data
    : Array.isArray(response)
      ? response
      : []
)


const resolveStoreName = (store) => {
  return (
    store?.shortAddress ||
    store?.address ||
    store?.name ||
    store?.code ||
    `Cửa hàng #${store?.id || store?.storeId || '--'}`
  )
}



const toQueryString = (params = {}) => {
  const searchParams = new URLSearchParams()

  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || String(value).trim() === '') return
    searchParams.append(key, String(value))
  })

  return searchParams.toString()
}

const toApiSessionStatus = (value) => {
  const normalized = String(value || '').trim().toLowerCase()
  if (normalized === 'passed' || normalized === 'pass') return 'pass'
  if (normalized === 'failed' || normalized === 'fail') return 'fail'
  if (normalized === 'pending') return 'pending'
  return ''
}

const toClientSessionStatus = (value) => {
  const normalized = String(value || '').trim().toLowerCase()
  if (normalized === 'pass' || normalized === 'passed') return 'passed'
  if (normalized === 'fail' || normalized === 'failed') return 'failed'
  if (normalized === 'pending') return 'pending'
  return 'failed'
}

const normalizeCriteriaFromApi = (items = []) => {
  const source = Array.isArray(items) ? items : []
  return source.map((item, index) => {
    const mode = normalizeCriterionMode(item?.mode_snapshot || item?.mode || item?.scoreType) || 'point'
    const status = normalizeCriterionStatus(item?.result || item?.status) || 'pending'
    const maxScore = mode === 'deduction'
      ? 0
      : Math.max(toNumber(item?.max_score_snapshot || item?.maxScore, mode === 'pass_fail' ? 1 : 0), 0)
    const hasScore = item?.score !== null && item?.score !== undefined && String(item.score) !== ''
    const minPassScore = mode === 'point'
      ? clamp(toNumber(item?.min_pass_score_snapshot ?? item?.minPassScore ?? (maxScore / 2)), 0, maxScore)
      : 0

    return {
      id: String(item?.criterion_code || item?.id || `criterion-${index + 1}`),
      name: String(item?.criterion_name || item?.name || `Tiêu chí ${index + 1}`),
      category: String(item?.category || item?.categoryName || 'Tổng quát'),
      mode,
      status,
      score: hasScore ? toNumber(item.score) : null,
      maxScore,
      minPassScore,
      deductionPercent: mode === 'deduction'
        ? toNumber(item?.deduction_percent_snapshot ?? item?.deductionPercent ?? item?.deduction_percent ?? item?.max_score_snapshot ?? item?.maxScore, 0)
        : 0,
      applicable: status !== 'na',
      note: String(item?.note || ''),
      attachments: normalizeCriterionAttachments(item?.attachments),
    }
  })
}

const deriveSessionDecisionReasons = ({ criteria = [], totalScore = 0, maxScore = 0, result = 'pending', passThreshold = 0 }) => {
  const reasons = []
  const hasPending = criteria.some((item) => item.status === 'pending')
  const belowThreshold = isBelowPassThreshold({ totalScore, maxScore, passThreshold })

  if (hasPending || result === 'pending') reasons.push('incomplete')
  if (result === 'failed') reasons.push('failed')
  if (belowThreshold) reasons.push('threshold')

  return Array.from(new Set(reasons))
}

const normalizeSessionFromApi = (session = {}, fallbackIndex = 0) => {
  const criteria = normalizeCriteriaFromApi(session?.items)
  const passCount = criteria.filter((item) => item.status === 'pass').length
  const failCount = criteria.filter((item) => item.status === 'fail').length
  const incompleteCriteria = criteria.filter((item) => item.status === 'pending').length

  const formVersion = session?.form_version || {}
  const form = formVersion?.form || {}
  const templatePassThreshold = normalizePassThreshold(
    formVersion?.pass_rule?.passThreshold ?? formVersion?.pass_rule?.pass_threshold
  )

  const totalScore = toNumber(session?.total_score ?? session?.totalScore)
  const maxScore = toNumber(session?.max_score ?? session?.maxScore)
  const result = toClientSessionStatus(session?.result)
  const decisionReasons = deriveSessionDecisionReasons({
    criteria,
    totalScore,
    maxScore,
    result,
    passThreshold: templatePassThreshold,
  })

  const createdAt = parseDate(session?.createdAt || session?.audited_at).toISOString()
  const auditedAt = parseDate(session?.audited_at || session?.auditedAt || createdAt).toISOString()

  return {
    id: String(session?.id || `session-${Date.parse(createdAt)}-${fallbackIndex + 1}`),
    code: String(session?.code || buildSessionCode(createdAt, fallbackIndex + 1)),
    storeId: toNumber(session?.store?.id || session?.storeId || session?.store_id),
    storeName: resolveStoreName(session?.store || { id: session?.storeId || session?.store_id }),
    auditorId: session?.auditor?.id ?? session?.auditorId ?? null,
    auditorName: String(session?.auditor?.name || session?.auditorName || session?.auditor?.email || ''),
    template: {
      id: String(form?.id || session?.templateId || INTERNAL_DEFAULT_TEMPLATE.id),
      code: String(form?.code || session?.templateCode || ''),
      name: String(form?.name || session?.templateName || INTERNAL_DEFAULT_TEMPLATE.name),
      version: String(formVersion?.version_no || session?.templateVersion || INTERNAL_DEFAULT_TEMPLATE.version),
      passThreshold: templatePassThreshold,
    },
    formId: toNumber(form?.id || session?.formId || session?.form_id),
    templateId: String(form?.id || session?.templateId || INTERNAL_DEFAULT_TEMPLATE.id),
    templateCode: String(form?.code || session?.templateCode || ''),
    templateName: String(form?.name || session?.templateName || INTERNAL_DEFAULT_TEMPLATE.name),
    templateVersion: String(formVersion?.version_no || session?.templateVersion || INTERNAL_DEFAULT_TEMPLATE.version),
    templatePassThreshold: templatePassThreshold,
    criteria,
    totalScore,
    maxScore,
    result,
    evaluationMode: 'mixed',
    passCount,
    failCount,
    incompleteCriteria,
    decisionReasons,
    note: String(session?.note || ''),
    auditedAt,
    createdAt,
    updatedAt: parseDate(session?.updatedAt || createdAt).toISOString(),
  }
}

const normalizeDraftCriteriaStates = (value = {}) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {}
  }

  return Object.entries(value).reduce((acc, [criterionId, state]) => {
    acc[String(criterionId)] = {
      status: normalizeCriterionStatus(state?.status) || 'pending',
      score: state?.score === null || state?.score === undefined || String(state?.score) === ''
        ? null
        : toNumber(state.score),
      note: String(state?.note || ''),
      attachments: normalizeCriterionAttachments(state?.attachments),
    }
    return acc
  }, {})
}

const normalizeDraft = (draft = {}) => {
  const storeId = toNumber(draft?.storeId || draft?.store_id)
  const auditedAtRaw = draft?.auditedAt || draft?.audited_at

  return {
    id: String(draft?.id || ''),
    storeId,
    storeNo: String(draft?.storeNo || draft?.store_no || ''),
    storeCode: String(draft?.storeCode || draft?.store_code || ''),
    storeName: String(draft?.storeName || draft?.store_name || (storeId > 0 ? `Cửa hàng #${storeId}` : '')),
    templateId: String(draft?.templateId || draft?.template_id || ''),
    formVersionId: toNumber(draft?.formVersionId || draft?.form_version_id) || null,
    auditedAt: auditedAtRaw ? parseDate(auditedAtRaw).toISOString() : null,
    note: String(draft?.note || ''),
    criteriaStates: normalizeDraftCriteriaStates(draft?.criteriaStates || draft?.criteria_states),
    createdAt: draft?.createdAt ? parseDate(draft.createdAt).toISOString() : null,
    updatedAt: draft?.updatedAt ? parseDate(draft.updatedAt).toISOString() : null,
  }
}

const normalizeFindingStatusSummary = (value = {}) => {
  const source = value && typeof value === 'object' && !Array.isArray(value) ? value : {}
  return {
    open: toNumber(source.open),
    inProgress: toNumber(source.in_progress ?? source.inProgress),
    resolved: toNumber(source.resolved),
    rejected: toNumber(source.rejected),
    verified: toNumber(source.verified),
  }
}

const normalizeOverviewPayloadFromApi = (payload = {}) => {
  const rawSessions = Array.isArray(payload?.data) ? payload.data : []
  const sessions = rawSessions.map((item, index) => ({
    ...normalizeSessionFromApi(item, index),
    openFindings: toNumber(item?.openFindings ?? item?.open_findings),
    findingStatusSummary: normalizeFindingStatusSummary(item?.findingStatusSummary || item?.finding_status_summary),
  }))
  const sourceSummary = payload?.summary || {}
  const totalSessions = toNumber(sourceSummary?.totalSessions, sessions.length)
  const avgScore = toNumber(sourceSummary?.avgScore)
  const avgScoreRate = toNumber(sourceSummary?.scoreRate ?? sourceSummary?.avgScoreRate)

  let avgMaxScore = toNumber(sourceSummary?.avgMaxScore)
  if (!avgMaxScore && avgScoreRate > 0) {
    avgMaxScore = Math.round((avgScore / (avgScoreRate / 100)) * 10) / 10
  }

  return {
    sessions,
    summary: {
      totalSessions,
      passed: toNumber(sourceSummary?.passed),
      failed: toNumber(sourceSummary?.failed),
      avgScore,
      avgMaxScore,
      avgScoreRate,
      passRate: toNumber(sourceSummary?.passRate),
    },
    pagination: {
      page: toNumber(payload?.pagination?.page, 1),
      pageSize: toNumber(payload?.pagination?.pageSize, sessions.length),
      total: toNumber(payload?.pagination?.total, sessions.length),
      pageCount: toNumber(payload?.pagination?.pageCount, sessions.length > 0 ? 1 : 0),
    },
  }
}





export const createQcSession = async (payload = {}) => {
  const formVersionId = toNumber(payload.formVersionId || payload.form_version_id)
  const requestBody = {
    storeId: toNumber(payload.storeId || payload.store_id),
    formVersionId,
    note: String(payload.note || ''),
    auditedAt: payload.auditedAt || payload.audited_at || new Date().toISOString(),
    criteria: Array.isArray(payload.criteria)
      ? payload.criteria.map((criterion = {}) => ({
        ...criterion,
        attachments: normalizeCriterionAttachments(criterion?.attachments),
      }))
      : [],
  }

  if (!Number.isInteger(formVersionId) || formVersionId <= 0) {
    throw new Error('formVersionId không hợp lệ')
  }

  if (!Number.isInteger(requestBody.storeId) || requestBody.storeId <= 0) {
    throw new Error('storeId không hợp lệ')
  }

  const response = await http.post('/api/qc/sessions/create', requestBody)
  const session = response?.data?.data || response?.data
  if (!session) {
    throw new Error('Không thể tạo phiên QC')
  }

  return normalizeSessionFromApi(session)
}


export const listQcSessionsApi = async ({
  storeId,
  q = '',
  status = '',
  from = '',
  to = '',
  templateId = '',
  page = 1,
  pageSize = QC_SESSIONS_OVERVIEW_DEFAULT_PAGE_SIZE,
  fetchAll = false,
} = {}) => {
  const normalizedPage = Math.max(toNumber(page, 1), 1)
  const normalizedPageSize = clamp(
    Math.trunc(toNumber(pageSize, QC_SESSIONS_OVERVIEW_DEFAULT_PAGE_SIZE)),
    1,
    QC_SESSIONS_OVERVIEW_MAX_PAGE_SIZE
  )

  const buildEndpoint = (nextPage) => {
    const queryString = toQueryString({
      page: nextPage,
      pageSize: normalizedPageSize,
      store_id: storeId || '',
      q,
      status: toApiSessionStatus(status),
      date_from: from,
      date_to: to,
      template_id: templateId,
    })

    return queryString
      ? `/api/qc/sessions/overview?${queryString}`
      : '/api/qc/sessions/overview'
  }

  const allSessions = []
  let firstPayload = null
  let currentPage = normalizedPage
  let pageCount = 1

  while (currentPage <= pageCount) {
    const response = await http.get(buildEndpoint(currentPage))
    const normalized = normalizeOverviewPayloadFromApi(response || {})

    if (!firstPayload) {
      firstPayload = normalized
    }

    allSessions.push(...normalized.sessions)
    pageCount = Math.max(toNumber(normalized?.pagination?.pageCount, 1), 1)

    if (!fetchAll) {
      return normalized
    }

    currentPage += 1
  }

  const base = firstPayload || {
    summary: {
      totalSessions: 0,
      passed: 0,
      failed: 0,
      avgScore: 0,
      avgMaxScore: 0,
      avgScoreRate: 0,
      passRate: 0,
    },
    pagination: {
      page: 1,
      pageSize: normalizedPageSize,
      total: 0,
      pageCount: 0,
    },
  }

  return {
    summary: base.summary,
    sessions: allSessions,
    pagination: {
      ...base.pagination,
      page: 1,
      pageSize: normalizedPageSize,
      total: toNumber(base?.pagination?.total, allSessions.length),
      pageCount: toNumber(base?.pagination?.pageCount, allSessions.length > 0 ? 1 : 0),
    },
  }
}

export const deleteQcSession = async (sessionId) => {
  if (!sessionId) return null
  const response = await http.delete(`/api/qc/sessions/${encodeURIComponent(String(sessionId))}`)
  return response?.data
}

export const getQcSessionApi = async (sessionId) => {
  if (!sessionId) return null
  const response = await http.get(`/api/qc/sessions/${encodeURIComponent(String(sessionId))}`)
  const rawSession = response?.data || {}
  return normalizeSessionFromApi(rawSession)
}

export const getQcStoreOverviewApi = async (storeId, options = {}) => {
  const payload = await listQcSessionsApi({
    storeId,
    q: options.q || '',
    status: options.status || '',
    from: options.from || '',
    to: options.to || '',
    templateId: options.templateId || '',
    page: options.page ?? 1,
    pageSize: options.pageSize ?? QC_SESSIONS_OVERVIEW_DEFAULT_PAGE_SIZE,
    fetchAll: Boolean(options.fetchAll),
  })

  return {
    summary: payload.summary,
    sessions: payload.sessions,
    pagination: payload.pagination,
  }
}

const normalizeStoreOverviewStat = (item = {}) => ({
  storeId: toNumber(item?.storeId || item?.store_id),
  storeEntityId: toNumber(item?.storeEntityId || item?.store_entity_id || item?.storeId || item?.store_id),
  storeNo: String(item?.storeNo || item?.store_no || ''),
  storeCode: String(item?.storeCode || item?.store_code || ''),
  storeName: String(item?.storeName || item?.store_name || ''),
  address: String(item?.address || ''),
  totalSessions: toNumber(item?.totalSessions),
  passed: toNumber(item?.passed),
  failed: toNumber(item?.failed),
  avgScore: toNumber(item?.avgScore),
  avgMaxScore: toNumber(item?.avgMaxScore),
  avgScoreRate: toNumber(item?.scoreRate ?? item?.avgScoreRate),
  passRate: toNumber(item?.passRate),
  openFindings: toNumber(item?.openFindings ?? item?.open_findings),
  activeFindingSessions: toNumber(item?.activeFindingSessions ?? item?.active_finding_sessions),
  findingStatusSummary: normalizeFindingStatusSummary(item?.findingStatusSummary || item?.finding_status_summary),
  lastAuditAt: item?.lastAuditedAt || item?.last_audited_at || null,
  lastAuditCode: item?.lastSessionCode || item?.last_session_code || '--',
  lastAuditResult: item?.lastAuditResult || item?.last_audit_result || null,
})

const normalizeStoresOverviewResponse = (response = {}) => {
  const storeStats = Array.isArray(response?.data) ? response.data : []
  const summary = response?.summary || {}

  return {
    success: response?.success !== false,
    message: response?.message || '',
    data: {
      summary: {
        totalSessions: toNumber(summary?.totalSessions),
        passed: toNumber(summary?.passed),
        failed: toNumber(summary?.failed),
        avgScore: toNumber(summary?.avgScore),
        avgMaxScore: toNumber(summary?.avgMaxScore),
        avgScoreRate: toNumber(summary?.scoreRate ?? summary?.avgScoreRate),
        passRate: toNumber(summary?.passRate),
      },
      storeStats: storeStats.map((item) => normalizeStoreOverviewStat(item)),
      pagination: response?.pagination || {
        page: 1,
        pageSize: 0,
        total: 0,
        pageCount: 0,
      },
    },
  }
}

/**
 * Templates (Data-Driven from Backend)
 */

export const listQcTemplates = async () => {
  const response = await http.get('/api/qc/forms')
  const forms = Array.isArray(response?.data) ? response.data : []

  return forms.map((form) => ({
    id: String(form.id),
    code: String(form.code || ''),
    name: String(form.name || ''),
    description: String(form.description || ''),
    activeVersionId: form.activeVersionId || null,
  }))
}

export const getQcTemplateById = async (formId, options = {}) => {
  const formVersionId = toNumber(options.formVersionId || options.form_version_id)
  const queryString = toQueryString({
    formVersionId: formVersionId > 0 ? formVersionId : '',
  })
  const response = await http.get(queryString ? `/api/qc/forms/${formId}?${queryString}` : `/api/qc/forms/${formId}`)
  const formData = response?.data
  if (!formData) return null

  const flattened = Array.isArray(formData.criteria)
    ? formData.criteria.map((criterion) => {
      const criterionId = String(criterion.id || '').trim()
      const parentId = criterion.parentId === null || criterion.parentId === undefined || String(criterion.parentId).trim() === ''
        ? null
        : String(criterion.parentId).trim()

      const mode = normalizeCriterionMode(criterion.mode || criterion.default_mode || criterion.mode_snapshot || criterion.scoreType) || 'point'

      return {
        id: criterionId,
        code: criterion.code,
        name: criterion.name,
        description: criterion.description,
        level: criterion.level,
        ordering: criterion.ordering,
        orderingLabel: criterion.orderingLabel || criterion.ordering_label || '',
        parentId,
        nodeType: String(criterion.nodeType || criterion.node_type || '').trim() || '',
        mode,
        maxScore: toNumber(criterion.maxScore),
        minPassScore: mode === 'point'
          ? clamp(toNumber(criterion.minPassScore ?? criterion.min_pass_score ?? (toNumber(criterion.maxScore) / 2)), 0, toNumber(criterion.maxScore))
          : 0,
        deductionPercent: toNumber(criterion.deductionPercent ?? criterion.deduction_percent ?? (mode === 'deduction' ? criterion.maxScore : 0), 0),
        sortOrder: criterion.sortOrder,
      }
    }).filter((criterion) => criterion.id)
    : []

  // Build Hierarchy
  const buildTree = (items) => {
    const map = new Map()
    const roots = []

    items.forEach(item => {
      map.set(String(item.id), { ...item, children: [] })
    })

    items.forEach(item => {
      const itemId = String(item.id)
      const parentId = item.parentId ? String(item.parentId) : ''

      if (parentId && map.has(parentId)) {
        map.get(parentId).children.push(map.get(itemId))
      } else {
        roots.push(map.get(itemId))
      }
    })

    const sortNodes = (nodes = []) => nodes
      .sort(compareCriteriaOrder)
      .map((node) => ({
        ...node,
        children: sortNodes(node.children),
      }))

    return sortNodes(roots)
  }

  const orderedFlatCriteria = [...flattened].sort(compareCriteriaOrder)

  return {
    id: String(formData.id),
    name: String(formData.name || ''),
    activeVersionId: toNumber(formData.activeVersionId) || null,
    version: String(formData.version || ''),
    passThreshold: normalizePassThreshold(formData.passThreshold),
    criteriaTree: buildTree(orderedFlatCriteria),
    flatCriteria: orderedFlatCriteria // Kept for legacy compatibility in some parts
  }
}

export const getQcStoresOverviewApi = async (params = {}) => {
  const normalizedPage = Math.max(toNumber(params.page, 1), 1)
  const normalizedPageSize = clamp(
    Math.trunc(toNumber(params.pageSize, QC_STORES_OVERVIEW_DEFAULT_PAGE_SIZE)),
    1,
    QC_STORES_OVERVIEW_MAX_PAGE_SIZE
  )

  const queryString = toQueryString({
    page: normalizedPage,
    pageSize: normalizedPageSize,
    date_from: params.from || '',
    date_to: params.to || '',
    q: params.q || '',
    sort_by: params.sortBy || '',
    sort_dir: params.sortDir || '',
    store_ids: Array.isArray(params.storeIds) && params.storeIds.length > 0
      ? params.storeIds.join(',')
      : '',
  })

  const endpoint = queryString
    ? `/api/qc/stores/overview?${queryString}`
    : '/api/qc/stores/overview'

  const response = await http.get(endpoint)
  return normalizeStoresOverviewResponse(response)
}

const normalizeDraftFromApi = (draft = {}) => normalizeDraft({
  id: draft?.id,
  storeId: draft?.storeId || draft?.store_id,
  storeName: draft?.storeName || draft?.store_name,
  templateId: draft?.templateId || draft?.template_id,
  formVersionId: draft?.formVersionId || draft?.form_version_id,
  auditedAt: draft?.auditedAt || draft?.audited_at,
  note: draft?.note,
  criteriaStates: draft?.criteriaStates || draft?.criteria_states,
  createdAt: draft?.createdAt,
  updatedAt: draft?.updatedAt,
})

export const listQcDraftSessions = async ({ storeId, page = 1, pageSize = 100, withPagination = false, fetchAll = false } = {}) => {
  const buildEndpoint = (nextPage) => {
    const queryString = toQueryString({
      store_id: storeId || '',
      page: nextPage,
      pageSize,
    })

    return queryString
      ? `/api/qc/drafts?${queryString}`
      : '/api/qc/drafts'
  }

  const allRows = []
  let currentPage = Math.max(toNumber(page, 1), 1)
  let pageCount = 1
  let lastPagination = {
    page: currentPage,
    pageSize: toNumber(pageSize, 100),
    total: 0,
    pageCount: 0,
  }

  while (currentPage <= pageCount) {
    const response = await http.get(buildEndpoint(currentPage))
    const rows = Array.isArray(response?.data) ? response.data : []
    allRows.push(...rows)

    const pagination = response?.pagination || {}
    pageCount = Math.max(toNumber(pagination?.pageCount, 1), 1)
    lastPagination = {
      page: toNumber(pagination?.page, currentPage),
      pageSize: toNumber(pagination?.pageSize, pageSize),
      total: toNumber(pagination?.total, allRows.length),
      pageCount: toNumber(pagination?.pageCount, pageCount),
    }

    if (!fetchAll) break
    currentPage += 1
  }

  const drafts = allRows.map((item) => normalizeDraftFromApi(item))
  if (!withPagination) return drafts

  return {
    drafts,
    pagination: lastPagination,
  }
}

export const getQcDraftSessionById = async (draftId) => {
  if (!draftId) return null
  const response = await http.get(`/api/qc/drafts/${encodeURIComponent(String(draftId))}`)
  const draft = response?.data
  if (!draft) return null
  return normalizeDraftFromApi(draft)
}

export const createQcDraftSession = async (payload = {}) => {
  const storeId = toNumber(payload.storeId || payload.store_id)
  if (!Number.isInteger(storeId) || storeId <= 0) {
    throw new Error('storeId không hợp lệ')
  }

  const requestBody = {
    storeId,
    storeName: String(payload.storeName || payload.store_name || ''),
    templateId: String(payload.templateId || payload.template_id || ''),
    formVersionId: toNumber(payload.formVersionId || payload.form_version_id) || undefined,
    auditedAt: String(payload.auditedAt || ''),
    note: String(payload.note || ''),
    criteriaStates: payload.criteriaStates || {},
  }

  const response = await http.post('/api/qc/drafts', requestBody)
  const created = response?.data
  if (!created) {
    throw new Error('Không thể tạo phiếu nháp')
  }

  return normalizeDraftFromApi(created)
}

export const updateQcDraftSession = async (draftId, payload = {}) => {
  if (!draftId) return null

  const requestBody = {
    storeId: payload.storeId || payload.store_id,
    storeName: payload.storeName || payload.store_name,
    templateId: payload.templateId || payload.template_id,
    formVersionId: payload.formVersionId || payload.form_version_id,
    auditedAt: payload.auditedAt || payload.audited_at,
    note: payload.note,
    criteriaStates: payload.criteriaStates || payload.criteria_states,
  }

  Object.keys(requestBody).forEach((key) => {
    if (requestBody[key] === undefined) {
      delete requestBody[key]
    }
  })

  const response = await http.put(`/api/qc/drafts/${encodeURIComponent(String(draftId))}`, requestBody)
  const updated = response?.data
  if (!updated) return null

  return normalizeDraftFromApi(updated)
}

export const deleteQcDraftSession = async (draftId) => {
  if (!draftId) return false
  const response = await http.delete(`/api/qc/drafts/${encodeURIComponent(String(draftId))}`)
  return Boolean(response?.success)
}

/**
 * Findings (Manual/Corrective Actions)
 */

export const createQcFinding = async (payload = {}) => {
  const response = await http.post('/api/qc/findings', payload)
  const created = unwrapQcFindingPayload(response)
  return created ? normalizeFinding(created) : null
}

export const listQcFindings = async (params = {}) => {
  const query = {
    populate: '*',
    sort: 'createdAt:desc',
    ...params
  }
  const queryString = toQueryString(query)
  const endpoint = queryString ? `/api/qc/findings/?${queryString}` : '/api/qc/findings/'
  const response = await http.get(endpoint)
  const items = unwrapQcFindingListPayload(response)
  return items.map(item => normalizeFinding(item))
}

export const getQcFindingById = async (id) => {
  if (!id) return null
  const response = await http.get(`/api/qc/findings/${encodeURIComponent(String(id))}`)
  const finding = unwrapQcFindingPayload(response)
  return finding ? normalizeFinding(finding) : null
}

export const updateQcFinding = async (id, payload = {}) => {
  if (!id) return null
  const response = await http.put(`/api/qc/findings/${id}`, payload)
  const updated = unwrapQcFindingPayload(response)
  return updated ? normalizeFinding(updated) : null
}

export const startQcFinding = async (id) => {
  if (!id) return null
  const response = await http.post(`/api/qc/findings/${id}/start`)
  const updated = unwrapQcFindingPayload(response)
  return updated ? normalizeFinding(updated) : null
}

export const resolveQcFinding = async (id, payload = {}) => {
  if (!id) return null
  const response = await http.post(`/api/qc/findings/${id}/resolve`, payload)
  const updated = unwrapQcFindingPayload(response)
  return updated ? normalizeFinding(updated) : null
}

export const verifyQcFinding = async (id, payload = {}) => {
  if (!id) return null
  const response = await http.post(`/api/qc/findings/${id}/verify`, payload)
  const updated = unwrapQcFindingPayload(response)
  return updated ? normalizeFinding(updated) : null
}

export const rejectQcFinding = async (id, payload = {}) => {
  if (!id) return null
  const response = await http.post(`/api/qc/findings/${id}/reject`, payload)
  const updated = unwrapQcFindingPayload(response)
  return updated ? normalizeFinding(updated) : null
}

export const uploadQcFindingEvidence = async (formData) => {
  const response = await http.post('/api/qc/findings/upload-evidence', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  })
  const files = response?.data?.files || response?.files || []
  return Array.isArray(files) ? files : []
}

export const qcHelpers = {
  toDateLabel,
  passThreshold: DEFAULT_PASS_THRESHOLD,
  evaluateSession,
}
