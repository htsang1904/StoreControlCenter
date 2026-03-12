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

const parsePassThresholdInput = (value, fallback = 40) => {
  if (value === undefined || value === null || String(value).trim() === '') {
    return {
      value: clamp(toNumber(fallback, 40), 0, 100),
      isValid: true,
    };
  }

  const threshold = Number(value);
  if (!Number.isFinite(threshold) || threshold < 0 || threshold > 100) {
    return {
      value: clamp(toNumber(fallback, 40), 0, 100),
      isValid: false,
    };
  }

  return {
    value: threshold,
    isValid: true,
  };
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

const normalizeStatus = (value, fallback = 'published') => {
  const normalized = safeString(value).toLowerCase();
  if (normalized === 'draft' || normalized === 'published' || normalized === 'archived') return normalized;
  return fallback;
};

const normalizeNodeType = (value, fallback = 'criterion') => {
  const normalized = safeString(value).toLowerCase();
  return normalized === 'group' ? 'group' : fallback;
};

const isValidCode = (value) => /^[A-Z0-9_-]+$/.test(value);

const parseVersionNo = (value) => {
  const matched = safeString(value).match(/^v(\d+)(?:\.(\d+))?$/i);
  if (!matched) {
    return { major: 1, minor: 0 };
  }

  return {
    major: Math.max(toNumber(matched[1], 1), 1),
    minor: Math.max(toNumber(matched[2], 0), 0),
  };
};

const formatVersionNo = ({ major = 1, minor = 0 } = {}) => `v${Math.max(major, 1)}.${Math.max(minor, 0)}`;

const nextMinorVersionNo = (value) => {
  const parsed = parseVersionNo(value);
  return formatVersionNo({
    major: parsed.major,
    minor: parsed.minor + 1,
  });
};

const orderingToParts = (value) => safeString(value)
  .split('.')
  .map((part) => safeString(part).toUpperCase())
  .filter(Boolean);

const compareOrderingPart = (leftPart, rightPart) => {
  const isLeftNumeric = /^\d+$/.test(leftPart);
  const isRightNumeric = /^\d+$/.test(rightPart);

  if (isLeftNumeric && isRightNumeric) {
    return Number(leftPart) - Number(rightPart);
  }

  return leftPart.localeCompare(rightPart, 'en', {
    numeric: true,
    sensitivity: 'base',
  });
};

const compareOrdering = (left, right) => {
  const leftParts = orderingToParts(left);
  const rightParts = orderingToParts(right);
  const maxLength = Math.max(leftParts.length, rightParts.length);

  for (let index = 0; index < maxLength; index += 1) {
    const diff = compareOrderingPart(leftParts[index] || '', rightParts[index] || '');
    if (diff !== 0) return diff;
  }

  return 0;
};

const normalizeOrderingSegment = (value, fallback = '') => safeString(value, fallback)
  .replace(/\s+/g, '')
  .toUpperCase();

const isValidOrderingSegment = (value) => /^[A-Z0-9]+$/.test(value);

const buildSnapshotCriterionCode = (formCode, versionNo, ordering) => {
  const normalizedVersion = safeString(versionNo, 'v1.0').replace(/[^a-zA-Z0-9]+/g, '_').toUpperCase();
  const normalizedOrdering = safeString(ordering, '1').replace(/[^a-zA-Z0-9]+/g, '_').toUpperCase();
  return normalizeCode(`${formCode}__${normalizedVersion}__${normalizedOrdering}`);
};

const serializeVersionCriteria = (formCriteria = []) => {
  const rows = Array.isArray(formCriteria) ? formCriteria : [];
  const parentIds = new Set(
    rows
      .map((item) => toNumber(item?.criterion?.parent?.id, 0))
      .filter((id) => id > 0)
  );

  return rows
    .map((item) => {
      const criterionId = toNumber(item?.criterion?.id, 0);
      const mode = normalizeMode(item?.mode);

      return {
        id: criterionId || Number(item?.id || 0),
        code: normalizeCode(item?.criterion?.code),
        name: safeString(item?.criterion?.name),
        description: safeString(item?.criterion?.description),
        sectionName: safeString(item?.section_name, 'Tổng quát'),
        mode,
        maxScore: mode === 'pass_fail' ? 1 : Math.max(toNumber(item?.max_score, 0), 0),
        sortOrder: toNumber(item?.sort_order, 0),
        level: Math.max(toNumber(item?.criterion?.level, 1), 1),
        ordering: safeString(item?.criterion?.ordering),
        parentId: toNumber(item?.criterion?.parent?.id, 0) || null,
        nodeType: parentIds.has(criterionId) ? 'group' : 'criterion',
      };
    })
    .sort((left, right) => {
      const orderingDiff = compareOrdering(left.ordering, right.ordering);
      if (orderingDiff !== 0) return orderingDiff;
      const sortDiff = left.sortOrder - right.sortOrder;
      if (sortDiff !== 0) return sortDiff;
      return left.id - right.id;
    });
};

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
      status: normalizeStatus(latestVersion.status, 'draft'),
      passThreshold: toNumber(latestVersion?.pass_rule?.passThreshold, 40),
      criteria: serializeVersionCriteria(latestVersion.form_criteria),
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
  activeVersionId: latestVersion ? Number(latestVersion.id) : null,
  version: safeString(latestVersion?.version_no, '--'),
  passThreshold: toNumber(latestVersion?.pass_rule?.passThreshold, 40),
  criteria: serializeVersionCriteria(latestVersion?.form_criteria),
});

