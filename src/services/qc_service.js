import getClient from './http'

const STORAGE_KEY = 'qc_sessions_v2'
const LEGACY_STORAGE_KEY = 'qc_sessions_v1'
const DRAFT_STORAGE_KEY = 'qc_session_drafts_v1'
const DEFAULT_PASS_THRESHOLD = 40
const http = getClient()

const DEFAULT_TEMPLATE = {
  id: 'default',
  name: 'QC Tổng quát',
  version: 'v1.0',
  passThreshold: DEFAULT_PASS_THRESHOLD,
}

const MOCK_AUDITORS = [
  { id: 101, name: 'Nguyen Minh Quan' },
  { id: 102, name: 'Tran Thu Ha' },
  { id: 103, name: 'Le Bao Chau' },
]

const MOCK_TEMPLATE_LIBRARY = {
  ticket_standard: {
    id: 'ticket_standard',
    name: 'QC Ticket chuẩn',
    version: 'v1.0',
    passThreshold: 36,
    categories: [
      {
        id: 'ops',
        name: 'Vận hành quầy',
        criteria: [
          { id: 'ops-1', name: 'Quầy sạch, không vật cản', maxScore: 10, critical: true },
          { id: 'ops-2', name: 'Nhân sự đúng vị trí', maxScore: 8, critical: false },
          { id: 'ops-3', name: 'Checklist mở ca đầy đủ', maxScore: 7, critical: false },
        ],
      },
      {
        id: 'service',
        name: 'Dịch vụ khách hàng',
        criteria: [
          { id: 'svc-1', name: 'Chào hỏi đúng quy trình', maxScore: 8, critical: false },
          { id: 'svc-2', name: 'Tư vấn đúng thông tin', maxScore: 9, critical: true },
          { id: 'svc-3', name: 'Xử lý khiếu nại tại quầy', maxScore: 8, critical: true },
        ],
      },
    ],
  },
  food_safety: {
    id: 'food_safety',
    name: 'QC An toàn vệ sinh',
    version: 'v2.1',
    passThreshold: 42,
    categories: [
      {
        id: 'hygiene',
        name: 'Vệ sinh khu vực',
        criteria: [
          { id: 'hyg-1', name: 'Sàn và bề mặt không bẩn', maxScore: 10, critical: true },
          { id: 'hyg-2', name: 'Dụng cụ vệ sinh đúng nơi', maxScore: 7, critical: false },
          { id: 'hyg-3', name: 'Thùng rác đúng quy chuẩn', maxScore: 8, critical: true },
        ],
      },
      {
        id: 'storage',
        name: 'Bảo quản hàng',
        criteria: [
          { id: 'sto-1', name: 'Nhiệt độ tủ bảo quản đạt chuẩn', maxScore: 10, critical: true },
          { id: 'sto-2', name: 'Hàng hóa theo FIFO', maxScore: 8, critical: false },
          { id: 'sto-3', name: 'Tem nhãn và hạn dùng rõ ràng', maxScore: 8, critical: true },
        ],
      },
    ],
  },
  visual_merch: {
    id: 'visual_merch',
    name: 'QC Trưng bày hàng hóa',
    version: 'v1.3',
    passThreshold: 34,
    categories: [
      {
        id: 'display',
        name: 'Trưng bày chính',
        criteria: [
          { id: 'dis-1', name: 'Bố cục theo planogram', maxScore: 10, critical: true },
          { id: 'dis-2', name: 'Mặt hàng chủ lực đủ số lượng', maxScore: 8, critical: false },
          { id: 'dis-3', name: 'Giá kệ sạch và đồng bộ', maxScore: 7, critical: false },
        ],
      },
      {
        id: 'branding',
        name: 'Nhận diện thương hiệu',
        criteria: [
          { id: 'bra-1', name: 'POSM đúng chuẩn chiến dịch', maxScore: 7, critical: false },
          { id: 'bra-2', name: 'Biển hiệu đúng guideline', maxScore: 9, critical: true },
          { id: 'bra-3', name: 'Không có vật phẩm sai quy chuẩn', maxScore: 8, critical: true },
        ],
      },
    ],
  },
}

