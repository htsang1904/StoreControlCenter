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

const normalizeDateBoundary = (value, mode) => {
  if (!value) return null;
  const normalized = String(value).trim();
  if (!normalized) return null;

  const candidate = mode === 'end'
    ? new Date(`${normalized}T23:59:59.999Z`)
    : new Date(`${normalized}T00:00:00.000Z`);

  if (Number.isNaN(candidate.getTime())) return null;
  return candidate.toISOString();
};

const toNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const round1 = (value) => Math.round(toNumber(value) * 10) / 10;

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

const normalizeSortBy = (value) => {
  const allowed = ['totalSessions', 'avgScore', 'scoreRate', 'failed', 'passRate', 'lastAuditedAt'];
  const normalized = String(value || '').trim();
  return allowed.includes(normalized) ? normalized : 'totalSessions';
};

const normalizeSortDir = (value) => (String(value || '').toLowerCase() === 'asc' ? 'asc' : 'desc');

const buildSummary = (rows = []) => {
  const source = Array.isArray(rows) ? rows : [];
  const metrics = source.reduce((acc, item) => {
    acc.totalSessions += Number(item?.totalSessions || 0);
    acc.passed += Number(item?.passed || 0);
    acc.failed += Number(item?.failed || 0);
    acc.totalScore += Number(item?.totalScore || 0);
    acc.maxScore += Number(item?.maxScore || 0);
    return acc;
  }, {
    totalSessions: 0,
    passed: 0,
    failed: 0,
    totalScore: 0,
    maxScore: 0,
  });

  return {
    totalSessions: metrics.totalSessions,
    passed: metrics.passed,
    failed: metrics.failed,
    avgScore: metrics.totalSessions > 0 ? round1(metrics.totalScore / metrics.totalSessions) : 0,
    avgMaxScore: metrics.totalSessions > 0 ? round1(metrics.maxScore / metrics.totalSessions) : 0,
    scoreRate: metrics.maxScore > 0 ? round1((metrics.totalScore / metrics.maxScore) * 100) : 0,
    passRate: metrics.totalSessions > 0
      ? Math.round((metrics.passed / metrics.totalSessions) * 100)
      : 0,
  };
};

const compareValues = (left, right, direction = 'desc') => {
  if (left === right) return 0;
  if (direction === 'asc') return left > right ? 1 : -1;
  return left > right ? -1 : 1;
};

const SESSION_FETCH_CHUNK = 2000;

const normalizeResultFilter = (value) => {
  const normalized = String(value || '').trim().toLowerCase();
  if (!normalized) return '';
  if (normalized === 'pass' || normalized === 'passed') return 'pass';
  if (normalized === 'fail' || normalized === 'failed') return 'fail';
  return '';
};

const walkSessionsInChunks = async (strapi, options, onChunk) => {
  let start = 0;

  while (true) {
    const rows = await strapi.entityService.findMany('api::qc-session.qc-session', {
      ...options,
      start,
      limit: SESSION_FETCH_CHUNK,
    });

    const list = Array.isArray(rows) ? rows : [];
    if (!list.length) break;

    await onChunk(list);
    if (list.length < SESSION_FETCH_CHUNK) break;
    start += list.length;
  }
};

const normalizePayload = (payload = {}) => {
  if (payload && typeof payload === 'object' && payload.data && typeof payload.data === 'object') {
    return payload.data;
  }
  return payload || {};
};

const normalizeCriterionMode = (value) => {
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized === 'pass_fail' || normalized === 'passfail' || normalized === 'binary') return 'pass_fail';
  return 'point';
};

const normalizeCriterionStatus = (value) => {
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized === 'pass' || normalized === 'passed') return 'pass';
  if (normalized === 'fail' || normalized === 'failed') return 'fail';
  if (normalized === 'na' || normalized === 'not_applicable') return 'na';
  if (normalized === 'skipped_weekly' || normalized === 'weekly_skipped') return 'skipped_weekly';
  if (normalized === 'pending') return 'pending';
  return '';
};

