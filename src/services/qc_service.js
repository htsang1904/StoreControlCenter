import getClient from './http'

const DEFAULT_PASS_THRESHOLD = 40
const INTERNAL_DEFAULT_TEMPLATE = { id: 'default', name: 'QC Form', version: '1.0' }
const http = getClient()

const toNumber = (value, fallback = 0) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

const clamp = (value, min, max) => Math.min(Math.max(value, min), max)

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
  if (normalized === 'point' || normalized === 'score') return 'point'
  return null
}

const normalizeCriterionFrequency = (value) => {
  const normalized = String(value || '').trim().toLowerCase()
  if (normalized === 'weekly_once' || normalized === 'weekly') return 'weekly_once'
  return 'per_audit'
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
    let maxScore = Math.max(toNumber(item?.maxScore), 0)
    if (mode === 'pass_fail' && maxScore <= 0) {
      maxScore = 1
    }

    const passScoreDefault = mode === 'point' ? maxScore : 1
    const passScore = clamp(
      toNumber(item?.passScore ?? item?.minPassScore ?? item?.pass_score, passScoreDefault),
      0,
      maxScore > 0 ? maxScore : passScoreDefault
    )

    const rawScore = item?.score
    const hasScore = rawScore !== null && rawScore !== undefined && String(rawScore) !== ''
    let score = null
    if (!explicitNonScoredStatus) {
      if (hasScore) {
        score = clamp(toNumber(rawScore), 0, maxScore)
      } else if (mode === 'pass_fail') {
        if (incomingStatus === 'pass') score = 1
        if (incomingStatus === 'fail') score = 0
      } else {
        if (incomingStatus === 'pass') score = maxScore
        if (incomingStatus === 'fail') score = 0
      }
    }

    let status = incomingStatus
    if (!explicitNonScoredStatus) {
      if (mode === 'point') {
        if (score !== null) {
          status = score >= passScore ? 'pass' : 'fail'
        } else if (!status) {
          status = 'pending'
        }
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
      passScore,
      critical: Boolean(item?.critical),
      applicable: item?.applicable !== false,
      frequency: normalizeCriterionFrequency(item?.frequency || item?.frequency_snapshot),
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

      if (item.mode === 'pass_fail') {
        const isPass = item.status === 'pass'
        const isFail = item.status === 'fail'
        acc.maxScore += 1

        if (!isPass && !isFail) {
          acc.incompleteCount += 1
          return acc
        }

        if (isPass) {
          acc.passedCount += 1
          acc.totalScore += 1
        } else {
          acc.failedCount += 1
          if (item.critical) acc.criticalFailedCount += 1
        }

        return acc
      }

      const hasScore = item.score !== null && item.score !== undefined
      const maxScore = Math.max(toNumber(item.maxScore), 0)
      const passScore = clamp(toNumber(item.passScore, maxScore), 0, maxScore)
      acc.maxScore += maxScore

      if (!hasScore) {
        acc.incompleteCount += 1
        return acc
      }

      const score = clamp(toNumber(item.score), 0, maxScore)
      const isPass = score >= passScore
      acc.totalScore += score

      if (isPass) {
        acc.passedCount += 1
      } else {
        acc.failedCount += 1
        if (item.critical) acc.criticalFailedCount += 1
      }

      return acc
    },
    {
      totalScore: 0,
      maxScore: 0,
      incompleteCount: 0,
      criticalFailedCount: 0,
      passedCount: 0,
      failedCount: 0,
      excludedCount: 0,
    }
  )

  const reasons = []
  if (metrics.incompleteCount > 0) reasons.push('incomplete')
  if (metrics.failedCount > 0) reasons.push('failed')
  if (metrics.criticalFailedCount > 0) reasons.push('critical')
  if (isBelowPassThreshold({ totalScore: metrics.totalScore, maxScore: metrics.maxScore, passThreshold: threshold })) {
    reasons.push('threshold')
  }

  const status = reasons.length === 0 ? 'passed' : 'failed'

  return {
    ...metrics,
    evaluationMode: 'mixed',
    passThreshold: threshold,
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
    createdAt: finding.createdAt || null,
    updatedAt: finding.updatedAt || null,
  }
}


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
    const maxScore = mode === 'pass_fail'
      ? 1
      : Math.max(toNumber(item?.max_score_snapshot || item?.maxScore), 0)
    const hasScore = item?.score !== null && item?.score !== undefined && String(item.score) !== ''

    return {
      id: String(item?.criterion_code || item?.id || `criterion-${index + 1}`),
      name: String(item?.criterion_name || item?.name || `Tiêu chí ${index + 1}`),
      category: String(item?.category || item?.categoryName || 'Tổng quát'),
      mode,
      status,
      score: hasScore ? toNumber(item.score) : null,
      maxScore,
      passScore: mode === 'pass_fail' ? 1 : maxScore,
      critical: Boolean(item?.critical),
      applicable: status !== 'na',
      frequency: normalizeCriterionFrequency(item?.frequency_snapshot || item?.frequency),
      note: String(item?.note || ''),
      attachments: normalizeCriterionAttachments(item?.attachments),
    }
  })
}