const MOCK_SCENARIOS = [
  {
    templateId: 'ticket_standard',
    mode: 'perfect',
    dayOffset: -20,
    note: 'Ca sáng vận hành đúng checklist.',
  },
  {
    templateId: 'food_safety',
    mode: 'critical_fail',
    dayOffset: -13,
    note: 'Khu vực kho lạnh chưa đạt tiêu chuẩn.',
  },
  {
    templateId: 'visual_merch',
    mode: 'threshold_fail',
    dayOffset: -7,
    note: 'Trưng bày chưa đồng bộ chiến dịch hiện tại.',
  },
  {
    templateId: 'ticket_standard',
    mode: 'borderline_pass',
    dayOffset: -2,
    note: 'Đạt ngưỡng tối thiểu, cần theo dõi thêm.',
  },
]

const toNumber = (value, fallback = 0) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

const clamp = (value, min, max) => Math.min(Math.max(value, min), max)

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
    }))
    .filter((item) => item.previewUrl)
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

const flattenTemplateCriteria = (template = DEFAULT_TEMPLATE) => {
  const categories = Array.isArray(template.categories) ? template.categories : []
  return categories.flatMap((category) => {
    const criteria = Array.isArray(category.criteria) ? category.criteria : []
    return criteria.map((criterion) => ({
      id: criterion.id,
      name: criterion.name,
      category: category.name,
      mode: normalizeCriterionMode(criterion.mode) || 'point',
      maxScore: toNumber(criterion.maxScore),
      passScore: toNumber(criterion.passScore ?? criterion.maxScore),
      critical: Boolean(criterion.critical),
      applicable: criterion.applicable !== false,
      frequency: normalizeCriterionFrequency(criterion.frequency || criterion.ruleType),
    }))
  })
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
  const passThreshold = Math.max(
    toNumber(
      payload?.templatePassThreshold ??
      template?.passThreshold ??
      payload?.passThreshold ??
      DEFAULT_PASS_THRESHOLD
    ),
    0
  )

  return {
    id: String(payload?.templateId || template?.id || DEFAULT_TEMPLATE.id),
    name: String(payload?.templateName || template?.name || DEFAULT_TEMPLATE.name),
    version: String(payload?.templateVersion || template?.version || DEFAULT_TEMPLATE.version),
    passThreshold,
  }
}

const evaluateSession = ({ criteria = [], passThreshold = DEFAULT_PASS_THRESHOLD }) => {
  const normalizedCriteria = normalizeCriteria(criteria)
  const threshold = Math.max(toNumber(passThreshold, DEFAULT_PASS_THRESHOLD), 0)

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
  if (metrics.maxScore > 0 && metrics.totalScore < threshold) reasons.push('threshold')

  const status = reasons.length === 0 ? 'passed' : 'failed'

  return {
    ...metrics,
    evaluationMode: 'mixed',
    passThreshold: threshold,
    reasons,
    status,
  }
}

const normalizeSession = (session = {}, fallbackIndex = 0) => {
  const template = normalizeTemplate(session)
  const criteria = normalizeCriteria(session.criteria)
  const evaluation = evaluateSession({
    criteria,
    passThreshold: template.passThreshold,
  })

  const createdAt = parseDate(session.createdAt || session.auditedAt).toISOString()
  const auditedAt = parseDate(session.auditedAt || session.createdAt || createdAt).toISOString()

  return {
    id: String(session.id || `${Date.parse(createdAt)}-${fallbackIndex + 1}`),
    code: String(session.code || buildSessionCode(createdAt, fallbackIndex + 1)),
    storeId: toNumber(session.storeId || session.store_id),
    storeName: String(session.storeName || session.store_name || ''),
    auditorId: session.auditorId ?? session.auditor_id ?? null,
    auditorName: String(session.auditorName || session.auditor_name || ''),
    template,
    templateId: template.id,
    templateName: template.name,
    templateVersion: template.version,
    templatePassThreshold: template.passThreshold,
    criteria,
    totalScore: evaluation.totalScore,
    maxScore: evaluation.maxScore,
    result: evaluation.status,
    evaluationMode: evaluation.evaluationMode,
    passCount: evaluation.passedCount,
    failCount: evaluation.failedCount,
    failedCriticalCount: evaluation.criticalFailedCount,
    incompleteCriteria: evaluation.incompleteCount,
    decisionReasons: evaluation.reasons,
    note: String(session.note || '').trim(),
    auditedAt,
    createdAt,
    updatedAt: parseDate(session.updatedAt || createdAt).toISOString(),
  }
}