const normalizeDateTime = (value, fallback = new Date()) => {
  const source = value ? new Date(value) : new Date(fallback);
  if (Number.isNaN(source.getTime())) return null;
  return source.toISOString();
};

const safeString = (value, fallback = '') => {
  const text = String(value ?? '').trim();
  return text || fallback;
};

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

const buildSessionCode = () => {
  const now = new Date();
  const year = String(now.getFullYear()).slice(-2);
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const tail = `${Date.now().toString().slice(-6)}${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`;
  return `QC-${year}${month}-${tail}`;
};

const parseThreshold = (value, fallback = 0) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return parsed >= 0 ? parsed : fallback;
};

const toBoolean = (value, fallback = false) => {
  if (value === undefined || value === null) return fallback;
  if (typeof value === 'boolean') return value;
  const normalized = String(value).trim().toLowerCase();
  if (normalized === 'true' || normalized === '1' || normalized === 'yes') return true;
  if (normalized === 'false' || normalized === '0' || normalized === 'no') return false;
  return fallback;
};

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

const resolveFormVersion = async (strapi, payload = {}) => {
  const directId = Number(payload.formVersionId || payload.form_version_id || 0);
  if (Number.isInteger(directId) && directId > 0) {
    const direct = await strapi.entityService.findOne('api::qc-form-version.qc-form-version', directId, {
      populate: {
        form: { fields: ['id', 'code', 'name'] },
      },
    });
    if (direct) return direct;
  }

  const templateCode = safeString(payload.templateId || payload.template_id, 'default');
  const templateName = safeString(payload.templateName || payload.template_name, templateCode);
  const templateVersion = safeString(payload.templateVersion || payload.template_version, 'v1.0');
  const passThreshold = parseThreshold(payload.templatePassThreshold ?? payload.template_pass_threshold, 0);
  const allowAutoCreate = toBoolean(
    payload.allowTemplateAutocreate ??
    payload.allow_template_autocreate,
    false
  );

  const forms = await strapi.entityService.findMany('api::qc-form.qc-form', {
    filters: { code: templateCode },
    fields: ['id', 'code', 'name'],
    limit: 1,
  });

  let form = Array.isArray(forms) && forms.length > 0 ? forms[0] : null;
  if (!form && allowAutoCreate) {
    form = await strapi.entityService.create('api::qc-form.qc-form', {
      data: {
        code: templateCode,
        name: templateName,
        description: `Auto-created from QC session payload (${templateCode})`,
        is_active: true,
      },
    });
  }

  if (!form?.id) {
    return null;
  }

  const versionFilters = {
    form: { id: Number(form.id) },
    ...(templateVersion ? { version_no: templateVersion } : {}),
  };

  const versions = await strapi.entityService.findMany('api::qc-form-version.qc-form-version', {
    filters: versionFilters,
    sort: { createdAt: 'desc' },
    populate: {
      form: { fields: ['id', 'code', 'name'] },
    },
    limit: 1,
  });

  if (Array.isArray(versions) && versions.length > 0) {
    return versions[0];
  }

  if (!allowAutoCreate) {
    return null;
  }

  return strapi.entityService.create('api::qc-form-version.qc-form-version', {
    data: {
      form: Number(form.id),
      version_no: templateVersion,
      status: 'published',
      pass_rule: {
        passThreshold,
      },
    },
    populate: {
      form: { fields: ['id', 'code', 'name'] },
    },
  });
};