const normalizeFlatCriteriaInput = (ctx, formCode, versionNo, criteriaInput = []) => {
  const invalid = (message) => ({
    error: errorResponse(ctx, 400, message),
    criteria: [],
  });

  if (!Array.isArray(criteriaInput) || !criteriaInput.length) {
    return invalid('Biểu mẫu QC phải có ít nhất một tiêu chí');
  }

  const normalizedCriteria = [];
  for (let index = 0; index < criteriaInput.length; index += 1) {
    const item = criteriaInput[index] || {};
    const nodeType = normalizeNodeType(item.nodeType, 'criterion');
    const name = safeString(item.name);
    const ordering = `${index + 1}`;
    const sectionName = safeString(item.sectionName || item.section_name, 'Tổng quát');

    if (!name) {
      return invalid(`Tiêu chí #${index + 1} thiếu tên`);
    }

    if (nodeType === 'group') {
      return invalid(`Nhóm "${name}" cần có tiêu chí con`);
    }

    const mode = normalizeMode(item.mode);
    const maxScore = mode === 'pass_fail'
      ? 1
      : Math.max(toNumber(item.maxScore ?? item.max_score, 10), 0);

    if (mode === 'point' && maxScore <= 0) {
      return invalid(`Tiêu chí "${name}" cần điểm tối đa lớn hơn 0`);
    }

    normalizedCriteria.push({
      code: buildSnapshotCriterionCode(formCode, versionNo, ordering),
      name,
      description: safeString(item.description),
      sectionName,
      mode,
      maxScore,
      sortOrder: index + 1,
      parentCode: null,
      level: 1,
      ordering,
      nodeType,
    });
  }

  return { error: null, criteria: normalizedCriteria };
};