const deriveSessionDecisionReasons = ({ criteria = [], totalScore = 0, maxScore = 0, result = 'pending', passThreshold = 0 }) => {
  const reasons = []
  const hasPending = criteria.some((item) => item.status === 'pending')
  const hasFail = criteria.some((item) => item.status === 'fail')
  const belowThreshold = isBelowPassThreshold({ totalScore, maxScore, passThreshold })

  if (hasPending || result === 'pending') reasons.push('incomplete')
  if (hasFail || result === 'failed') reasons.push('failed')
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
      id: String(form?.code || session?.templateId || INTERNAL_DEFAULT_TEMPLATE.id),
      name: String(form?.name || session?.templateName || INTERNAL_DEFAULT_TEMPLATE.name),
      version: String(formVersion?.version_no || session?.templateVersion || INTERNAL_DEFAULT_TEMPLATE.version),
      passThreshold: templatePassThreshold,
    },
    templateId: String(form?.code || session?.templateId || INTERNAL_DEFAULT_TEMPLATE.id),
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
    failedCriticalCount: 0,
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
    auditedAt: auditedAtRaw ? parseDate(auditedAtRaw).toISOString() : null,
    note: String(draft?.note || ''),
    criteriaStates: normalizeDraftCriteriaStates(draft?.criteriaStates || draft?.criteria_states),
    createdAt: draft?.createdAt ? parseDate(draft.createdAt).toISOString() : null,
    updatedAt: draft?.updatedAt ? parseDate(draft.updatedAt).toISOString() : null,
  }
}