const normalizeCriteriaPayload = (criteria = [], passThreshold = 0) => {
  const source = Array.isArray(criteria) ? criteria : [];

  const metrics = {
    totalScore: 0,
    maxScore: 0,
    failedCount: 0,
    pendingCount: 0,
  };

  const items = source.map((criterion, index) => {
    const mode = normalizeCriterionMode(criterion?.mode || criterion?.scoreType);
    const criterionName = safeString(criterion?.name, `Tiêu chí ${index + 1}`);
    const incomingStatus = normalizeCriterionStatus(criterion?.status);
    const isExcludedStatus = incomingStatus === 'na' || incomingStatus === 'skipped_weekly';

    const rawMax = Number(criterion?.maxScore);
    const maxScore = mode === 'pass_fail'
      ? 1
      : (Number.isFinite(rawMax) && rawMax > 0 ? rawMax : 0);

    const passScoreDefault = mode === 'pass_fail' ? 1 : maxScore;
    const passScore = clamp(
      parseThreshold(criterion?.passScore ?? criterion?.minPassScore, passScoreDefault),
      0,
      Math.max(passScoreDefault, maxScore)
    );

    let status = incomingStatus || '';
    let score = null;

    if (!isExcludedStatus) {
      if (mode === 'pass_fail') {
        if (!status) {
          const scoreHint = Number(criterion?.score);
          if (scoreHint === 1) status = 'pass';
          if (scoreHint === 0) status = 'fail';
        }
        if (!status) status = 'pending';
        if (status === 'pass') score = 1;
        if (status === 'fail') score = 0;
      } else {
        const scoreHint = Number(criterion?.score);
        if (Number.isFinite(scoreHint)) {
          score = clamp(scoreHint, 0, maxScore);
          if (!status) status = score >= passScore ? 'pass' : 'fail';
        }
        if (!status) status = 'pending';
      }
    }

    if (status === 'pending') {
      metrics.pendingCount += 1;
    }

    const applicable = status !== 'na';
    const excluded = status === 'na' || status === 'skipped_weekly';
    if (!excluded && status !== 'pending') {
      if (mode === 'pass_fail') {
        metrics.maxScore += 1;
        metrics.totalScore += status === 'pass' ? 1 : 0;
      } else {
        metrics.maxScore += maxScore;
        metrics.totalScore += Number(score || 0);
      }
      if (status === 'fail') {
        metrics.failedCount += 1;
      }
    }

    return {
      criterion_code: safeString(criterion?.id),
      criterion_name: criterionName,
      mode_snapshot: mode,
      max_score_snapshot: mode === 'pass_fail' ? 1 : maxScore,
      weight_snapshot: parseThreshold(criterion?.weight, 1),
      frequency_snapshot: String(criterion?.frequency || '').toLowerCase() === 'weekly_once' ? 'weekly_once' : 'per_audit',
      result: status || 'pending',
      score: status === 'pending' || status === 'na' || status === 'skipped_weekly' ? null : score,
      applicable,
      requires_fix: status === 'fail',
      note: safeString(criterion?.note),
      attachments: Array.isArray(criterion?.attachments) ? criterion.attachments : [],
    };
  });

  return {
    items,
    metrics,
  };
};

const toSessionResult = ({ metrics, passThreshold }) => {
  const normalizedThreshold = parseThreshold(passThreshold, 0);
  if (metrics.pendingCount > 0) {
    return {
      result: 'pending',
      status: 'draft',
      submittedAt: null,
      reasons: ['pending'],
    };
  }

  const belowThreshold = metrics.maxScore > 0 && metrics.totalScore < normalizedThreshold;
  const hasFail = metrics.failedCount > 0;
  const result = hasFail || belowThreshold ? 'fail' : 'pass';

  return {
    result,
    status: result === 'fail' ? 'needs_fix' : 'closed',
    submittedAt: new Date().toISOString(),
    reasons: [
      ...(hasFail ? ['failed'] : []),
      ...(belowThreshold ? ['threshold'] : []),
    ],
  };
};

const isDuplicateCodeError = (error) => {
  const message = String(error?.message || '').toLowerCase();
  return message.includes('unique') && message.includes('code');
};