const normalizeTreeCriteriaInput = (ctx, formCode, versionNo, criteriaInput = []) => {
  const invalid = (message) => ({
    error: errorResponse(ctx, 400, message),
    criteria: [],
  });

  if (!Array.isArray(criteriaInput) || !criteriaInput.length) {
    return invalid('Biểu mẫu QC phải có ít nhất một nhóm hoặc tiêu chí');
  }

  const normalizedCriteria = [];
  let sortCursor = 0;
  let leafCount = 0;

  const visitNodes = (nodes, parentContext = null, level = 1, topSectionName = '') => {
    if (!Array.isArray(nodes) || !nodes.length) {
      return invalid('Nhóm tiêu chí phải có ít nhất một mục con');
    }

    const siblingSegments = new Set();

    for (let index = 0; index < nodes.length; index += 1) {
      const item = nodes[index] || {};
      const children = Array.isArray(item.children) ? item.children : [];
      const explicitType = normalizeNodeType(item.nodeType || item.type, 'criterion');
      const nodeType = explicitType === 'group' || children.length > 0 ? 'group' : 'criterion';
      const name = safeString(item.name);
      const orderingSegment = normalizeOrderingSegment(
        item.orderingLabel ?? item.ordering_label ?? item.orderingSegment ?? item.ordering_segment,
        `${index + 1}`
      );

      if (!isValidOrderingSegment(orderingSegment)) {
        return invalid(`Mã thứ tự "${orderingSegment}" chỉ được chứa chữ và số`);
      }

      if (siblingSegments.has(orderingSegment)) {
        return invalid(`Mã thứ tự "${orderingSegment}" đang bị trùng trong cùng cấp cây`);
      }
      siblingSegments.add(orderingSegment);

      const path = parentContext ? [...parentContext.path, orderingSegment] : [orderingSegment];
      const ordering = path.join('.');
      const currentTopSection = level === 1
        ? (nodeType === 'group' ? name : safeString(item.sectionName || item.section_name, 'Tổng quát'))
        : (topSectionName || parentContext?.sectionName || 'Tổng quát');

      if (!name) {
        return invalid(`Mục "${ordering}" thiếu tên hiển thị`);
      }

      if (nodeType === 'group' && !children.length) {
        return invalid(`Nhóm "${name}" cần có ít nhất một mục con`);
      }

      const mode = nodeType === 'group' ? 'point' : normalizeMode(item.mode);
      const maxScore = nodeType === 'group'
        ? 0
        : (mode === 'pass_fail' ? 1 : Math.max(toNumber(item.maxScore ?? item.max_score, 10), 0));

      if (nodeType === 'criterion' && mode === 'point' && maxScore <= 0) {
        return invalid(`Tiêu chí "${name}" cần điểm tối đa lớn hơn 0`);
      }

      const normalizedCriterion = {
        code: buildSnapshotCriterionCode(formCode, versionNo, ordering),
        name,
        description: safeString(item.description),
        sectionName: currentTopSection,
        mode,
        maxScore,
        sortOrder: sortCursor + 1,
        parentCode: parentContext?.code || null,
        level,
        ordering,
        nodeType,
      };

      sortCursor += 1;
      normalizedCriteria.push(normalizedCriterion);

      if (nodeType === 'criterion') {
        leafCount += 1;
      } else {
        const childResult = visitNodes(children, {
          code: normalizedCriterion.code,
          path,
          sectionName: currentTopSection,
        }, level + 1, currentTopSection);
        if (childResult.error) return childResult;
      }
    }

    return { error: null };
  };

  const visitResult = visitNodes(criteriaInput);
  if (visitResult.error) return visitResult;

  if (!leafCount) {
    return invalid('Biểu mẫu QC phải có ít nhất một tiêu chí chấm điểm ở node lá');
  }

  return { error: null, criteria: normalizedCriteria };
};

const normalizeCriteriaInput = (ctx, formCode, versionNo, criteriaInput = []) => {
  const usesNestedTree = Array.isArray(criteriaInput)
    && criteriaInput.some((item) => Array.isArray(item?.children) || normalizeNodeType(item?.nodeType || item?.type, 'criterion') === 'group');

  if (usesNestedTree) {
    return normalizeTreeCriteriaInput(ctx, formCode, versionNo, criteriaInput);
  }

  return normalizeFlatCriteriaInput(ctx, formCode, versionNo, criteriaInput);
};

