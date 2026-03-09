import getClient from './http'

const http = getClient()

export const syncStoresNow = () => {
  return http.post('/api/stores/sync')
}

const normalizeAdminQcForm = (entry = {}) => {
  const attributes = entry?.attributes || {}
  const versions = Array.isArray(attributes?.versions?.data) ? attributes.versions.data : []
  const sortedVersions = [...versions].sort((left, right) => {
    const leftTime = new Date(left?.attributes?.createdAt || 0).getTime()
    const rightTime = new Date(right?.attributes?.createdAt || 0).getTime()
    return rightTime - leftTime
  })

  const latestVersion = sortedVersions[0] || null
  const publishedVersions = sortedVersions.filter((item) => item?.attributes?.status === 'published')

  return {
    id: Number(entry?.id || 0),
    code: String(attributes?.code || ''),
    name: String(attributes?.name || ''),
    description: String(attributes?.description || ''),
    isActive: attributes?.is_active !== false,
    versionsCount: sortedVersions.length,
    publishedVersionsCount: publishedVersions.length,
    latestVersionNo: String(latestVersion?.attributes?.version_no || '--'),
    latestVersionStatus: String(latestVersion?.attributes?.status || 'draft'),
    updatedAt: latestVersion?.attributes?.updatedAt || entry?.attributes?.updatedAt || null,
  }
}

const normalizeAdminQcFormDetail = (item = {}) => {
  const latestVersion = item?.latestVersion || {}
  const criteria = Array.isArray(latestVersion?.criteria) ? latestVersion.criteria : []

  return {
    id: Number(item?.id || 0),
    code: String(item?.code || ''),
    name: String(item?.name || ''),
    description: String(item?.description || ''),
    isActive: item?.isActive !== false,
    latestVersion: {
      id: Number(latestVersion?.id || 0),
      versionNo: String(latestVersion?.versionNo || 'v1.0'),
      status: String(latestVersion?.status || 'draft'),
      passThreshold: Number(latestVersion?.passThreshold || 40),
      criteria: criteria.map((criterion, index) => ({
        id: String(criterion?.id || `criterion-${index + 1}`),
        code: String(criterion?.code || ''),
        name: String(criterion?.name || ''),
        description: String(criterion?.description || ''),
        sectionName: String(criterion?.sectionName || 'Tổng quát'),
        mode: String(criterion?.mode || 'point'),
        maxScore: Number(criterion?.maxScore || 0),
        weight: Number(criterion?.weight || 1),
        frequency: String(criterion?.frequency || 'per_audit'),
        isCritical: criterion?.isCritical === true,
        required: criterion?.required !== false,
      })),
    },
  }
}

export const listAdminQcForms = async ({ page = 1, pageSize = 10 } = {}) => {
  const response = await http.get('/api/admin/qc/forms', {
    params: { page, pageSize },
  })
  const rows = Array.isArray(response?.data?.items) ? response.data.items : []
  const pagination = response?.data?.pagination || {}

  return {
    items: rows.map((item) => normalizeAdminQcForm(item)),
    pagination: {
      page: Number(pagination?.page || page),
      pageSize: Number(pagination?.pageSize || pageSize),
      total: Number(pagination?.total || rows.length),
      pageCount: Number(pagination?.pageCount || 1),
    },
  }
}

export const createAdminQcForm = (payload = {}) => {
  return http.post('/api/admin/qc/forms', payload)
}

export const getAdminQcFormById = async (formId) => {
  const response = await http.get(`/api/admin/qc/forms/${formId}`)
  return normalizeAdminQcFormDetail(response?.data?.item || {})
}

export const updateAdminQcForm = async (formId, payload = {}) => {
  const response = await http.put(`/api/admin/qc/forms/${formId}`, payload)
  return normalizeAdminQcFormDetail(response?.data?.item || {})
}