const createSessionWithItemsTx = async (strapi, { sessionData, items }) => {
  const maxAttempts = 3;
  let attempt = 0;

  while (attempt < maxAttempts) {
    const sessionCode = attempt === 0
      ? safeString(sessionData.code, buildSessionCode())
      : buildSessionCode();

    try {
      const created = await strapi.db.connection.transaction(async (trx) => {
        const session = await strapi.db.query('api::qc-session.qc-session').create({
          data: {
            ...sessionData,
            code: sessionCode,
          },
          transacting: trx,
        });

        for (const item of items) {
          await strapi.db.query('api::qc-session-item.qc-session-item').create({
            data: {
              session: Number(session.id),
              criterion_code: safeString(item.criterion_code),
              criterion_name: safeString(item.criterion_name),
              mode_snapshot: item.mode_snapshot,
              max_score_snapshot: Number(item.max_score_snapshot || 0),
              weight_snapshot: Number(item.weight_snapshot || 1),
              frequency_snapshot: item.frequency_snapshot || 'per_audit',
              result: item.result,
              score: item.score,
              applicable: item.applicable !== false,
              requires_fix: Boolean(item.requires_fix),
              note: safeString(item.note),
              attachments: item.attachments || [],
            },
            transacting: trx,
          });
        }

        return session;
      });

      return created;
    } catch (error) {
      attempt += 1;
      if (!isDuplicateCodeError(error) || attempt >= maxAttempts) {
        throw error;
      }
    }
  }

  throw new Error('SESSION_CREATE_FAILED');
};

