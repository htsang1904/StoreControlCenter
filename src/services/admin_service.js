import getClient from './http'

const http = getClient()

const toRelationRows = (relation) => {
  if (Array.isArray(relation)) return relation
  if (Array.isArray(relation?.data)) return relation.data
  return []
}

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

const buildAdminCriteriaTree = (criteria = []) => {
  const rows = Array.isArray(criteria) ? [...criteria] : []
  const map = new Map()
  const roots = []

  rows
    .sort((left, right) => compareOrdering(left?.ordering, right?.ordering) || (left?.sortOrder || 0) - (right?.sortOrder || 0))
    .forEach((criterion, index) => {
      const key = String(criterion?.id || criterion?.ordering || index + 1)
      map.set(key, { ...criterion, children: [] })
    })

  rows.forEach((criterion, index) => {
    const key = String(criterion?.id || criterion?.ordering || index + 1)
    const parentKey = criterion?.parentId ? String(criterion.parentId) : ''
    const current = map.get(key)
    if (!current) return

    if (parentKey && map.has(parentKey)) {
      map.get(parentKey).children.push(current)
      return
    }

    roots.push(current)
  })

  return roots
}

export const syncStoresNow = () => {
  return http.post('/api/stores/sync')
}

const normalizeAdminQcForm = (entry = {}) => {
  const source = entry || {}
  const versions = toRelationRows(source?.versions).map((item) => {
    const version = item || {}
    return {
      id: Number(item?.id || version?.id || 0),
      versionNo: String(version?.version_no || version?.versionNo || ''),
      status: String(version?.status || ''),
      createdAt: version?.createdAt || null,
      updatedAt: version?.updatedAt || null,
    }
  })
  const sortedVersions = [...versions].sort((left, right) => {
    const leftTime = new Date(left?.createdAt || 0).getTime()
    const rightTime = new Date(right?.createdAt || 0).getTime()
    return rightTime - leftTime
  })

  const latestVersion = sortedVersions[0] || null
  const publishedVersions = sortedVersions.filter((item) => item?.status === 'published')

  return {
    id: Number(entry?.id || source?.id || 0),
    code: String(source?.code || ''),
    name: String(source?.name || ''),
    description: String(source?.description || ''),
    isActive: source?.is_active !== false && source?.isActive !== false,
    hasLatestVersion: Boolean(latestVersion),
    versionsCount: sortedVersions.length,
    publishedVersionsCount: publishedVersions.length,
    latestVersionNo: String(latestVersion?.versionNo || '--'),
    latestVersionStatus: String(latestVersion?.status || ''),
    updatedAt: latestVersion?.updatedAt || source?.updatedAt || null,
  }
}

const normalizeAdminQcFormDetail = (item = {}) => {
  const latestVersion = item?.latestVersion || {}
  const criteria = Array.isArray(latestVersion?.criteria)
    ? latestVersion.criteria.map((criterion, index) => ({
      id: String(criterion?.id || `criterion-${index + 1}`),
      code: String(criterion?.code || ''),
      name: String(criterion?.name || ''),
      description: String(criterion?.description || ''),
      sectionName: String(criterion?.sectionName || 'Tổng quát'),
      mode: String(criterion?.mode || 'point'),
      maxScore: Number(criterion?.maxScore || 0),
      level: Number(criterion?.level || 1),
      ordering: String(criterion?.ordering || ''),
      parentId: criterion?.parentId ? String(criterion.parentId) : null,
      sortOrder: Number(criterion?.sortOrder || index + 1),
      nodeType: String(criterion?.nodeType || 'criterion'),
    }))
    : []
  const criteriaTree = buildAdminCriteriaTree(criteria)
  const leafCriteriaCount = criteria.filter((criterion) => criterion.nodeType !== 'group').length

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
      passThreshold: Number(latestVersion?.passThreshold ?? 40),
      criteria,
      criteriaTree,
      criteriaCount: criteria.length,
      leafCriteriaCount,
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
    .then((response) => normalizeAdminQcFormDetail(response?.data?.item || {}))
}

export const getAdminQcFormById = async (formId) => {
  const response = await http.get(`/api/admin/qc/forms/${formId}`)
  return normalizeAdminQcFormDetail(response?.data?.item || {})
}

