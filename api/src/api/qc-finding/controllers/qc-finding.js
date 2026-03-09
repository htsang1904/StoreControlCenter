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

const normalizePayload = (payload = {}) => {
  if (payload && typeof payload === 'object' && payload.data && typeof payload.data === 'object') {
    return payload.data;
  }

  return payload || {};
};

const safeString = (value, fallback = '') => {
  const text = String(value ?? '').trim();
  return text || fallback;
};

const toNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const normalizeStatus = (value) => {
  const normalized = safeString(value).toLowerCase();
  if (['open', 'in_progress', 'resolved', 'verified', 'rejected'].includes(normalized)) {
    return normalized;
  }
  return 'open';
};

const normalizeSeverity = (value) => {
  const normalized = safeString(value).toLowerCase();
  if (['low', 'medium', 'high', 'critical'].includes(normalized)) {
    return normalized;
  }
  return 'medium';
};

const buildFindingCode = () => {
  const timestamp = new Date().toISOString().replace(/[-:.TZ]/g, '').slice(2, 14);
  const randomPart = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `QCF-${timestamp}-${randomPart}`;
};

const serializeFinding = (finding = {}) => ({
  id: Number(finding?.id || 0),
  finding_code: safeString(finding?.finding_code),
  criterion_name: safeString(finding?.criterion_name),
  severity: normalizeSeverity(finding?.severity),
  status: normalizeStatus(finding?.status),
  due_date: finding?.due_date || null,
  corrective_action: safeString(finding?.corrective_action),
  corrective_note: safeString(finding?.corrective_note),
  resolved_at: finding?.resolved_at || null,
  verified_at: finding?.verified_at || null,
  evidence: Array.isArray(finding?.evidence) ? finding.evidence : [],
  createdAt: finding?.createdAt || null,
  updatedAt: finding?.updatedAt || null,
  session: finding?.session || null,
  session_item: finding?.session_item || null,
  store: finding?.store || null,
  assignee: finding?.assignee || null,
  verifier: finding?.verifier || null,
});

module.exports = createCoreController('api::qc-finding.qc-finding', ({ strapi }) => ({
  async listAppFindings(ctx) {
    const findings = await strapi.entityService.findMany('api::qc-finding.qc-finding', {
      filters: ctx.query.filters || {},
      sort: ctx.query.sort || 'createdAt:desc',
      populate: {
        session: {
          fields: ['id'],
        },
        session_item: {
          fields: ['id'],
        },
        store: {
          fields: ['id', 'name', 'code'],
        },
        assignee: {
          fields: ['id', 'full_name', 'username', 'email'],
        },
        verifier: {
          fields: ['id', 'full_name', 'username', 'email'],
        },
      },
      limit: Math.max(toNumber(ctx.query.limit, 200), 1),
    });

    return successResponse('Lấy danh sách QC finding thành công', {
      items: (Array.isArray(findings) ? findings : []).map((item) => serializeFinding(item)),
    });
  },

  async createAppFinding(ctx) {
    const payload = normalizePayload(ctx.request.body);
    const storeId = toNumber(payload.store || payload.store_id);
    const sessionId = toNumber(payload.session || payload.session_id);
    const sessionItemId = toNumber(payload.session_item || payload.session_item_id);

    if (!storeId || !sessionId) {
      return errorResponse(ctx, 400, 'QC finding cần store và session hợp lệ');
    }

    const finding = await strapi.entityService.create('api::qc-finding.qc-finding', {
      data: {
        finding_code: safeString(payload.finding_code, buildFindingCode()),
        store: storeId,
        session: sessionId,
        session_item: sessionItemId || null,
        criterion_name: safeString(payload.criterion_name),
        severity: normalizeSeverity(payload.severity),
        status: normalizeStatus(payload.status),
        due_date: payload.due_date || null,
        corrective_action: safeString(payload.corrective_action),
        corrective_note: safeString(payload.corrective_note),
        resolved_at: payload.resolved_at || null,
        verified_at: payload.verified_at || null,
        evidence: Array.isArray(payload.evidence) ? payload.evidence : [],
      },
      populate: {
        session: {
          fields: ['id'],
        },
        session_item: {
          fields: ['id'],
        },
        store: {
          fields: ['id', 'name', 'code'],
        },
      },
    });

    return successResponse('Tạo QC finding thành công', {
      item: serializeFinding(finding),
    });
  },

  async updateAppFinding(ctx) {
    const findingId = toNumber(ctx.params.id);
    if (!findingId) {
      return errorResponse(ctx, 400, 'Mã finding không hợp lệ');
    }

    const payload = normalizePayload(ctx.request.body);
    const existing = await strapi.entityService.findOne('api::qc-finding.qc-finding', findingId, {
      fields: ['id'],
    });

    if (!existing) {
      return errorResponse(ctx, 404, 'Không tìm thấy QC finding');
    }

    const nextData = {};
    if (payload.status !== undefined) nextData.status = normalizeStatus(payload.status);
    if (payload.severity !== undefined) nextData.severity = normalizeSeverity(payload.severity);
    if (payload.corrective_action !== undefined) nextData.corrective_action = safeString(payload.corrective_action);
    if (payload.corrective_note !== undefined) nextData.corrective_note = safeString(payload.corrective_note);
    if (payload.due_date !== undefined) nextData.due_date = payload.due_date || null;
    if (payload.resolved_at !== undefined) nextData.resolved_at = payload.resolved_at || null;
    if (payload.verified_at !== undefined) nextData.verified_at = payload.verified_at || null;
    if (payload.evidence !== undefined) nextData.evidence = Array.isArray(payload.evidence) ? payload.evidence : [];

    const updated = await strapi.entityService.update('api::qc-finding.qc-finding', findingId, {
      data: nextData,
      populate: {
        session: {
          fields: ['id'],
        },
        session_item: {
          fields: ['id'],
        },
        store: {
          fields: ['id', 'name', 'code'],
        },
        assignee: {
          fields: ['id', 'full_name', 'username', 'email'],
        },
        verifier: {
          fields: ['id', 'full_name', 'username', 'email'],
        },
      },
    });

    return successResponse('Cập nhật QC finding thành công', {
      item: serializeFinding(updated),
    });
  },
}));
