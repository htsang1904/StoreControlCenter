'use strict';

const { createCoreController } = require('@strapi/strapi').factories;

const successResponse = (message, data = {}) => ({
  success: true,
  message,
  data,
});

const errorResponse = (ctx, status, message) => {
  ctx.status = status;
  return {
    success: false,
    message,
  };
};

const toNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const parseStoreIds = (rawValue) => {
  if (rawValue === undefined || rawValue === null) return [];

  const source = Array.isArray(rawValue)
    ? rawValue.flatMap((item) => String(item).split(','))
    : String(rawValue).split(',');

  return Array.from(
    new Set(
      source
        .map((item) => Number(String(item).trim()))
        .filter((item) => Number.isInteger(item) && item > 0)
    )
  );
};

const sanitizeCriteriaStates = (value) => (
  value && typeof value === 'object' && !Array.isArray(value)
    ? value
    : {}
);

const normalizePayload = (payload = {}) => {
  if (payload && typeof payload === 'object' && payload.data && typeof payload.data === 'object') {
    return payload.data;
  }
  return payload || {};
};

const normalizeDateTime = (value, fallback = new Date()) => {
  const source = value ? new Date(value) : new Date(fallback);
  if (Number.isNaN(source.getTime())) return null;
  return source.toISOString();
};

const resolveStoreName = (store = {}) => (
  store.shortAddress ||
  store.address ||
  store.name ||
  store.code ||
  `Cửa hàng #${store.id || '--'}`
);

const STORE_FIELDS = ['id', 'storeId', 'code', 'shortAddress', 'address', 'name'];
const DRAFT_SCAN_LIMIT = 10000;

const draftPopulate = {
  store: {
    fields: STORE_FIELDS,
  },
};

const buildDraftScopeKey = (draft = {}) => {
  const storeId = toNumber(draft?.store?.id || draft?.store || draft?.storeId || draft?.store_id);
  const templateId = String(draft?.template_id || draft?.templateId || '').trim();
  if (!storeId || !templateId) {
    return `draft:${draft?.id || ''}`;
  }
  return `${storeId}:${templateId}`;
};

const dedupeDraftRows = (rows = []) => {
  const uniqueRows = [];
  const seen = new Set();

  for (const row of Array.isArray(rows) ? rows : []) {
    const key = buildDraftScopeKey(row);
    if (seen.has(key)) continue;
    seen.add(key);
    uniqueRows.push(row);
  }

  return uniqueRows;
};

const normalizeDraftIds = (rows = []) => Array.from(new Set(
  (Array.isArray(rows) ? rows : [])
    .map((item) => Number(item?.id))
    .filter((item) => Number.isInteger(item) && item > 0)
));

const toDraftDto = (draft = {}) => ({
  id: String(draft.id || ''),
  storeId: toNumber(draft?.store?.id),
  storeNo: String(draft?.store?.storeId || ''),
  storeCode: String(draft?.store?.code || ''),
  storeName: resolveStoreName(draft?.store || {}),
  templateId: String(draft.template_id || ''),
  auditedAt: draft.audited_at || null,
  note: String(draft.note || ''),
  criteriaStates: sanitizeCriteriaStates(draft.criteria_states),
  createdAt: draft.createdAt || null,
  updatedAt: draft.updatedAt || null,
});

const getAllowedStoreInternalIds = async (strapi, user) => {
  const userRole = user?.role || 'store';
  if (userRole !== 'store') return null;

  const allowedStoreNos = parseStoreIds(user.store_ids);
  if (!allowedStoreNos.length) return [];

  const stores = await strapi.entityService.findMany('api::store.store', {
    filters: {
      storeId: {
        $in: allowedStoreNos.map((item) => String(item)),
      },
    },
    fields: ['id'],
    publicationState: 'live',
    limit: 10000,
  });

  return (Array.isArray(stores) ? stores : [])
    .map((item) => Number(item?.id))
    .filter((item) => Number.isInteger(item) && item > 0);
};

const ensureStoreAccess = async (strapi, { user, storeId, allowedStoreIds }) => {
  const store = await strapi.entityService.findOne('api::store.store', storeId, {
    fields: ['id', 'storeId', 'code', 'shortAddress', 'address', 'name'],
    publicationState: 'live',
  });

  if (!store) {
    return { ok: false, status: 404, message: 'Không tìm thấy cửa hàng' };
  }

  const userRole = user?.role || 'store';
  if (userRole !== 'store') {
    return { ok: true, store };
  }

  const allowed = Array.isArray(allowedStoreIds) ? allowedStoreIds : [];
  if (!allowed.includes(Number(store.id))) {
    return { ok: false, status: 403, message: 'Bạn không có quyền truy cập cửa hàng này' };
  }

  return { ok: true, store };
};