export const updateAdminQcForm = async (formId, payload = {}) => {
  const response = await http.put(`/api/admin/qc/forms/${formId}`, payload)
  return normalizeAdminQcFormDetail(response?.data?.item || {})
}

export const deleteAdminQcForm = async (formId) => {
  return http.delete(`/api/admin/qc/forms/${formId}`)
}

const normalizeAdminUser = (item = {}) => {
  const stores = Array.isArray(item?.stores)
    ? item.stores.map((store) => ({
      id: Number(store?.id || 0),
      code: String(store?.code || ''),
      name: String(store?.name || ''),
      shortAddress: String(store?.shortAddress || ''),
      storeId: String(store?.storeId || ''),
      isActive: store?.is_active !== false && store?.isActive !== false,
    }))
    : []

  const department = item?.department
    ? {
      id: Number(item.department?.id || 0),
      name: String(item.department?.name || ''),
      code: String(item.department?.code || ''),
      isActive: item.department?.is_active !== false,
    }
    : null

  return {
    id: Number(item?.id || 0),
    name: String(item?.name || ''),
    email: String(item?.email || ''),
    phoneNumber: String(item?.phone_number || ''),
    role: String(item?.role || '').toLowerCase(),
    isActive: item?.is_active === true,
    departmentId: item?.department_id ? Number(item.department_id) : null,
    department,
    stores,
    storeIds: stores.map((store) => Number(store.id || 0)).filter((id) => Number.isInteger(id) && id > 0),
    createdAt: item?.created_at || null,
    updatedAt: item?.updated_at || null,
  }
}

const normalizeAdminStore = (item = {}) => ({
  id: Number(item?.id || 0),
  code: String(item?.code || ''),
  name: String(item?.name || ''),
  address: String(item?.address || ''),
  shortAddress: String(item?.shortAddress || ''),
  storeId: String(item?.storeId || ''),
  brandId: String(item?.brandId || ''),
  isActive: item?.is_active !== false && item?.isActive !== false,
  createdAt: item?.created_at || null,
  updatedAt: item?.updated_at || null,
})

export const listAdminUsers = async ({
  page = 1,
  pageSize = 12,
  q = '',
  role = '',
  isActive,
  departmentId,
} = {}) => {
  const params = { page, pageSize }
  if (String(q || '').trim()) params.q = String(q).trim()
  if (String(role || '').trim()) params.role = String(role).trim().toLowerCase()
  if (typeof isActive === 'boolean') params.isActive = isActive
  if (Number.isInteger(Number(departmentId)) && Number(departmentId) > 0) params.departmentId = Number(departmentId)

  const response = await http.get('/api/admin/users', { params })
  const rows = Array.isArray(response?.data?.items) ? response.data.items : []
  const pagination = response?.data?.pagination || {}

  return {
    items: rows.map((item) => normalizeAdminUser(item)),
    pagination: {
      page: Number(pagination?.page || page),
      pageSize: Number(pagination?.pageSize || pageSize),
      total: Number(pagination?.total || rows.length),
      pageCount: Number(pagination?.pageCount || 1),
    },
  }
}

export const updateAdminUser = async (userId, payload = {}) => {
  const response = await http.put(`/api/admin/users/${userId}`, payload)
  return normalizeAdminUser(response?.data?.item || {})
}

export const deleteAdminUser = async (userId) => {
  return http.delete(`/api/admin/users/${userId}`)
}

export const listAdminDepartments = async () => {
  const response = await http.get('/api/departments')
  const rows = Array.isArray(response?.data) ? response.data : []
  return rows.map((item) => ({
    id: Number(item?.id || 0),
    name: String(item?.name || ''),
    code: String(item?.code || ''),
    isActive: item?.is_active !== false,
  }))
}

const normalizeAdminDepartment = (item = {}) => ({
  id: Number(item?.id || 0),
  name: String(item?.name || ''),
  code: String(item?.code || ''),
  isActive: item?.is_active !== false && item?.isActive !== false,
  createdAt: item?.created_at || item?.createdAt || null,
  updatedAt: item?.updated_at || item?.updatedAt || null,
})