const normalizeOverviewPayloadFromApi = (payload = {}) => {
  const rawSessions = Array.isArray(payload?.sessions) ? payload.sessions : []
  const sessions = rawSessions.map((item, index) => normalizeSessionFromApi(item, index))
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
  const session = response?.data?.session
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
  pageSize = 100,
  fetchAll = false,
} = {}) => {
  const buildEndpoint = (nextPage) => {
    const queryString = toQueryString({
      page: nextPage,
      pageSize,
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
  let currentPage = Math.max(toNumber(page, 1), 1)
  let pageCount = 1

  while (currentPage <= pageCount) {
    const response = await http.get(buildEndpoint(currentPage))
    const normalized = normalizeOverviewPayloadFromApi(response?.data || {})

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
      pageSize,
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
      pageSize: toNumber(pageSize, 100),
      total: toNumber(base?.pagination?.total, allSessions.length),
      pageCount: toNumber(base?.pagination?.pageCount, allSessions.length > 0 ? 1 : 0),
    },
  }
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
    pageSize: options.pageSize ?? 200,
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
  lastAuditAt: item?.lastAuditedAt || item?.last_audited_at || null,
  lastAuditCode: item?.lastSessionCode || item?.last_session_code || '--',
  lastAuditResult: item?.lastAuditResult || item?.last_audit_result || null,
})

const normalizeStoresOverviewResponse = (response = {}) => {
  const payload = response?.data || {}
  const summary = payload?.summary || {}

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
      storeStats: Array.isArray(payload?.storeStats)
        ? payload.storeStats.map((item) => normalizeStoreOverviewStat(item))
        : [],
      pagination: payload?.pagination || {
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
  const forms = Array.isArray(response?.data?.items) ? response.data.items : []

  return forms.map((form) => ({
    id: String(form.id),
    code: String(form.code || ''),
    name: String(form.name || ''),
    description: String(form.description || ''),
    activeVersionId: form.activeVersionId || null,
  }))
}

export const getQcTemplateById = async (formId) => {
  const response = await http.get(`/api/qc/forms/${formId}`)
  const formData = response?.data?.item
  if (!formData) return null

  const flattened = Array.isArray(formData.criteria)
    ? formData.criteria.map((criterion) => ({
      id: criterion.id,
      code: criterion.code,
      name: criterion.name,
      description: criterion.description,
      level: criterion.level,
      ordering: criterion.ordering,
      parentId: criterion.parentId || null,
      mode: criterion.mode,
      maxScore: toNumber(criterion.maxScore),
      weight: toNumber(criterion.weight),
      sortOrder: criterion.sortOrder,
      isCritical: criterion.isCritical,
      frequency: criterion.frequency,
      required: criterion.required,
    }))
    : []

  // Build Hierarchy
  const buildTree = (items) => {
    const map = new Map()
    const roots = []

    items.forEach(item => {
      map.set(item.id, { ...item, children: [] })
    })

    items.forEach(item => {
      if (item.parentId && map.has(item.parentId)) {
        map.get(item.parentId).children.push(map.get(item.id))
      } else {
        roots.push(map.get(item.id))
      }
    })

    return roots.sort((a, b) => a.sortOrder - b.sortOrder)
  }

  return {
    id: String(formData.id),
    name: String(formData.name || ''),
    activeVersionId: toNumber(formData.activeVersionId) || null,
    version: String(formData.version || ''),
    passThreshold: normalizePassThreshold(formData.passThreshold),
    criteriaTree: buildTree(flattened),
    flatCriteria: flattened // Kept for legacy compatibility in some parts
  }
}

export const getQcStoresOverviewApi = async (params = {}) => {
  const queryString = toQueryString({
    page: params.page ?? 1,
    pageSize: params.pageSize ?? 1000,
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
    const rows = Array.isArray(response?.data?.drafts) ? response.data.drafts : []
    allRows.push(...rows)

    const pagination = response?.data?.pagination || {}
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
  const draft = response?.data?.draft
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
    auditedAt: String(payload.auditedAt || ''),
    note: String(payload.note || ''),
    criteriaStates: payload.criteriaStates || {},
  }

  const response = await http.post('/api/qc/drafts', requestBody)
  const created = response?.data?.draft
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
  const updated = response?.data?.draft
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
  const created = response?.data?.item
  return created ? normalizeFinding(created) : null
}

export const listQcFindings = async (params = {}) => {
  const query = {
    populate: '*',
    sort: 'createdAt:desc',
    ...params
  }
  const queryString = toQueryString(query)
  const response = await http.get(`/api/qc/findings?${queryString}`)
  const items = Array.isArray(response?.data?.items) ? response.data.items : []
  return items.map(item => normalizeFinding(item))
}

export const updateQcFinding = async (id, payload = {}) => {
  if (!id) return null
  const response = await http.put(`/api/qc/findings/${id}`, payload)
  const updated = response?.data?.item
  return updated ? normalizeFinding(updated) : null
}

export const qcHelpers = {
  toDateLabel,
  passThreshold: DEFAULT_PASS_THRESHOLD,
  evaluateSession,
}