const ensureDraftAccess = async (strapi, { user, draftId, allowedStoreIds }) => {
  const draft = await strapi.entityService.findOne('api::qc-draft.qc-draft', draftId, {
    populate: {
      store: draftPopulate.store,
      auditor: {
        fields: ['id'],
      },
    },
  });

  if (!draft) {
    return { ok: false, status: 404, message: 'Không tìm thấy phiếu nháp' };
  }

  const userId = Number(user?.id || 0);
  const userRole = user?.role || 'store';
  const ownerId = Number(draft?.auditor?.id || 0);
  if (userRole !== 'admin' && userId > 0 && ownerId > 0 && ownerId !== userId) {
    return { ok: false, status: 403, message: 'Bạn không có quyền truy cập phiếu nháp này' };
  }

  if (userRole === 'store') {
    const allowed = Array.isArray(allowedStoreIds) ? allowedStoreIds : [];
    const storeId = Number(draft?.store?.id || 0);
    if (!allowed.includes(storeId)) {
      return { ok: false, status: 403, message: 'Bạn không có quyền truy cập phiếu nháp này' };
    }
  }

  return { ok: true, draft };
};

const findScopedDrafts = async (strapi, { userId, storeId, templateId, excludeDraftId = null, populate = false, limit = 100 }) => {
  const filters = {
    auditor: { id: Number(userId) },
    store: { id: Number(storeId) },
    template_id: String(templateId || '').trim(),
  };

  if (excludeDraftId !== null && excludeDraftId !== undefined) {
    filters.id = { $ne: Number(excludeDraftId) };
  }

  return strapi.entityService.findMany('api::qc-draft.qc-draft', {
    filters,
    sort: { updatedAt: 'desc' },
    ...(populate ? { populate: draftPopulate } : {}),
    limit,
  });
};