export const listAdminDepartmentsManaged = async ({
  page = 1,
  pageSize = 20,
  q = '',
  isActive,
} = {}) => {
  const params = { page, pageSize }
  if (String(q || '').trim()) params.q = String(q).trim()
  if (typeof isActive === 'boolean') params.isActive = isActive

  const response = await http.get('/api/admin/departments', { params })
  const rows = Array.isArray(response?.data?.items) ? response.data.items : []
  const pagination = response?.data?.pagination || {}

  return {
    items: rows.map((item) => normalizeAdminDepartment(item)),
    pagination: {
      page: Number(pagination?.page || page),
      pageSize: Number(pagination?.pageSize || pageSize),
      total: Number(pagination?.total || rows.length),
      pageCount: Number(pagination?.pageCount || 1),
    },
  }
}

export const createAdminDepartment = async (payload = {}) => {
  const response = await http.post('/api/admin/departments', payload)
  return normalizeAdminDepartment(response?.data?.item || {})
}

export const updateAdminDepartment = async (departmentId, payload = {}) => {
  const response = await http.put(`/api/admin/departments/${departmentId}`, payload)
  return normalizeAdminDepartment(response?.data?.item || {})
}

export const deleteAdminDepartment = async (departmentId) => {
  return http.delete(`/api/admin/departments/${departmentId}`)
}

const normalizeAdminPermission = (item = {}) => ({
  id: Number(item?.id || 0),
  code: String(item?.code || ''),
  name: String(item?.name || ''),
  group: String(item?.group || ''),
  description: String(item?.description || ''),
  isActive: item?.is_active !== false && item?.isActive !== false,
})

export const listAdminPermissions = async () => {
  const response = await http.get('/api/admin/permissions')
  const rows = Array.isArray(response?.data?.items) ? response.data.items : []
  return rows.map((item) => normalizeAdminPermission(item))
}

export const createAdminPermission = async (payload = {}) => {
  const response = await http.post('/api/admin/permissions', payload)
  return normalizeAdminPermission(response?.data?.item || {})
}

export const updateAdminPermission = async (permissionId, payload = {}) => {
  const response = await http.put(`/api/admin/permissions/actions/${permissionId}`, payload)
  return normalizeAdminPermission(response?.data?.item || {})
}

export const listAdminRolePermissions = async () => {
  const response = await http.get('/api/admin/permissions/roles')
  return response?.data?.roles || {}
}

export const listAdminRoles = async () => {
  const response = await http.get('/api/admin/permissions/roles')
  return Array.isArray(response?.data?.items) ? response.data.items : []
}

export const createAdminRole = async (payload = {}) => {
  const response = await http.post('/api/admin/permissions/roles', payload)
  return response?.data?.item || {}
}

export const updateAdminRolePermissions = async (role, permissions = []) => {
  const response = await http.put(`/api/admin/permissions/roles/${role}`, { permissions })
  return response?.data || {}
}

export const updateAdminRole = async (role, payload = {}) => {
  const response = await http.put(`/api/admin/permissions/roles/${role}`, payload)
  return response?.data?.item || {}
}

export const listAdminStores = async ({
  page = 1,
  pageSize = 20,
  q = '',
  isActive,
} = {}) => {
  const params = { page, pageSize }
  if (String(q || '').trim()) params.q = String(q).trim()
  if (typeof isActive === 'boolean') params.isActive = isActive

  const response = await http.get('/api/admin/stores', { params })
  const rows = Array.isArray(response?.data?.items) ? response.data.items : []
  const pagination = response?.data?.pagination || {}

  return {
    items: rows.map((item) => normalizeAdminStore(item)),
    pagination: {
      page: Number(pagination?.page || page),
      pageSize: Number(pagination?.pageSize || pageSize),
      total: Number(pagination?.total || rows.length),
      pageCount: Number(pagination?.pageCount || 1),
    },
  }
}

export const createAdminStore = async (payload = {}) => {
  const response = await http.post('/api/admin/stores', payload)
  return normalizeAdminStore(response?.data?.item || {})
}

export const updateAdminStore = async (storeId, payload = {}) => {
  const response = await http.put(`/api/admin/stores/${storeId}`, payload)
  return normalizeAdminStore(response?.data?.item || {})
}

export const deleteAdminStore = async (storeId) => {
  return http.delete(`/api/admin/stores/${storeId}`)
}