const normalizeSessionList = (sessions = []) => {
  const source = Array.isArray(sessions) ? sessions : []
  return source
    .map((item, index) => normalizeSession(item, index))
    .sort((a, b) => parseDate(a.createdAt).getTime() - parseDate(b.createdAt).getTime())
}

const readStoredSessions = () => {
  if (!canUseStorage()) return []

  const currentRaw = window.localStorage.getItem(STORAGE_KEY)
  if (currentRaw) {
    return normalizeSessionList(safeParseList(currentRaw))
  }

  const legacyRaw = window.localStorage.getItem(LEGACY_STORAGE_KEY)
  if (!legacyRaw) return []

  const migrated = normalizeSessionList(safeParseList(legacyRaw))
  if (migrated.length > 0) {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated))
  }

  return migrated
}

const writeStoredSessions = (sessions = []) => {
  if (!canUseStorage()) return
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(normalizeSessionList(sessions)))
}

const normalizeDraftCriteriaStates = (criteriaStates = {}) => {
  const source = criteriaStates && typeof criteriaStates === 'object' ? criteriaStates : {}
  const entries = Object.entries(source)

  return entries.reduce((acc, [criterionId, state]) => {
    const normalizedStatus = normalizeCriterionStatus(state?.status)
    const nextStatus = normalizedStatus || 'pending'
    const scoreRaw = state?.score
    const hasScore = scoreRaw !== null && scoreRaw !== undefined && String(scoreRaw) !== ''
    const score = hasScore ? toNumber(scoreRaw, null) : null

    acc[String(criterionId)] = {
      status: nextStatus,
      score: Number.isFinite(score) ? score : null,
      note: String(state?.note || ''),
      attachments: normalizeCriterionAttachments(state?.attachments),
    }
    return acc
  }, {})
}

const normalizeDraft = (draft = {}, fallbackIndex = 0) => {
  const now = new Date().toISOString()
  const createdAt = parseDate(draft?.createdAt || now).toISOString()
  const updatedAt = parseDate(draft?.updatedAt || createdAt).toISOString()

  return {
    id: String(draft?.id || `draft-${Date.now()}-${fallbackIndex + 1}`),
    storeId: toNumber(draft?.storeId || draft?.store_id),
    storeName: String(draft?.storeName || draft?.store_name || ''),
    templateId: String(draft?.templateId || draft?.template_id || ''),
    auditedAt: String(draft?.auditedAt || '').trim(),
    note: String(draft?.note || ''),
    criteriaStates: normalizeDraftCriteriaStates(draft?.criteriaStates),
    createdAt,
    updatedAt,
  }
}

const normalizeDraftList = (drafts = []) => {
  const source = Array.isArray(drafts) ? drafts : []
  return source
    .map((item, index) => normalizeDraft(item, index))
    .sort((a, b) => parseDate(b.updatedAt).getTime() - parseDate(a.updatedAt).getTime())
}

const readStoredDrafts = () => {
  if (!canUseStorage()) return []
  const raw = window.localStorage.getItem(DRAFT_STORAGE_KEY)
  if (!raw) return []
  return normalizeDraftList(safeParseList(raw))
}

const writeStoredDrafts = (drafts = []) => {
  if (!canUseStorage()) return
  window.localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(normalizeDraftList(drafts)))
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

const resolveStorePool = (stores = [], fallbackStoreId = 0) => {
  const poolMap = new Map()

  const source = Array.isArray(stores) ? stores : []
  source.forEach((store) => {
    const id = toNumber(store?.id || store?.storeId || store?.store_id)
    if (!id || poolMap.has(id)) return

    poolMap.set(id, {
      id,
      name: resolveStoreName(store),
    })
  })

  if (fallbackStoreId > 0 && !poolMap.has(fallbackStoreId)) {
    poolMap.set(fallbackStoreId, {
      id: fallbackStoreId,
      name: `Cửa hàng #${fallbackStoreId}`,
    })
  }

  if (poolMap.size === 0) {
    return [
      { id: 1, name: 'Cửa hàng #1' },
      { id: 2, name: 'Cửa hàng #2' },
      { id: 3, name: 'Cửa hàng #3' },
    ]
  }

  return Array.from(poolMap.values())
}

