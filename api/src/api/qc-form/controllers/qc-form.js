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

const toBoolean = (value, fallback = false) => {
  if (value === undefined || value === null) return fallback;
  if (typeof value === 'boolean') return value;

  const normalized = String(value).trim().toLowerCase();
  if (normalized === 'true' || normalized === '1' || normalized === 'yes') return true;
  if (normalized === 'false' || normalized === '0' || normalized === 'no') return false;
  return fallback;
};

const normalizeCode = (value) => safeString(value).toUpperCase();

const normalizeMode = (value) => {
  const normalized = safeString(value).toLowerCase();
  return normalized === 'pass_fail' ? 'pass_fail' : 'point';
};

const normalizeFrequency = (value) => {
  const normalized = safeString(value).toLowerCase();
  return normalized === 'weekly_once' ? 'weekly_once' : 'per_audit';
};

const normalizeStatus = (value) => {
  const normalized = safeString(value).toLowerCase();
  if (normalized === 'draft' || normalized === 'archived') return normalized;
  return 'published';
};

const isValidCode = (value) => /^[A-Z0-9_-]+$/.test(value);

const findLatestVersion = async (strapi, formId) => {
  const versions = await strapi.entityService.findMany('api::qc-form-version.qc-form-version', {
    filters: {
      form: { id: Number(formId) },
    },
    sort: { createdAt: 'desc' },
    populate: {
      form_criteria: {
        sort: ['sort_order:asc', 'id:asc'],
        populate: {
          criterion: {
            fields: [
              'id',
              'code',
              'name',
              'description',
              'level',
              'ordering',
              'default_mode',
              'default_max_score',
              'default_weight',
              'is_active',
            ],
            populate: {
              parent: {
                fields: ['id'],
              },
            },
          },
        },
      },
    },
    limit: 1,
  });

  return Array.isArray(versions) && versions.length > 0 ? versions[0] : null;
};

const findLatestPublishedVersion = async (strapi, formId) => {
  const versions = await strapi.entityService.findMany('api::qc-form-version.qc-form-version', {
    filters: {
      form: { id: Number(formId) },
      status: 'published',
    },
    sort: { createdAt: 'desc' },
    populate: {
      form_criteria: {
        sort: ['sort_order:asc', 'id:asc'],
        populate: {
          criterion: {
            fields: [
              'id',
              'code',
              'name',
              'description',
              'level',
              'ordering',
            ],
            populate: {
              parent: {
                fields: ['id'],
              },
            },
          },
        },
      },
    },
    limit: 1,
  });

  return Array.isArray(versions) && versions.length > 0 ? versions[0] : null;
};

const serializeAdminForm = (form, latestVersion = null) => ({
  id: Number(form?.id || 0),
  code: safeString(form?.code),
  name: safeString(form?.name),
  description: safeString(form?.description),
  isActive: form?.is_active !== false,
  latestVersion: latestVersion
    ? {
      id: Number(latestVersion.id),
      versionNo: safeString(latestVersion.version_no, '--'),
      status: normalizeStatus(latestVersion.status),
      passThreshold: toNumber(latestVersion?.pass_rule?.passThreshold, 40),
      criteria: (Array.isArray(latestVersion.form_criteria) ? latestVersion.form_criteria : []).map((item) => ({
        id: Number(item?.id || 0),
        code: normalizeCode(item?.criterion?.code),
        name: safeString(item?.criterion?.name),
        description: safeString(item?.criterion?.description),
        sectionName: safeString(item?.section_name, 'Tổng quát'),
        mode: normalizeMode(item?.mode),
        maxScore: normalizeMode(item?.mode) === 'pass_fail' ? 1 : Math.max(toNumber(item?.max_score, 0), 0),
        weight: Math.max(toNumber(item?.weight, 1), 0),
        frequency: normalizeFrequency(item?.frequency),
        isCritical: item?.is_critical === true,
        required: item?.required !== false,
      })),
    }
    : null,
});