const ensureCriteriaCatalog = async (strapi, normalizedCriteria = []) => {
  const criterionCodes = normalizedCriteria.map((item) => item.code);
  const existingCriteria = await strapi.entityService.findMany('api::qc-criterion.qc-criterion', {
    filters: {
      code: {
        $in: criterionCodes,
      },
    },
    fields: ['id', 'code', 'name', 'description', 'default_mode', 'default_max_score', 'is_active', 'level', 'ordering'],
    limit: Math.max(criterionCodes.length, 1),
  });

  const criterionMap = new Map(
    (Array.isArray(existingCriteria) ? existingCriteria : [])
      .map((item) => [String(item.code || '').toUpperCase(), item])
  );

  for (const item of normalizedCriteria) {
    let criterion = criterionMap.get(item.code);
    const baseData = {
      code: item.code,
      name: item.name,
      description: item.description,
      default_mode: item.mode,
      default_max_score: item.maxScore,
      is_active: true,
      level: item.level,
      ordering: item.ordering,
    };

    if (!criterion) {
      criterion = await strapi.entityService.create('api::qc-criterion.qc-criterion', {
        data: baseData,
      });
    } else {
      criterion = await strapi.entityService.update('api::qc-criterion.qc-criterion', criterion.id, {
        data: baseData,
      });
    }

    criterionMap.set(item.code, criterion);
  }

  for (const item of normalizedCriteria) {
    const criterion = criterionMap.get(item.code);
    const parentCriterion = item.parentCode ? criterionMap.get(item.parentCode) : null;

    const updatedCriterion = await strapi.entityService.update('api::qc-criterion.qc-criterion', criterion.id, {
      data: {
        parent: parentCriterion ? Number(parentCriterion.id) : null,
        level: item.level,
        ordering: item.ordering,
        is_active: true,
      },
    });

    criterionMap.set(item.code, updatedCriterion);
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
      },
    });
  }
};

const archiveOtherPublishedVersions = async (strapi, formId, keepVersionId) => {
  const publishedVersions = await strapi.entityService.findMany('api::qc-form-version.qc-form-version', {
    filters: {
      form: { id: Number(formId) },
      status: 'published',
      id: {
        $ne: Number(keepVersionId),
      },
    },
    fields: ['id'],
    limit: 100,
  });

  for (const version of Array.isArray(publishedVersions) ? publishedVersions : []) {
    await strapi.entityService.update('api::qc-form-version.qc-form-version', Number(version.id), {
      data: {
        status: 'archived',
        effective_to: new Date().toISOString(),
      },
    });
  }
};