const lowerTotalToThresholdFail = (criteria = [], threshold = DEFAULT_PASS_THRESHOLD) => {
  const next = criteria.map((item) => ({ ...item }))

  while (true) {
    const evaluation = evaluateSession({ criteria: next, passThreshold: threshold })
    if (evaluation.totalScore < threshold) break

    const candidate = next.find((item) => !item.critical && toNumber(item.score) > 0)
    if (!candidate) break
    candidate.score = Math.max(toNumber(candidate.score) - 1, 0)
  }

  return next
}

const buildMockCriteria = (template, mode) => {
  const base = flattenTemplateCriteria(template).map((criterion) => ({
    ...criterion,
    score: criterion.maxScore,
  }))

  if (mode === 'threshold_fail') {
    const lowered = base.map((item) => ({
      ...item,
      score: item.critical ? item.maxScore : Math.max(item.maxScore - 3, 0),
    }))
    return lowerTotalToThresholdFail(lowered, template.passThreshold)
  }

  if (mode === 'critical_fail') {
    const target = base.find((item) => item.critical)
    if (target) {
      target.score = Math.max(target.maxScore - 2, 0)
    }
    return base
  }

  if (mode === 'borderline_pass') {
    const adjusted = base.map((item, index) => {
      if (item.critical) return { ...item, score: item.maxScore }
      if (index % 2 === 0) return { ...item, score: Math.max(item.maxScore - 1, 0) }
      return item
    })

    let evaluation = evaluateSession({ criteria: adjusted, passThreshold: template.passThreshold })
    if (evaluation.status !== 'passed') {
      const nonCritical = adjusted.filter((item) => !item.critical)
      nonCritical.forEach((item) => {
        if (evaluation.status === 'passed') return
        item.score = item.maxScore
        evaluation = evaluateSession({ criteria: adjusted, passThreshold: template.passThreshold })
      })
    }

    return adjusted
  }

  return base
}

const buildMockSessions = (stores = []) => {
  const now = new Date()
  const selectedStores = (Array.isArray(stores) ? stores : []).slice(0, 8)
  const records = []
  let seq = 1

  selectedStores.forEach((store, storeIndex) => {
    MOCK_SCENARIOS.forEach((scenario, scenarioIndex) => {
      const template = MOCK_TEMPLATE_LIBRARY[scenario.templateId] || DEFAULT_TEMPLATE
      const auditor = MOCK_AUDITORS[(storeIndex + scenarioIndex) % MOCK_AUDITORS.length]
      const auditedAtDate = new Date(now)
      auditedAtDate.setDate(now.getDate() + scenario.dayOffset - storeIndex)
      auditedAtDate.setHours(9 + scenarioIndex * 2, 15, 0, 0)

      records.push(
        normalizeSession(
          {
            id: `mock-${store.id}-${seq}`,
            code: buildSessionCode(auditedAtDate, seq),
            storeId: store.id,
            storeName: store.name,
            auditorId: auditor.id,
            auditorName: auditor.name,
            templateId: template.id,
            templateName: template.name,
            templateVersion: template.version,
            templatePassThreshold: template.passThreshold,
            criteria: buildMockCriteria(template, scenario.mode),
            note: scenario.note,
            auditedAt: auditedAtDate.toISOString(),
            createdAt: auditedAtDate.toISOString(),
            updatedAt: auditedAtDate.toISOString(),
          },
          seq
        )
      )

      seq += 1
    })
  })

  return normalizeSessionList(records)
}

const ensureSeedData = ({ stores = [], storeId = 0 } = {}) => {
  const existing = readStoredSessions()
  if (existing.length > 0) return existing

  const storePool = resolveStorePool(stores, toNumber(storeId))
  const seeded = buildMockSessions(storePool)
  writeStoredSessions(seeded)
  return seeded
}

const normalizeStatusFilter = (status = '') => {
  const value = String(status || '').trim().toLowerCase()
  if (value === 'pass') return 'passed'
  if (value === 'fail') return 'failed'
  return value
}

const parseBoundaryTime = (value, mode) => {
  if (!value) return null
  const normalized = String(value).trim()
  if (!normalized) return null

  const date = mode === 'to'
    ? new Date(`${normalized}T23:59:59.999`)
    : new Date(`${normalized}T00:00:00.000`)

  if (Number.isNaN(date.getTime())) return null
  return date.getTime()
}