module.exports = createCoreController('api::qc-session.qc-session', ({ strapi }) => ({
  async storeOverview(ctx) {
    const query = ctx.query || {};
    const user = ctx.state?.userDetail || {};
    const userRole = user.role || 'store';
    const keyword = String(query.q || '').trim().toLowerCase();
    const dateFrom = normalizeDateBoundary(query.date_from, 'start');
    const dateTo = normalizeDateBoundary(query.date_to, 'end');
    const page = Math.max(toNumber(query.page, 1), 1);
    const pageSize = Math.min(Math.max(toNumber(query.pageSize, 20), 1), 5000);
    const sortBy = normalizeSortBy(query.sort_by);
    const sortDir = normalizeSortDir(query.sort_dir);

    if ((query.date_from && !dateFrom) || (query.date_to && !dateTo)) {
      return errorResponse(ctx, 400, 'Khoảng ngày không hợp lệ');
    }

    const requestedStoreIds = parseStoreIds(query.store_ids ?? query.store_id);
    const scopedStoreIds = (() => {
      if (userRole !== 'store') return requestedStoreIds;

      const allowed = parseStoreIds(user.store_ids);
      if (!allowed.length) return [];
      if (!requestedStoreIds.length) return allowed;

      const allowedSet = new Set(allowed);
      return requestedStoreIds.filter((item) => allowedSet.has(item));
    })();

    if (userRole === 'store' && !scopedStoreIds.length) {
      return successResponse('Lấy thống kê QC theo cửa hàng thành công', {
        summary: buildSummary([]),
        storeStats: [],
        pagination: {
          page,
          pageSize,
          total: 0,
          pageCount: 0,
        },
      });
    }

    const storeFilters = {};
    if (scopedStoreIds.length > 0) {
      storeFilters.storeId = { $in: scopedStoreIds.map((item) => String(item)) };
    }
    if (keyword) {
      storeFilters.$or = [
        { code: { $containsi: keyword } },
        { name: { $containsi: keyword } },
        { shortAddress: { $containsi: keyword } },
        { address: { $containsi: keyword } },
        { storeId: { $containsi: keyword } },
      ];
    }

    const stores = await strapi.entityService.findMany('api::store.store', {
      filters: storeFilters,
      fields: ['id', 'storeId', 'code', 'name', 'shortAddress', 'address'],
      sort: { id: 'asc' },
      publicationState: 'live',
      limit: 10000,
    });

    const storeRows = Array.isArray(stores) ? stores : [];
    if (!storeRows.length) {
      return successResponse('Lấy thống kê QC theo cửa hàng thành công', {
        summary: buildSummary([]),
        storeStats: [],
        pagination: {
          page,
          pageSize,
          total: 0,
          pageCount: 0,
        },
      });
    }

    const storeIds = storeRows
      .map((item) => Number(item?.id))
      .filter((item) => Number.isInteger(item) && item > 0);

    const sessionFilters = {
      store: { id: { $in: storeIds } },
    };

    if (dateFrom || dateTo) {
      sessionFilters.audited_at = {};
      if (dateFrom) sessionFilters.audited_at.$gte = dateFrom;
      if (dateTo) sessionFilters.audited_at.$lte = dateTo;
    }

    const grouped = new Map(
      storeRows.map((store) => [
        Number(store.id),
        {
          storeId: Number(store.id),
          storeCode: store.code || '',
          storeNo: store.storeId || '',
          storeName: store.shortAddress || store.address || store.name || store.code || `Cửa hàng #${store.id}`,
          address: store.address || '',
          totalSessions: 0,
          passed: 0,
          failed: 0,
          totalScore: 0,
          maxScore: 0,
          avgScore: 0,
          avgMaxScore: 0,
          scoreRate: 0,
          passRate: 0,
          lastAuditedAt: null,
          lastSessionCode: null,
        },
      ])
    );

    await walkSessionsInChunks(
      strapi,
      {
        filters: sessionFilters,
        fields: ['id', 'code', 'result', 'total_score', 'max_score', 'audited_at'],
        populate: {
          store: { fields: ['id'] },
        },
      },
      async (rows) => {
        rows.forEach((session) => {
          const key = Number(session?.store?.id);
          if (!grouped.has(key)) return;

          const row = grouped.get(key);
          row.totalSessions += 1;
          if (session?.result === 'pass') row.passed += 1;
          if (session?.result === 'fail') row.failed += 1;
          row.totalScore += toNumber(session?.total_score);
          row.maxScore += toNumber(session?.max_score);

          const auditedAt = session?.audited_at ? new Date(session.audited_at).toISOString() : null;
          if (auditedAt && (!row.lastAuditedAt || auditedAt > row.lastAuditedAt)) {
            row.lastAuditedAt = auditedAt;
            row.lastSessionCode = String(session?.code || '');
          }
        });
      }
    );

    const computedRows = Array.from(grouped.values()).map((row) => {
      const avgScore = row.totalSessions > 0 ? round1(row.totalScore / row.totalSessions) : 0;
      const avgMaxScore = row.totalSessions > 0 ? round1(row.maxScore / row.totalSessions) : 0;
      const scoreRate = row.maxScore > 0 ? round1((row.totalScore / row.maxScore) * 100) : 0;
      const passRate = row.totalSessions > 0 ? Math.round((row.passed / row.totalSessions) * 100) : 0;

      return {
        ...row,
        avgScore,
        avgMaxScore,
        scoreRate,
        passRate,
      };
    });

    const sortedRows = computedRows.sort((left, right) => {
      if (sortBy === 'lastAuditedAt') {
        const leftValue = left.lastAuditedAt || '';
        const rightValue = right.lastAuditedAt || '';
        const compared = compareValues(leftValue, rightValue, sortDir);
        if (compared !== 0) return compared;
      } else {
        const leftValue = toNumber(left?.[sortBy]);
        const rightValue = toNumber(right?.[sortBy]);
        const compared = compareValues(leftValue, rightValue, sortDir);
        if (compared !== 0) return compared;
      }

      return String(left.storeName || '').localeCompare(String(right.storeName || ''), 'vi');
    });

    const total = sortedRows.length;
    const start = (page - 1) * pageSize;
    const pagedRows = sortedRows.slice(start, start + pageSize);

    return successResponse('Lấy thống kê QC theo cửa hàng thành công', {
      summary: buildSummary(computedRows),
      storeStats: pagedRows,
      pagination: {
        page,
        pageSize,
        total,
        pageCount: Math.ceil(total / pageSize),
      },
    });
  },

  async overview(ctx) {
    const query = ctx.query || {};
    const user = ctx.state?.userDetail || {};
    const userRole = user.role || 'store';
    const storeId = query.store_id ? Number(query.store_id) : null;
    const keyword = String(query.q || '').trim().toLowerCase();
    const resultFilter = normalizeResultFilter(query.status);
    const templateCode = safeString(query.template_id || query.templateId);
    const page = Math.max(toNumber(query.page, 1), 1);
    const pageSize = Math.min(Math.max(toNumber(query.pageSize, 10), 1), 100);
    const start = (page - 1) * pageSize;

    const filters = {};
    if (storeId !== null && (!Number.isInteger(storeId) || storeId <= 0)) {
      return errorResponse(ctx, 400, 'store_id không hợp lệ');
    }

    if (userRole === 'store') {
      const allowedStoreNos = parseStoreIds(user.store_ids);
      if (!allowedStoreNos.length) {
        return successResponse('Lấy tổng quan QC session thành công', {
          summary: {
            totalSessions: 0,
            passed: 0,
            failed: 0,
            avgScore: 0,
            scoreRate: 0,
          },
          sessions: [],
          pagination: {
            page,
            pageSize,
            total: 0,
            pageCount: 0,
          },
        });
      }

      const allowedStores = await strapi.entityService.findMany('api::store.store', {
        filters: {
          storeId: { $in: allowedStoreNos.map((item) => String(item)) },
        },
        fields: ['id'],
        publicationState: 'live',
        limit: 10000,
      });

      const allowedStoreIds = (Array.isArray(allowedStores) ? allowedStores : [])
        .map((item) => Number(item?.id))
        .filter((item) => Number.isInteger(item) && item > 0);

      if (!allowedStoreIds.length) {
        return successResponse('Lấy tổng quan QC session thành công', {
          summary: {
            totalSessions: 0,
            passed: 0,
            failed: 0,
            avgScore: 0,
            scoreRate: 0,
          },
          sessions: [],
          pagination: {
            page,
            pageSize,
            total: 0,
            pageCount: 0,
          },
        });
      }

      if (storeId !== null) {
        if (!allowedStoreIds.includes(storeId)) {
          return successResponse('Lấy tổng quan QC session thành công', {
            summary: {
              totalSessions: 0,
              passed: 0,
              failed: 0,
              avgScore: 0,
              scoreRate: 0,
            },
            sessions: [],
            pagination: {
              page,
              pageSize,
              total: 0,
              pageCount: 0,
            },
          });
        }
        filters.store = { id: storeId };
      } else {
        filters.store = { id: { $in: allowedStoreIds } };
      }
    } else if (storeId !== null) {
      filters.store = { id: storeId };
    }

    const dateFrom = normalizeDateBoundary(query.date_from, 'start');
    const dateTo = normalizeDateBoundary(query.date_to, 'end');
    if ((query.date_from && !dateFrom) || (query.date_to && !dateTo)) {
      return errorResponse(ctx, 400, 'Khoảng ngày không hợp lệ');
    }
    if (dateFrom || dateTo) {
      filters.audited_at = {};
      if (dateFrom) filters.audited_at.$gte = dateFrom;
      if (dateTo) filters.audited_at.$lte = dateTo;
    }

    if (resultFilter) {
      filters.result = resultFilter;
    }

    if (templateCode) {
      filters.form_version = {
        form: {
          code: {
            $eqi: templateCode,
          },
        },
      };
    }

    if (keyword) {
      filters.$or = [
        { code: { $containsi: keyword } },
        { note: { $containsi: keyword } },
      ];
    }

    const [rows, total] = await Promise.all([
      strapi.entityService.findMany('api::qc-session.qc-session', {
        filters,
        sort: { audited_at: 'desc' },
        populate: {
          store: { fields: ['id', 'storeId', 'code', 'shortAddress', 'address'] },
          form_version: {
            fields: ['id', 'version_no', 'status', 'pass_rule'],
            populate: {
              form: { fields: ['id', 'code', 'name'] },
            },
          },
          auditor: { fields: ['id', 'name', 'email'] },
          items: {
            fields: [
              'id',
              'criterion_code',
              'criterion_name',
              'mode_snapshot',
              'max_score_snapshot',
              'frequency_snapshot',
              'result',
              'score',
              'note',
              'attachments',
            ],
          },
        },
        start,
        limit: pageSize,
      }),
      strapi.db.query('api::qc-session.qc-session').count({ where: filters }),
    ]);

    const sessions = Array.isArray(rows) ? rows : [];
    const summary = {
      totalSessions: 0,
      passed: 0,
      failed: 0,
      totalScore: 0,
      maxScore: 0,
    };

    await walkSessionsInChunks(
      strapi,
      {
        filters,
        fields: ['result', 'total_score', 'max_score'],
      },
      async (chunk) => {
        chunk.forEach((item) => {
          summary.totalSessions += 1;
          if (item?.result === 'pass') summary.passed += 1;
          if (item?.result === 'fail') summary.failed += 1;
          summary.totalScore += Number(item?.total_score || 0);
          summary.maxScore += Number(item?.max_score || 0);
        });
      }
    );

    return successResponse('Lấy tổng quan QC session thành công', {
      summary: {
        totalSessions: summary.totalSessions,
        passed: summary.passed,
        failed: summary.failed,
        avgScore: summary.totalSessions > 0
          ? Math.round((summary.totalScore / summary.totalSessions) * 10) / 10
          : 0,
        scoreRate: summary.maxScore > 0
          ? Math.round((summary.totalScore / summary.maxScore) * 1000) / 10
          : 0,
      },
      sessions,
      pagination: {
        page,
        pageSize,
        total,
        pageCount: Math.ceil(total / pageSize),
      },
    });
  },

  async createSession(ctx) {
    const user = ctx.state?.userDetail || {};
    if (!user?.id) {
      return errorResponse(ctx, 401, 'Bạn chưa đăng nhập');
    }

    const payload = normalizePayload(ctx.request.body || {});
    const storeId = Number(payload.storeId || payload.store_id);
    if (!Number.isInteger(storeId) || storeId <= 0) {
      return errorResponse(ctx, 400, 'storeId không hợp lệ');
    }

    const auditedAt = normalizeDateTime(payload.auditedAt || payload.audited_at, new Date());
    if (!auditedAt) {
      return errorResponse(ctx, 400, 'auditedAt không hợp lệ');
    }

    const criteria = Array.isArray(payload.criteria) ? payload.criteria : [];
    if (!criteria.length) {
      return errorResponse(ctx, 400, 'Phiếu QC chưa có tiêu chí để lưu');
    }

    const allowedStoreIds = await getAllowedStoreInternalIds(strapi, user);
    const storeAccess = await ensureStoreAccess(strapi, { user, storeId, allowedStoreIds });
    if (!storeAccess.ok) {
      return errorResponse(ctx, storeAccess.status, storeAccess.message);
    }

    const formVersion = await resolveFormVersion(strapi, payload);
    if (!formVersion?.id) {
      return errorResponse(ctx, 400, 'Không tìm thấy form version phù hợp. Cần truyền formVersionId hợp lệ hoặc bật allowTemplateAutocreate.');
    }

    const passThreshold = parseThreshold(
      formVersion?.pass_rule?.passThreshold ??
      payload.templatePassThreshold ??
      payload.template_pass_threshold,
      0
    );

    const normalized = normalizeCriteriaPayload(criteria, passThreshold);
    if (!normalized.items.length) {
      return errorResponse(ctx, 400, 'Phiếu QC chưa có tiêu chí hợp lệ');
    }

    const decision = toSessionResult({
      metrics: normalized.metrics,
      passThreshold,
    });

    const createdSession = await createSessionWithItemsTx(strapi, {
      sessionData: {
        code: safeString(payload.code),
        store: Number(storeAccess.store.id),
        form_version: Number(formVersion.id),
        auditor: Number(user.id),
        status: decision.status,
        audited_at: auditedAt,
        submitted_at: decision.submittedAt,
        result: decision.result,
        total_score: normalized.metrics.totalScore,
        max_score: normalized.metrics.maxScore,
        note: safeString(payload.note),
      },
      items: normalized.items,
    });

    const session = await strapi.entityService.findOne('api::qc-session.qc-session', Number(createdSession.id), {
      populate: {
        store: { fields: ['id', 'storeId', 'code', 'shortAddress', 'address'] },
        form_version: {
          fields: ['id', 'version_no', 'status', 'pass_rule'],
          populate: {
            form: { fields: ['id', 'code', 'name'] },
          },
        },
        auditor: { fields: ['id', 'name', 'email'] },
        items: {
          fields: [
            'id',
            'criterion_code',
            'criterion_name',
            'mode_snapshot',
            'max_score_snapshot',
            'frequency_snapshot',
            'result',
            'score',
            'note',
            'attachments',
          ],
        },
      },
    });

    return successResponse('Tạo phiên QC thành công', {
      session,
      metrics: {
        ...normalized.metrics,
        passThreshold,
        reasons: decision.reasons,
      },
    });
  },

  async submit(ctx) {
    const sessionId = Number(ctx.params.id);
    if (!Number.isInteger(sessionId) || sessionId <= 0) {
      return errorResponse(ctx, 400, 'id phiên QC không hợp lệ');
    }

    const session = await strapi.entityService.findOne('api::qc-session.qc-session', sessionId, {
      populate: {
        items: true,
      },
    });

    if (!session) {
      return errorResponse(ctx, 404, 'Không tìm thấy phiên QC');
    }

    const items = Array.isArray(session.items) ? session.items : [];
    if (!items.length) {
      return errorResponse(ctx, 400, 'Phiên QC chưa có tiêu chí để submit');
    }

    const scoredItems = items.filter((item) => item?.result !== 'na' && item?.result !== 'skipped_weekly');
    const hasPending = scoredItems.some((item) => !item?.result || item.result === 'pending');
    if (hasPending) {
      return errorResponse(ctx, 400, 'Còn tiêu chí chưa chấm');
    }

    const totals = scoredItems.reduce((acc, item) => {
      const mode = String(item?.mode_snapshot || 'point');
      const max = Number(item?.max_score_snapshot || 0);
      const score = Number(item?.score || 0);
      if (mode === 'point') {
        acc.totalScore += score;
        acc.maxScore += max;
      } else {
        acc.maxScore += 1;
        acc.totalScore += item?.result === 'pass' ? 1 : 0;
      }
      if (item?.result === 'fail') acc.failedCount += 1;
      return acc;
    }, { totalScore: 0, maxScore: 0, failedCount: 0 });

    const result = totals.failedCount > 0 ? 'fail' : 'pass';
    const status = result === 'fail' ? 'needs_fix' : 'closed';

    const updated = await strapi.entityService.update('api::qc-session.qc-session', sessionId, {
      data: {
        status,
        result,
        total_score: totals.totalScore,
        max_score: totals.maxScore,
        submitted_at: new Date().toISOString(),
      },
      populate: {
        store: { fields: ['id', 'storeId', 'code', 'shortAddress', 'address'] },
        form_version: {
          fields: ['id', 'version_no', 'status', 'pass_rule'],
          populate: {
            form: { fields: ['id', 'code', 'name'] },
          },
        },
        auditor: { fields: ['id', 'name', 'email'] },
      },
    });

    return successResponse('Submit phiên QC thành công', {
      session: updated,
      metrics: {
        failedCount: totals.failedCount,
        totalScore: totals.totalScore,
        maxScore: totals.maxScore,
      },
    });
  },
}));