module.exports = createCoreController('api::qc-draft.qc-draft', ({ strapi }) => ({
  async listDrafts(ctx) {
    const user = ctx.state?.userDetail || {};
    if (!user?.id) {
      return errorResponse(ctx, 401, 'Bạn chưa đăng nhập');
    }

    const storeId = ctx.query?.store_id !== undefined
      ? Number(ctx.query.store_id)
      : null;
    const page = Math.max(toNumber(ctx.query?.page, 1), 1);
    const pageSize = Math.min(Math.max(toNumber(ctx.query?.pageSize, 100), 1), 500);
    const start = (page - 1) * pageSize;

    if (ctx.query?.store_id !== undefined && (!Number.isInteger(storeId) || storeId <= 0)) {
      return errorResponse(ctx, 400, 'store_id không hợp lệ');
    }

    const allowedStoreIds = await getAllowedStoreInternalIds(strapi, user);
    if (Array.isArray(allowedStoreIds) && allowedStoreIds.length === 0) {
      return successResponse('Lấy danh sách phiếu nháp thành công', {
        drafts: [],
        pagination: {
          page,
          pageSize,
          total: 0,
          pageCount: 0,
        },
      });
    }

    const filters = {};
    const userId = Number(user.id);
    if (Number.isInteger(userId) && userId > 0) {
      filters.auditor = { id: userId };
    }

    if (storeId !== null) {
      const access = await ensureStoreAccess(strapi, { user, storeId, allowedStoreIds });
      if (!access.ok) {
        return errorResponse(ctx, access.status, access.message);
      }
      filters.store = { id: Number(access.store.id) };
    } else if (Array.isArray(allowedStoreIds)) {
      filters.store = {
        id: {
          $in: allowedStoreIds,
        },
      };
    }

    const rows = await strapi.entityService.findMany('api::qc-draft.qc-draft', {
      filters,
      sort: { updatedAt: 'desc' },
      populate: draftPopulate,
      limit: DRAFT_SCAN_LIMIT,
    });

    const dedupedRows = dedupeDraftRows(rows);
    const total = dedupedRows.length;
    const pagedRows = dedupedRows.slice(start, start + pageSize);

    return successResponse('Lấy danh sách phiếu nháp thành công', {
      drafts: pagedRows.map(toDraftDto),
      pagination: {
        page,
        pageSize,
        total,
        pageCount: Math.ceil(total / pageSize),
      },
    });
  },

  async getDraft(ctx) {
    const user = ctx.state?.userDetail || {};
    if (!user?.id) {
      return errorResponse(ctx, 401, 'Bạn chưa đăng nhập');
    }

    const draftId = Number(ctx.params.id);
    if (!Number.isInteger(draftId) || draftId <= 0) {
      return errorResponse(ctx, 400, 'id nháp không hợp lệ');
    }

    const allowedStoreIds = await getAllowedStoreInternalIds(strapi, user);
    const access = await ensureDraftAccess(strapi, { user, draftId, allowedStoreIds });
    if (!access.ok) {
      return errorResponse(ctx, access.status, access.message);
    }

    return successResponse('Lấy phiếu nháp thành công', {
      draft: toDraftDto(access.draft),
    });
  },

  async createDraft(ctx) {
    const user = ctx.state?.userDetail || {};
    if (!user?.id) {
      return errorResponse(ctx, 401, 'Bạn chưa đăng nhập');
    }

    const payload = normalizePayload(ctx.request.body || {});
    const storeId = Number(payload.storeId || payload.store_id);
    if (!Number.isInteger(storeId) || storeId <= 0) {
      return errorResponse(ctx, 400, 'storeId không hợp lệ');
    }

    const templateId = String(payload.templateId || payload.template_id || '').trim();
    if (!templateId) {
      return errorResponse(ctx, 400, 'templateId không hợp lệ');
    }

    const auditedAt = normalizeDateTime(payload.auditedAt || payload.audited_at, new Date());
    if (!auditedAt) {
      return errorResponse(ctx, 400, 'auditedAt không hợp lệ');
    }

    const allowedStoreIds = await getAllowedStoreInternalIds(strapi, user);
    const access = await ensureStoreAccess(strapi, { user, storeId, allowedStoreIds });
    if (!access.ok) {
      return errorResponse(ctx, access.status, access.message);
    }

    const existingDrafts = await findScopedDrafts(strapi, {
      userId: Number(user.id),
      storeId: Number(access.store.id),
      templateId,
      populate: true,
    });

    const latestDraft = Array.isArray(existingDrafts) && existingDrafts.length > 0
      ? existingDrafts[0]
      : null;

    if (latestDraft?.id) {
      const updated = await strapi.entityService.update('api::qc-draft.qc-draft', Number(latestDraft.id), {
        data: {
          audited_at: auditedAt,
          note: String(payload.note || '').trim(),
          criteria_states: sanitizeCriteriaStates(payload.criteriaStates || payload.criteria_states),
        },
        populate: draftPopulate,
      });

      const staleDuplicateIds = normalizeDraftIds(existingDrafts)
        .filter((item) => item !== Number(updated.id));

      for (const duplicateId of staleDuplicateIds) {
        await strapi.entityService.delete('api::qc-draft.qc-draft', duplicateId);
      }

      return successResponse('Tiếp tục phiếu nháp hiện có thành công', {
        draft: toDraftDto(updated),
        reused: true,
      });
    }

    const created = await strapi.entityService.create('api::qc-draft.qc-draft', {
      data: {
        store: Number(access.store.id),
        auditor: Number(user.id),
        template_id: templateId,
        audited_at: auditedAt,
        note: String(payload.note || '').trim(),
        criteria_states: sanitizeCriteriaStates(payload.criteriaStates || payload.criteria_states),
      },
      populate: draftPopulate,
    });

    return successResponse('Tạo phiếu nháp thành công', {
      draft: toDraftDto(created),
      reused: false,
    });
  },

  async updateDraft(ctx) {
    const user = ctx.state?.userDetail || {};
    if (!user?.id) {
      return errorResponse(ctx, 401, 'Bạn chưa đăng nhập');
    }

    const draftId = Number(ctx.params.id);
    if (!Number.isInteger(draftId) || draftId <= 0) {
      return errorResponse(ctx, 400, 'id nháp không hợp lệ');
    }

    const payload = normalizePayload(ctx.request.body || {});
    const allowedStoreIds = await getAllowedStoreInternalIds(strapi, user);

    const access = await ensureDraftAccess(strapi, { user, draftId, allowedStoreIds });
    if (!access.ok) {
      return errorResponse(ctx, access.status, access.message);
    }

    const draftOwnerId = Number(access.draft?.auditor?.id || user.id);
    const data = {};
    if (payload.templateId !== undefined || payload.template_id !== undefined) {
      const templateId = String(payload.templateId || payload.template_id || '').trim();
      if (!templateId) {
        return errorResponse(ctx, 400, 'templateId không hợp lệ');
      }
      data.template_id = templateId;
    }

    if (payload.auditedAt !== undefined || payload.audited_at !== undefined) {
      const auditedAt = normalizeDateTime(payload.auditedAt || payload.audited_at, new Date());
      if (!auditedAt) {
        return errorResponse(ctx, 400, 'auditedAt không hợp lệ');
      }
      data.audited_at = auditedAt;
    }

    if (payload.note !== undefined) {
      data.note = String(payload.note || '').trim();
    }

    if (payload.criteriaStates !== undefined || payload.criteria_states !== undefined) {
      data.criteria_states = sanitizeCriteriaStates(payload.criteriaStates || payload.criteria_states);
    }

    if (payload.storeId !== undefined || payload.store_id !== undefined) {
      const storeId = Number(payload.storeId || payload.store_id);
      if (!Number.isInteger(storeId) || storeId <= 0) {
        return errorResponse(ctx, 400, 'storeId không hợp lệ');
      }
      const storeAccess = await ensureStoreAccess(strapi, { user, storeId, allowedStoreIds });
      if (!storeAccess.ok) {
        return errorResponse(ctx, storeAccess.status, storeAccess.message);
      }
      data.store = Number(storeAccess.store.id);
    }

    const currentStoreId = Number(access.draft?.store?.id || 0);
    const currentTemplateId = String(access.draft?.template_id || '').trim();
    const nextStoreId = Number(data.store || currentStoreId || 0);
    const nextTemplateId = String(data.template_id || currentTemplateId || '').trim();
    if (nextStoreId > 0 && nextTemplateId) {
      const duplicateDrafts = await findScopedDrafts(strapi, {
        userId: draftOwnerId,
        storeId: nextStoreId,
        templateId: nextTemplateId,
        excludeDraftId: draftId,
        limit: 1,
      });

      const scopeChanged = nextStoreId !== currentStoreId || nextTemplateId !== currentTemplateId;
      if (scopeChanged && Array.isArray(duplicateDrafts) && duplicateDrafts.length > 0) {
        return errorResponse(ctx, 409, 'Đã tồn tại phiếu nháp khác cho cửa hàng và biểu mẫu này');
      }
    }

    const updated = await strapi.entityService.update('api::qc-draft.qc-draft', draftId, {
      data,
      populate: draftPopulate,
    });

    if (nextStoreId > 0 && nextTemplateId) {
      const staleDuplicateDrafts = await findScopedDrafts(strapi, {
        userId: draftOwnerId,
        storeId: nextStoreId,
        templateId: nextTemplateId,
        excludeDraftId: draftId,
        limit: DRAFT_SCAN_LIMIT,
      });

      const staleDuplicateIds = normalizeDraftIds(staleDuplicateDrafts);
      for (const duplicateId of staleDuplicateIds) {
        await strapi.entityService.delete('api::qc-draft.qc-draft', duplicateId);
      }
    }

    return successResponse('Cập nhật phiếu nháp thành công', {
      draft: toDraftDto(updated),
    });
  },

  async deleteDraft(ctx) {
    const user = ctx.state?.userDetail || {};
    if (!user?.id) {
      return errorResponse(ctx, 401, 'Bạn chưa đăng nhập');
    }

    const draftId = Number(ctx.params.id);
    if (!Number.isInteger(draftId) || draftId <= 0) {
      return errorResponse(ctx, 400, 'id nháp không hợp lệ');
    }

    const allowedStoreIds = await getAllowedStoreInternalIds(strapi, user);
    const access = await ensureDraftAccess(strapi, { user, draftId, allowedStoreIds });
    if (!access.ok) {
      return errorResponse(ctx, access.status, access.message);
    }

    const relatedDrafts = await findScopedDrafts(strapi, {
      userId: Number(access.draft?.auditor?.id || user.id),
      storeId: Number(access.draft?.store?.id || 0),
      templateId: access.draft?.template_id,
      limit: DRAFT_SCAN_LIMIT,
    });

    const relatedIds = normalizeDraftIds(relatedDrafts);

    const draftIdsToDelete = relatedIds.length > 0
      ? relatedIds
      : [draftId];

    for (const relatedId of draftIdsToDelete) {
      await strapi.entityService.delete('api::qc-draft.qc-draft', relatedId);
    }

    return successResponse('Xóa phiếu nháp thành công', {
      id: String(draftId),
      deletedIds: draftIdsToDelete.map((item) => String(item)),
    });
  },
}));