const querySessionsCore = ({
  storeId,
  q = '',
  status = '',
  from = '',
  to = '',
  templateId = '',
  stores = [],
} = {}) => {
  const source = ensureSeedData({ stores, storeId })
  const keyword = String(q || '').trim().toLowerCase()
  const normalizedStatus = normalizeStatusFilter(status)
  const normalizedTemplateId = String(templateId || '').trim()
  const fromTime = parseBoundaryTime(from, 'from')
  const toTime = parseBoundaryTime(to, 'to')

  return source
    .filter((session) => {
      if (storeId && Number(session.storeId) !== Number(storeId)) return false
      if (normalizedStatus && session.result !== normalizedStatus) return false
      if (normalizedTemplateId && session.templateId !== normalizedTemplateId) return false

      const targetTime = parseDate(session.auditedAt || session.createdAt).getTime()
      if (fromTime && targetTime < fromTime) return false
      if (toTime && targetTime > toTime) return false

      if (keyword) {
        const haystack = `${session.code || ''} ${session.auditorName || ''} ${session.note || ''} ${session.storeName || ''} ${session.templateName || ''}`.toLowerCase()
        if (!haystack.includes(keyword)) return false
      }

      return true
    })
    .sort((a, b) => parseDate(b.auditedAt || b.createdAt).getTime() - parseDate(a.auditedAt || a.createdAt).getTime())
}

const toOverviewSummary = (sessions = []) => {
  const totalSessions = sessions.length
  const passed = sessions.filter((item) => item.result === 'passed').length
  const failed = sessions.filter((item) => item.result === 'failed').length
  const totalScore = sessions.reduce((sum, item) => sum + toNumber(item.totalScore), 0)
  const totalMaxScore = sessions.reduce((sum, item) => sum + toNumber(item.maxScore), 0)
  const avgScore = totalSessions > 0
    ? Math.round((totalScore / totalSessions) * 10) / 10
    : 0
  const avgMaxScore = totalSessions > 0
    ? Math.round((totalMaxScore / totalSessions) * 10) / 10
    : 0
  const avgScoreRate = totalMaxScore > 0
    ? Math.round((totalScore / totalMaxScore) * 1000) / 10
    : 0

  return {
    totalSessions,
    passed,
    failed,
    avgScore,
    avgMaxScore,
    avgScoreRate,
    passRate: totalSessions > 0 ? Math.round((passed / totalSessions) * 100) : 0,
  }
}

const toStoreStats = (stores = [], sessions = []) => {
  const source = Array.isArray(stores) ? stores : []
  return source.map((store) => {
    const storeId = toNumber(store?.id || store?.storeId || store?.store_id)
    const ownSessions = sessions.filter((item) => Number(item.storeId) === storeId)
    const summary = toOverviewSummary(ownSessions)
    const lastAudit = ownSessions[0] || null

    return {
      storeId,
      totalSessions: summary.totalSessions,
      passed: summary.passed,
      failed: summary.failed,
      avgScore: summary.avgScore,
      avgMaxScore: summary.avgMaxScore,
      avgScoreRate: summary.avgScoreRate,
      passRate: summary.passRate,
      lastAuditAt: lastAudit?.createdAt || null,
      lastAuditCode: lastAudit?.code || null,
      lastAuditResult: lastAudit?.result || null,
    }
  })
}

const getNextSequence = (sessions = []) => {
  const maxSeq = sessions.reduce((max, session) => {
    const matched = String(session?.code || '').match(/-(\d+)$/)
    if (!matched) return max
    return Math.max(max, toNumber(matched[1]))
  }, 0)

  return maxSeq + 1
}

const createSessionCore = (payload = {}) => {
  const storeId = toNumber(payload.storeId || payload.store_id)
  if (!Number.isInteger(storeId) || storeId <= 0) {
    throw new Error('storeId không hợp lệ')
  }

  const template = normalizeTemplate(payload)
  const criteria = normalizeCriteria(payload.criteria)
  const evaluation = evaluateSession({ criteria, passThreshold: template.passThreshold })

  if (evaluation.incompleteCount > 0) {
    throw new Error('Phiếu QC còn tiêu chí chưa chấm')
  }

  const source = ensureSeedData({ storeId })
  const now = new Date()
  const sequence = getNextSequence(source)

  const createdSession = normalizeSession(
    {
      id: `${now.getTime()}-${Math.random().toString(36).slice(2, 8)}`,
      code: buildSessionCode(now, sequence),
      storeId,
      storeName: String(payload.storeName || payload.store_name || ''),
      auditorId: payload.auditorId ?? payload.auditor_id ?? null,
      auditorName: String(payload.auditorName || payload.auditor_name || ''),
      template,
      criteria,
      note: String(payload.note || '').trim(),
      auditedAt: payload.auditedAt || now.toISOString(),
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    },
    source.length
  )

  source.push(createdSession)
  writeStoredSessions(source)

  return createdSession
}