const serializeRuntimeForm = (form, latestVersion = null) => ({
  id: Number(form?.id || 0),
  code: safeString(form?.code),
  name: safeString(form?.name),
  description: safeString(form?.description),
  activeVersionId: latestVersion ? Number(latestVersion.id) : null,
});

const serializeRuntimeFormDetail = (form, latestVersion = null) => ({
  id: Number(form?.id || 0),
  code: safeString(form?.code),
  name: safeString(form?.name),
  description: safeString(form?.description),
  version: safeString(latestVersion?.version_no, '--'),
  passThreshold: toNumber(latestVersion?.pass_rule?.passThreshold, 40),
  criteria: (Array.isArray(latestVersion?.form_criteria) ? latestVersion.form_criteria : []).map((item) => ({
    id: Number(item?.criterion?.id || 0),
    code: normalizeCode(item?.criterion?.code),
    name: safeString(item?.criterion?.name),
    description: safeString(item?.criterion?.description),
    level: toNumber(item?.criterion?.level, 1),
    ordering: safeString(item?.criterion?.ordering),
    parentId: toNumber(item?.criterion?.parent?.id, 0) || null,
    mode: normalizeMode(item?.mode),
    maxScore: normalizeMode(item?.mode) === 'pass_fail' ? 1 : Math.max(toNumber(item?.max_score, 0), 0),
    weight: Math.max(toNumber(item?.weight, 1), 0),
    sortOrder: toNumber(item?.sort_order, 0),
    isCritical: item?.is_critical === true,
    frequency: normalizeFrequency(item?.frequency),
    required: item?.required !== false,
  })),
});

const normalizeCriteriaInput = (ctx, criteriaInput = []) => {
  if (!Array.isArray(criteriaInput) || !criteriaInput.length) {
    return {
      error: errorResponse(ctx, 400, 'Biểu mẫu QC phải có ít nhất một tiêu chí'),
      criteria: [],
    };
  }

  const seenCriterionCodes = new Set();
  const normalizedCriteria = [];

  for (let index = 0; index < criteriaInput.length; index += 1) {
    const item = criteriaInput[index] || {};
    const criterionCode = normalizeCode(item.code);
    const criterionName = safeString(item.name);
    const sectionName = safeString(item.sectionName || item.section_name, 'Tổng quát');
    const description = safeString(item.description);
    const mode = normalizeMode(item.mode);
    const frequency = normalizeFrequency(item.frequency);
    const maxScore = mode === 'pass_fail'
      ? 1
      : Math.max(toNumber(item.maxScore ?? item.max_score, 10), 0);
    const weight = Math.max(toNumber(item.weight, 1), 0);

    if (!criterionCode || !criterionName) {
      return {
        error: errorResponse(ctx, 400, `Tiêu chí #${index + 1} thiếu mã hoặc tên`),
        criteria: [],
      };
    }

    if (!isValidCode(criterionCode)) {
      return {
        error: errorResponse(ctx, 400, `Mã tiêu chí "${criterionCode}" không hợp lệ`),
        criteria: [],
      };
    }

    if (seenCriterionCodes.has(criterionCode)) {
      return {
        error: errorResponse(ctx, 400, `Mã tiêu chí "${criterionCode}" bị trùng trong biểu mẫu`),
        criteria: [],
      };
    }

    seenCriterionCodes.add(criterionCode);
    normalizedCriteria.push({
      code: criterionCode,
      name: criterionName,
      description,
      sectionName,
      mode,
      maxScore,
      weight,
      frequency,
      isCritical: toBoolean(item.isCritical ?? item.is_critical, false),
      required: toBoolean(item.required, true),
      sortOrder: index + 1,
    });
  }

  return { error: null, criteria: normalizedCriteria };
};