const buildVersionData = ({ formId = null, versionNo = 'v1.0', status = 'draft', passThreshold = 40 } = {}) => {
  const normalizedStatus = normalizeStatus(status, 'draft');
  const payload = {
    version_no: safeString(versionNo, 'v1.0'),
    status: normalizedStatus,
    pass_rule: {
      passThreshold,
    },
    effective_from: normalizedStatus === 'published' ? new Date().toISOString() : null,
    effective_to: normalizedStatus === 'archived' ? new Date().toISOString() : null,
  };

  if (formId) {
    payload.form = Number(formId);
  }

  return payload;
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
    const versionStatus = normalizeStatus(payload.status, 'draft');
    const versionNo = 'v1.0';
    const passThresholdInput = parsePassThresholdInput(payload.passThreshold ?? payload.pass_threshold, 40);
    const passThreshold = passThresholdInput.value;
    const isActive = toBoolean(payload.isActive ?? payload.is_active, true);
    const criteriaInput = Array.isArray(payload.criteria) ? payload.criteria : [];

    if (!formCode || !formName) {
      return errorResponse(ctx, 400, 'Mã biểu mẫu và tên biểu mẫu là bắt buộc');
    }

    if (!isValidCode(formCode)) {
      return errorResponse(ctx, 400, 'Mã biểu mẫu chỉ được chứa chữ, số, dấu gạch dưới hoặc gạch ngang');
    }

    if (!passThresholdInput.isValid) {
      return errorResponse(ctx, 400, 'Ngưỡng đạt phải nằm trong khoảng từ 0 đến 100');
    }

    const existingForms = await strapi.entityService.findMany('api::qc-form.qc-form', {
      filters: { code: formCode },
      fields: ['id'],
      limit: 1,
    });

    if (Array.isArray(existingForms) && existingForms.length > 0) {
      return errorResponse(ctx, 409, 'Mã biểu mẫu QC đã tồn tại');
    }

    const normalizedCriteriaResult = normalizeCriteriaInput(ctx, formCode, versionNo, criteriaInput);
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
      data: buildVersionData({
        formId: form.id,
        versionNo,
        status: versionStatus,
        passThreshold,
      }),
    });

    const criterionMap = await ensureCriteriaCatalog(strapi, normalizedCriteria);
    await syncVersionCriteria(strapi, version.id, normalizedCriteria, criterionMap);

    const createdForm = await strapi.entityService.findOne('api::qc-form.qc-form', form.id, {
      fields: ['id', 'code', 'name', 'description', 'is_active'],
    });
    const latestVersion = await findLatestVersion(strapi, form.id);

    return successResponse('Tạo biểu mẫu QC thành công', {
      item: serializeAdminForm(createdForm, latestVersion),
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
    const targetStatus = normalizeStatus(payload.status, 'draft');
    const passThresholdInput = parsePassThresholdInput(payload.passThreshold ?? payload.pass_threshold, 40);
    const passThreshold = passThresholdInput.value;
    const isActive = toBoolean(payload.isActive ?? payload.is_active, true);
    const criteriaInput = Array.isArray(payload.criteria) ? payload.criteria : [];

    if (!formCode || !formName) {
      return errorResponse(ctx, 400, 'Mã biểu mẫu và tên biểu mẫu là bắt buộc');
    }

    if (!isValidCode(formCode)) {
      return errorResponse(ctx, 400, 'Mã biểu mẫu chỉ được chứa chữ, số, dấu gạch dưới hoặc gạch ngang');
    }

    if (!passThresholdInput.isValid) {
      return errorResponse(ctx, 400, 'Ngưỡng đạt phải nằm trong khoảng từ 0 đến 100');
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

    const latestVersion = await findLatestVersion(strapi, form.id);
    if (!latestVersion) {
      return errorResponse(ctx, 404, 'Biểu mẫu QC chưa có version để cập nhật');
    }

    const latestVersionStatus = normalizeStatus(latestVersion.status, 'draft');
    const targetVersionNo = latestVersionStatus === 'draft'
      ? safeString(latestVersion.version_no, 'v1.0')
      : nextMinorVersionNo(latestVersion.version_no);

    const normalizedCriteriaResult = normalizeCriteriaInput(ctx, formCode, targetVersionNo, criteriaInput);
    if (normalizedCriteriaResult.error) return normalizedCriteriaResult.error;
    const normalizedCriteria = normalizedCriteriaResult.criteria;

    await strapi.entityService.update('api::qc-form.qc-form', form.id, {
      data: {
        code: formCode,
        name: formName,
        description: formDescription,
        is_active: isActive,
      },
    });

    let targetVersion = latestVersion;
    if (latestVersionStatus === 'draft') {
      targetVersion = await strapi.entityService.update('api::qc-form-version.qc-form-version', latestVersion.id, {
        data: buildVersionData({
          versionNo: targetVersionNo,
          status: targetStatus,
          passThreshold,
        }),
      });
    } else {
      targetVersion = await strapi.entityService.create('api::qc-form-version.qc-form-version', {
        data: buildVersionData({
          formId: form.id,
          versionNo: targetVersionNo,
          status: targetStatus,
          passThreshold,
        }),
      });
    }

    const criterionMap = await ensureCriteriaCatalog(strapi, normalizedCriteria);
    await syncVersionCriteria(strapi, targetVersion.id, normalizedCriteria, criterionMap);

    if (targetStatus === 'published') {
      await archiveOtherPublishedVersions(strapi, form.id, targetVersion.id);
    }

    const updatedForm = await strapi.entityService.findOne('api::qc-form.qc-form', form.id, {
      fields: ['id', 'code', 'name', 'description', 'is_active'],
    });
    const updatedVersion = await findLatestVersion(strapi, form.id);

    return successResponse('Cập nhật biểu mẫu QC thành công', {
      item: serializeAdminForm(updatedForm, updatedVersion),
    });
  },
}));