const apiSuccess = (message, data = {}) => ({
  success: true,
  message,
  data,
})

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
      attachments: [],
    }
  })
}

const deriveSessionDecisionReasons = ({ criteria = [], totalScore = 0, maxScore = 0, result = 'pending', passThreshold = 0 }) => {
  const reasons = []
  const hasPending = criteria.some((item) => item.status === 'pending')
  const hasFail = criteria.some((item) => item.status === 'fail')
  const belowThreshold = passThreshold > 0 && maxScore > 0 && totalScore < passThreshold

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
  const templatePassThreshold = Math.max(
    toNumber(formVersion?.pass_rule?.passThreshold ?? formVersion?.pass_rule?.pass_threshold),
    0
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
      id: String(form?.code || session?.templateId || DEFAULT_TEMPLATE.id),
      name: String(form?.name || session?.templateName || DEFAULT_TEMPLATE.name),
      version: String(formVersion?.version_no || session?.templateVersion || DEFAULT_TEMPLATE.version),
      passThreshold: templatePassThreshold > 0 ? templatePassThreshold : DEFAULT_PASS_THRESHOLD,
    },
    templateId: String(form?.code || session?.templateId || DEFAULT_TEMPLATE.id),
    templateName: String(form?.name || session?.templateName || DEFAULT_TEMPLATE.name),
    templateVersion: String(formVersion?.version_no || session?.templateVersion || DEFAULT_TEMPLATE.version),
    templatePassThreshold: templatePassThreshold > 0 ? templatePassThreshold : DEFAULT_PASS_THRESHOLD,
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

const qcRepository = {
  async list(params = {}) {
    const rows = querySessionsCore(params)
    const page = Math.max(toNumber(params.page, 1), 1)
    const pageSize = Math.min(Math.max(toNumber(params.pageSize, rows.length || 10), 1), 100)
    const start = (page - 1) * pageSize
    const paged = rows.slice(start, start + pageSize)

    return apiSuccess('Lấy danh sách phiên QC thành công', {
      sessions: paged,
      pagination: {
        page,
        pageSize,
        total: rows.length,
        pageCount: Math.ceil(rows.length / pageSize),
      },
    })
  },

  async overview(params = {}) {
    const stores = Array.isArray(params.stores) ? params.stores : []
    const rows = querySessionsCore({
      stores,
      from: params.from,
      to: params.to,
    })

    return apiSuccess('Lấy tổng quan QC thành công', {
      summary: toOverviewSummary(rows),
      storeStats: toStoreStats(stores, rows),
    })
  },

  async storeOverview(params = {}) {
    const storeId = toNumber(params.storeId || params.store_id)
    const summarySource = querySessionsCore({ storeId })
    const listSource = querySessionsCore({
      storeId,
      q: params.q,
      status: params.status,
      from: params.from,
      to: params.to,
      templateId: params.templateId,
    })

    const page = Math.max(toNumber(params.page, 1), 1)
    const pageSize = Math.min(Math.max(toNumber(params.pageSize, listSource.length || 10), 1), 100)
    const start = (page - 1) * pageSize
    const paged = listSource.slice(start, start + pageSize)

    return apiSuccess('Lấy chi tiết QC cửa hàng thành công', {
      summary: toOverviewSummary(summarySource),
      sessions: paged,
      pagination: {
        page,
        pageSize,
        total: listSource.length,
        pageCount: Math.ceil(listSource.length / pageSize),
      },
    })
  },

  async create(payload = {}) {
    const session = createSessionCore(payload)
    return apiSuccess('Tạo phiên QC thành công', { session })
  },

  async seedMockData(params = {}) {
    if (canUseStorage()) {
      window.localStorage.removeItem(STORAGE_KEY)
      if (params.clearLegacy) {
        window.localStorage.removeItem(LEGACY_STORAGE_KEY)
      }
    }

    const seeded = ensureSeedData({
      stores: Array.isArray(params.stores) ? params.stores : [],
      storeId: toNumber(params.storeId),
    })

    return apiSuccess('Đã seed dữ liệu QC mock', {
      total: seeded.length,
      sessions: seeded,
    })
  },
}

const qcCriteriaTemplate = () => {
  const template = MOCK_TEMPLATE_LIBRARY.ticket_standard || DEFAULT_TEMPLATE
  return flattenTemplateCriteria(template).map((item) => ({
    ...item,
    score: item.maxScore,
  }))
}

const listQcSessions = ({ storeId, q = '', status = '', from = '', to = '', templateId = '' } = {}) => {
  return querySessionsCore({ storeId, q, status, from, to, templateId })
}

export const createQcSession = async (payload = {}) => {
  const requestBody = {
    storeId: toNumber(payload.storeId || payload.store_id),
    auditorId: payload.auditorId ?? payload.auditor_id ?? null,
    templateId: String(payload.templateId || payload.template_id || ''),
    templateName: String(payload.templateName || payload.template_name || ''),
    templateVersion: String(payload.templateVersion || payload.template_version || ''),
    templatePassThreshold: toNumber(payload.templatePassThreshold ?? payload.template_pass_threshold),
    allowTemplateAutocreate: payload.allowTemplateAutocreate ?? payload.allow_template_autocreate ?? true,
    note: String(payload.note || ''),
    auditedAt: payload.auditedAt || payload.audited_at || new Date().toISOString(),
    criteria: Array.isArray(payload.criteria)
      ? payload.criteria.map((criterion = {}) => ({
        ...criterion,
        attachments: [],
      }))
      : [],
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

const getQcOverview = (stores = [], options = {}) => {
  const sessions = querySessionsCore({
    stores,
    from: options?.from || '',
    to: options?.to || '',
  })

  return {
    summary: toOverviewSummary(sessions),
    storeStats: toStoreStats(stores, sessions),
  }
}

const getQcStoreOverview = (storeId, options = {}) => {
  const sessions = querySessionsCore({
    storeId,
    from: options?.from || '',
    to: options?.to || '',
  })

  return {
    summary: toOverviewSummary(sessions),
    sessions,
  }
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

  const drafts = normalizeDraftList(allRows.map((item) => normalizeDraftFromApi(item)))
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

// Legacy local draft helpers kept for migration/debug only.
const listQcDraftSessionsLocal = ({ storeId } = {}) => {
  const source = readStoredDrafts()
  if (!storeId) return source
  return source.filter((item) => Number(item.storeId) === Number(storeId))
}

const getQcDraftSessionByIdLocal = (draftId) => {
  if (!draftId) return null
  const targetId = String(draftId)
  const source = readStoredDrafts()
  return source.find((item) => String(item.id) === targetId) || null
}

const createQcDraftSessionLocal = (payload = {}) => {
  const storeId = toNumber(payload.storeId || payload.store_id)
  if (!Number.isInteger(storeId) || storeId <= 0) {
    throw new Error('storeId không hợp lệ')
  }

  const now = new Date().toISOString()
  const source = readStoredDrafts()
  const created = normalizeDraft({
    id: `draft-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    storeId,
    storeName: String(payload.storeName || payload.store_name || ''),
    templateId: String(payload.templateId || payload.template_id || ''),
    auditedAt: String(payload.auditedAt || ''),
    note: String(payload.note || ''),
    criteriaStates: payload.criteriaStates || {},
    createdAt: now,
    updatedAt: now,
  })

  source.unshift(created)
  writeStoredDrafts(source)
  return created
}

const updateQcDraftSessionLocal = (draftId, payload = {}) => {
  if (!draftId) return null

  const targetId = String(draftId)
  const source = readStoredDrafts()
  const index = source.findIndex((item) => String(item.id) === targetId)
  if (index < 0) return null

  const current = source[index]
  const next = normalizeDraft({
    ...current,
    ...payload,
    criteriaStates: payload.criteriaStates ? normalizeDraftCriteriaStates(payload.criteriaStates) : current.criteriaStates,
    updatedAt: new Date().toISOString(),
  })

  source[index] = next
  writeStoredDrafts(source)
  return next
}

const deleteQcDraftSessionLocal = (draftId) => {
  if (!draftId) return false

  const targetId = String(draftId)
  const source = readStoredDrafts()
  const next = source.filter((item) => String(item.id) !== targetId)

  if (next.length === source.length) return false

  writeStoredDrafts(next)
  return true
}

export const qcHelpers = {
  toDateLabel,
  passThreshold: DEFAULT_PASS_THRESHOLD,
  evaluateSession,
}