const ensureCriteriaCatalog = async (strapi, normalizedCriteria = []) => {
  const criterionCodes = normalizedCriteria.map((item) => item.code);
  const existingCriteria = await strapi.entityService.findMany('api::qc-criterion.qc-criterion', {
    filters: {
      code: {
        $in: criterionCodes,
      },
    },
    fields: ['id', 'code', 'name', 'description', 'default_mode', 'default_max_score', 'default_weight', 'is_active'],
    limit: Math.max(criterionCodes.length, 1),
  });

  const criterionMap = new Map(
    (Array.isArray(existingCriteria) ? existingCriteria : [])
      .map((item) => [String(item.code || '').toUpperCase(), item])
  );

  for (const item of normalizedCriteria) {
    let criterion = criterionMap.get(item.code);

    if (!criterion) {
      criterion = await strapi.entityService.create('api::qc-criterion.qc-criterion', {
        data: {
          code: item.code,
          name: item.name,
          description: item.description,
          default_mode: item.mode,
          default_max_score: item.maxScore,
          default_weight: item.weight,
          is_active: true,
        },
      });
    } else {
      criterion = await strapi.entityService.update('api::qc-criterion.qc-criterion', criterion.id, {
        data: {
          name: item.name,
          description: item.description,
          default_mode: item.mode,
          default_max_score: item.maxScore,
          default_weight: item.weight,
          is_active: true,
        },
      });
    }

    criterionMap.set(item.code, criterion);
  }

  return criterionMap;
};

const syncVersionCriteria = async (strapi, versionId, normalizedCriteria = [], criterionMap = new Map()) => {
  const existingFormCriteria = await strapi.entityService.findMany('api::qc-form-criterion.qc-form-criterion', {
    filters: {
      form_version: {
        id: Number(versionId),
      },
    },
    fields: ['id'],
    limit: 1000,
  });

  for (const item of Array.isArray(existingFormCriteria) ? existingFormCriteria : []) {
    await strapi.entityService.delete('api::qc-form-criterion.qc-form-criterion', Number(item.id));
  }

  for (const item of normalizedCriteria) {
    const criterion = criterionMap.get(item.code);
    await strapi.entityService.create('api::qc-form-criterion.qc-form-criterion', {
      data: {
        form_version: Number(versionId),
        criterion: Number(criterion.id),
        section_name: item.sectionName,
        sort_order: item.sortOrder,
        mode: item.mode,
        max_score: item.maxScore,
        weight: item.weight,
        is_critical: item.isCritical,
        frequency: item.frequency,
        required: item.required,
      },
    });
  }
};

module.exports = createCoreController('api::qc-form.qc-form', ({ strapi }) => ({
  async listRuntimeForms(ctx) {
    const forms = await strapi.entityService.findMany('api::qc-form.qc-form', {
      filters: {
        is_active: true,
      },
      sort: { createdAt: 'desc' },
      fields: ['id', 'code', 'name', 'description', 'is_active'],
    });

    const items = [];
    for (const form of Array.isArray(forms) ? forms : []) {
      const latestVersion = await findLatestPublishedVersion(strapi, form.id);
      if (!latestVersion) continue;
      items.push(serializeRuntimeForm(form, latestVersion));
    }

    return successResponse('Lấy danh sách biểu mẫu QC thành công', {
      items,
    });
  },

  async getRuntimeForm(ctx) {
    const formId = Number(ctx.params.id || 0);
    if (!Number.isInteger(formId) || formId <= 0) {
      return errorResponse(ctx, 400, 'Mã biểu mẫu không hợp lệ');
    }

    const form = await strapi.entityService.findOne('api::qc-form.qc-form', formId, {
      fields: ['id', 'code', 'name', 'description', 'is_active'],
    });

    if (!form || form.is_active === false) {
      return errorResponse(ctx, 404, 'Không tìm thấy biểu mẫu QC');
    }

    const latestVersion = await findLatestPublishedVersion(strapi, form.id);
    if (!latestVersion) {
      return errorResponse(ctx, 404, 'Biểu mẫu QC chưa có phiên bản phát hành');
    }

    return successResponse('Lấy chi tiết biểu mẫu QC thành công', {
      item: serializeRuntimeFormDetail(form, latestVersion),
    });
  },

  async listAdminForms(ctx) {
    const rawPage = toNumber(ctx.query.page, 1);
    const rawPageSize = toNumber(ctx.query.pageSize, 10);
    const page = Math.max(Math.floor(rawPage), 1);
    const pageSize = Math.min(Math.max(Math.floor(rawPageSize), 1), 50);
    const start = (page - 1) * pageSize;

    const total = await strapi.db.query('api::qc-form.qc-form').count({
      where: {},
    });

    const forms = await strapi.entityService.findMany('api::qc-form.qc-form', {
      sort: { createdAt: 'desc' },
      populate: {
        versions: {
          fields: ['id', 'version_no', 'status', 'createdAt', 'updatedAt'],
        },
      },
      start,
      limit: pageSize,
    });

    return successResponse('Lấy danh sách biểu mẫu QC thành công', {
      items: Array.isArray(forms) ? forms : [],
      pagination: {
        page,
        pageSize,
        total,
        pageCount: total > 0 ? Math.ceil(total / pageSize) : 1,
      },
    });
  },

  async getAdminForm(ctx) {
    const formId = Number(ctx.params.id || 0);
    if (!Number.isInteger(formId) || formId <= 0) {
      return errorResponse(ctx, 400, 'Mã biểu mẫu không hợp lệ');
    }

    const form = await strapi.entityService.findOne('api::qc-form.qc-form', formId, {
      fields: ['id', 'code', 'name', 'description', 'is_active'],
    });

    if (!form) {
      return errorResponse(ctx, 404, 'Không tìm thấy biểu mẫu QC');
    }

    const latestVersion = await findLatestVersion(strapi, form.id);

    return successResponse('Lấy chi tiết biểu mẫu QC thành công', {
      item: serializeAdminForm(form, latestVersion),
    });
  },

  async createAdminForm(ctx) {
    const payload = normalizePayload(ctx.request.body);
    const formCode = normalizeCode(payload.code);
    const formName = safeString(payload.name);
    const formDescription = safeString(payload.description);
    const versionNo = safeString(payload.versionNo || payload.version_no, 'v1.0');
    const versionStatus = normalizeStatus(payload.status);
    const passThreshold = Math.max(toNumber(payload.passThreshold ?? payload.pass_threshold, 40), 0);
    const isActive = toBoolean(payload.isActive ?? payload.is_active, true);
    const criteriaInput = Array.isArray(payload.criteria) ? payload.criteria : [];

    if (!formCode || !formName) {
      return errorResponse(ctx, 400, 'Mã biểu mẫu và tên biểu mẫu là bắt buộc');
    }

    if (!isValidCode(formCode)) {
      return errorResponse(ctx, 400, 'Mã biểu mẫu chỉ được chứa chữ, số, dấu gạch dưới hoặc gạch ngang');
    }

    const existingForms = await strapi.entityService.findMany('api::qc-form.qc-form', {
      filters: { code: formCode },
      fields: ['id'],
      limit: 1,
    });

    if (Array.isArray(existingForms) && existingForms.length > 0) {
      return errorResponse(ctx, 409, 'Mã biểu mẫu QC đã tồn tại');
    }

    const normalizedCriteriaResult = normalizeCriteriaInput(ctx, criteriaInput);
    if (normalizedCriteriaResult.error) return normalizedCriteriaResult.error;
    const normalizedCriteria = normalizedCriteriaResult.criteria;

    const form = await strapi.entityService.create('api::qc-form.qc-form', {
      data: {
        code: formCode,
        name: formName,
        description: formDescription,
        is_active: isActive,
      },
    });

    const version = await strapi.entityService.create('api::qc-form-version.qc-form-version', {
      data: {
        form: Number(form.id),
        version_no: versionNo,
        status: versionStatus,
        pass_rule: {
          passThreshold,
        },
      },
    });

    const criterionMap = await ensureCriteriaCatalog(strapi, normalizedCriteria);
    await syncVersionCriteria(strapi, version.id, normalizedCriteria, criterionMap);

    return successResponse('Tạo biểu mẫu QC thành công', {
      form: {
        id: Number(form.id),
        code: formCode,
        name: formName,
        isActive,
      },
      version: {
        id: Number(version.id),
        versionNo,
        status: versionStatus,
        passThreshold,
      },
      criteriaCount: normalizedCriteria.length,
    });
  },

  async updateAdminForm(ctx) {
    const formId = Number(ctx.params.id || 0);
    if (!Number.isInteger(formId) || formId <= 0) {
      return errorResponse(ctx, 400, 'Mã biểu mẫu không hợp lệ');
    }

    const payload = normalizePayload(ctx.request.body);
    const formCode = normalizeCode(payload.code);
    const formName = safeString(payload.name);
    const formDescription = safeString(payload.description);
    const versionNo = safeString(payload.versionNo || payload.version_no, 'v1.0');
    const versionStatus = normalizeStatus(payload.status);
    const passThreshold = Math.max(toNumber(payload.passThreshold ?? payload.pass_threshold, 40), 0);
    const isActive = toBoolean(payload.isActive ?? payload.is_active, true);
    const criteriaInput = Array.isArray(payload.criteria) ? payload.criteria : [];

    if (!formCode || !formName) {
      return errorResponse(ctx, 400, 'Mã biểu mẫu và tên biểu mẫu là bắt buộc');
    }

    if (!isValidCode(formCode)) {
      return errorResponse(ctx, 400, 'Mã biểu mẫu chỉ được chứa chữ, số, dấu gạch dưới hoặc gạch ngang');
    }

    const form = await strapi.entityService.findOne('api::qc-form.qc-form', formId, {
      fields: ['id', 'code', 'name', 'description', 'is_active'],
    });

    if (!form) {
      return errorResponse(ctx, 404, 'Không tìm thấy biểu mẫu QC');
    }

    const duplicateForms = await strapi.entityService.findMany('api::qc-form.qc-form', {
      filters: {
        code: formCode,
        id: {
          $ne: Number(formId),
        },
      },
      fields: ['id'],
      limit: 1,
    });

    if (Array.isArray(duplicateForms) && duplicateForms.length > 0) {
      return errorResponse(ctx, 409, 'Mã biểu mẫu QC đã tồn tại');
    }

    const normalizedCriteriaResult = normalizeCriteriaInput(ctx, criteriaInput);
    if (normalizedCriteriaResult.error) return normalizedCriteriaResult.error;
    const normalizedCriteria = normalizedCriteriaResult.criteria;

    const latestVersion = await findLatestVersion(strapi, form.id);
    if (!latestVersion) {
      return errorResponse(ctx, 404, 'Biểu mẫu QC chưa có version để cập nhật');
    }

    await strapi.entityService.update('api::qc-form.qc-form', form.id, {
      data: {
        code: formCode,
        name: formName,
        description: formDescription,
        is_active: isActive,
      },
    });

    await strapi.entityService.update('api::qc-form-version.qc-form-version', latestVersion.id, {
      data: {
        version_no: versionNo,
        status: versionStatus,
        pass_rule: {
          passThreshold,
        },
      },
    });

    const criterionMap = await ensureCriteriaCatalog(strapi, normalizedCriteria);
    await syncVersionCriteria(strapi, latestVersion.id, normalizedCriteria, criterionMap);

    const updatedForm = await strapi.entityService.findOne('api::qc-form.qc-form', form.id, {
      fields: ['id', 'code', 'name', 'description', 'is_active'],
    });
    const updatedVersion = await findLatestVersion(strapi, form.id);

    return successResponse('Cập nhật biểu mẫu QC thành công', {
      item: serializeAdminForm(updatedForm, updatedVersion),
    });
  },
}));
