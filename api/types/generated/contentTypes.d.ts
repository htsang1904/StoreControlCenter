import type { Attribute, Schema } from '@strapi/strapi';

export interface AdminApiToken extends Schema.CollectionType {
  collectionName: 'strapi_api_tokens';
  info: {
    description: '';
    displayName: 'Api Token';
    name: 'Api Token';
    pluralName: 'api-tokens';
    singularName: 'api-token';
  };
  pluginOptions: {
    'content-manager': {
      visible: false;
    };
    'content-type-builder': {
      visible: false;
    };
  };
  attributes: {
    accessKey: Attribute.String &
      Attribute.Required &
      Attribute.SetMinMaxLength<{
        minLength: 1;
      }>;
    createdAt: Attribute.DateTime;
    createdBy: Attribute.Relation<
      'admin::api-token',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
    description: Attribute.String &
      Attribute.SetMinMaxLength<{
        minLength: 1;
      }> &
      Attribute.DefaultTo<''>;
    expiresAt: Attribute.DateTime;
    lastUsedAt: Attribute.DateTime;
    lifespan: Attribute.BigInteger;
    name: Attribute.String &
      Attribute.Required &
      Attribute.Unique &
      Attribute.SetMinMaxLength<{
        minLength: 1;
      }>;
    permissions: Attribute.Relation<
      'admin::api-token',
      'oneToMany',
      'admin::api-token-permission'
    >;
    type: Attribute.Enumeration<['read-only', 'full-access', 'custom']> &
      Attribute.Required &
      Attribute.DefaultTo<'read-only'>;
    updatedAt: Attribute.DateTime;
    updatedBy: Attribute.Relation<
      'admin::api-token',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
  };
}

export interface AdminApiTokenPermission extends Schema.CollectionType {
  collectionName: 'strapi_api_token_permissions';
  info: {
    description: '';
    displayName: 'API Token Permission';
    name: 'API Token Permission';
    pluralName: 'api-token-permissions';
    singularName: 'api-token-permission';
  };
  pluginOptions: {
    'content-manager': {
      visible: false;
    };
    'content-type-builder': {
      visible: false;
    };
  };
  attributes: {
    action: Attribute.String &
      Attribute.Required &
      Attribute.SetMinMaxLength<{
        minLength: 1;
      }>;
    createdAt: Attribute.DateTime;
    createdBy: Attribute.Relation<
      'admin::api-token-permission',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
    token: Attribute.Relation<
      'admin::api-token-permission',
      'manyToOne',
      'admin::api-token'
    >;
    updatedAt: Attribute.DateTime;
    updatedBy: Attribute.Relation<
      'admin::api-token-permission',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
  };
}

export interface AdminPermission extends Schema.CollectionType {
  collectionName: 'admin_permissions';
  info: {
    description: '';
    displayName: 'Permission';
    name: 'Permission';
    pluralName: 'permissions';
    singularName: 'permission';
  };
  pluginOptions: {
    'content-manager': {
      visible: false;
    };
    'content-type-builder': {
      visible: false;
    };
  };
  attributes: {
    action: Attribute.String &
      Attribute.Required &
      Attribute.SetMinMaxLength<{
        minLength: 1;
      }>;
    actionParameters: Attribute.JSON & Attribute.DefaultTo<{}>;
    conditions: Attribute.JSON & Attribute.DefaultTo<[]>;
    createdAt: Attribute.DateTime;
    createdBy: Attribute.Relation<
      'admin::permission',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
    properties: Attribute.JSON & Attribute.DefaultTo<{}>;
    role: Attribute.Relation<'admin::permission', 'manyToOne', 'admin::role'>;
    subject: Attribute.String &
      Attribute.SetMinMaxLength<{
        minLength: 1;
      }>;
    updatedAt: Attribute.DateTime;
    updatedBy: Attribute.Relation<
      'admin::permission',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
  };
}

export interface AdminRole extends Schema.CollectionType {
  collectionName: 'admin_roles';
  info: {
    description: '';
    displayName: 'Role';
    name: 'Role';
    pluralName: 'roles';
    singularName: 'role';
  };
  pluginOptions: {
    'content-manager': {
      visible: false;
    };
    'content-type-builder': {
      visible: false;
    };
  };
  attributes: {
    code: Attribute.String &
      Attribute.Required &
      Attribute.Unique &
      Attribute.SetMinMaxLength<{
        minLength: 1;
      }>;
    createdAt: Attribute.DateTime;
    createdBy: Attribute.Relation<'admin::role', 'oneToOne', 'admin::user'> &
      Attribute.Private;
    description: Attribute.String;
    name: Attribute.String &
      Attribute.Required &
      Attribute.Unique &
      Attribute.SetMinMaxLength<{
        minLength: 1;
      }>;
    permissions: Attribute.Relation<
      'admin::role',
      'oneToMany',
      'admin::permission'
    >;
    updatedAt: Attribute.DateTime;
    updatedBy: Attribute.Relation<'admin::role', 'oneToOne', 'admin::user'> &
      Attribute.Private;
    users: Attribute.Relation<'admin::role', 'manyToMany', 'admin::user'>;
  };
}

export interface AdminTransferToken extends Schema.CollectionType {
  collectionName: 'strapi_transfer_tokens';
  info: {
    description: '';
    displayName: 'Transfer Token';
    name: 'Transfer Token';
    pluralName: 'transfer-tokens';
    singularName: 'transfer-token';
  };
  pluginOptions: {
    'content-manager': {
      visible: false;
    };
    'content-type-builder': {
      visible: false;
    };
  };
  attributes: {
    accessKey: Attribute.String &
      Attribute.Required &
      Attribute.SetMinMaxLength<{
        minLength: 1;
      }>;
    createdAt: Attribute.DateTime;
    createdBy: Attribute.Relation<
      'admin::transfer-token',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
    description: Attribute.String &
      Attribute.SetMinMaxLength<{
        minLength: 1;
      }> &
      Attribute.DefaultTo<''>;
    expiresAt: Attribute.DateTime;
    lastUsedAt: Attribute.DateTime;
    lifespan: Attribute.BigInteger;
    name: Attribute.String &
      Attribute.Required &
      Attribute.Unique &
      Attribute.SetMinMaxLength<{
        minLength: 1;
      }>;
    permissions: Attribute.Relation<
      'admin::transfer-token',
      'oneToMany',
      'admin::transfer-token-permission'
    >;
    updatedAt: Attribute.DateTime;
    updatedBy: Attribute.Relation<
      'admin::transfer-token',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
  };
}

export interface AdminTransferTokenPermission extends Schema.CollectionType {
  collectionName: 'strapi_transfer_token_permissions';
  info: {
    description: '';
    displayName: 'Transfer Token Permission';
    name: 'Transfer Token Permission';
    pluralName: 'transfer-token-permissions';
    singularName: 'transfer-token-permission';
  };
  pluginOptions: {
    'content-manager': {
      visible: false;
    };
    'content-type-builder': {
      visible: false;
    };
  };
  attributes: {
    action: Attribute.String &
      Attribute.Required &
      Attribute.SetMinMaxLength<{
        minLength: 1;
      }>;
    createdAt: Attribute.DateTime;
    createdBy: Attribute.Relation<
      'admin::transfer-token-permission',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
    token: Attribute.Relation<
      'admin::transfer-token-permission',
      'manyToOne',
      'admin::transfer-token'
    >;
    updatedAt: Attribute.DateTime;
    updatedBy: Attribute.Relation<
      'admin::transfer-token-permission',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
  };
}

export interface AdminUser extends Schema.CollectionType {
  collectionName: 'admin_users';
  info: {
    description: '';
    displayName: 'User';
    name: 'User';
    pluralName: 'users';
    singularName: 'user';
  };
  pluginOptions: {
    'content-manager': {
      visible: false;
    };
    'content-type-builder': {
      visible: false;
    };
  };
  attributes: {
    blocked: Attribute.Boolean & Attribute.Private & Attribute.DefaultTo<false>;
    createdAt: Attribute.DateTime;
    createdBy: Attribute.Relation<'admin::user', 'oneToOne', 'admin::user'> &
      Attribute.Private;
    email: Attribute.Email &
      Attribute.Required &
      Attribute.Private &
      Attribute.Unique &
      Attribute.SetMinMaxLength<{
        minLength: 6;
      }>;
    firstname: Attribute.String &
      Attribute.SetMinMaxLength<{
        minLength: 1;
      }>;
    isActive: Attribute.Boolean &
      Attribute.Private &
      Attribute.DefaultTo<false>;
    lastname: Attribute.String &
      Attribute.SetMinMaxLength<{
        minLength: 1;
      }>;
    password: Attribute.Password &
      Attribute.Private &
      Attribute.SetMinMaxLength<{
        minLength: 6;
      }>;
    preferedLanguage: Attribute.String;
    registrationToken: Attribute.String & Attribute.Private;
    resetPasswordToken: Attribute.String & Attribute.Private;
    roles: Attribute.Relation<'admin::user', 'manyToMany', 'admin::role'> &
      Attribute.Private;
    updatedAt: Attribute.DateTime;
    updatedBy: Attribute.Relation<'admin::user', 'oneToOne', 'admin::user'> &
      Attribute.Private;
    username: Attribute.String;
  };
}

export interface ApiDepartmentDepartment extends Schema.CollectionType {
  collectionName: 'departments';
  info: {
    description: '';
    displayName: 'Department';
    pluralName: 'departments';
    singularName: 'department';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    code: Attribute.UID<'api::department.department', 'name'> &
      Attribute.Required &
      Attribute.Unique;
    createdAt: Attribute.DateTime;
    createdBy: Attribute.Relation<
      'api::department.department',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
    is_active: Attribute.Boolean & Attribute.DefaultTo<true>;
    name: Attribute.String & Attribute.Required;
    tickets: Attribute.Relation<
      'api::department.department',
      'oneToMany',
      'api::ticket.ticket'
    >;
    updatedAt: Attribute.DateTime;
    updatedBy: Attribute.Relation<
      'api::department.department',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
    users: Attribute.Relation<
      'api::department.department',
      'oneToMany',
      'api::user-info.user-info'
    >;
  };
}

export interface ApiNotificationNotification extends Schema.CollectionType {
  collectionName: 'notifications';
  info: {
    description: '';
    displayName: 'Notification';
    pluralName: 'notifications';
    singularName: 'notification';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    actor: Attribute.Relation<
      'api::notification.notification',
      'manyToOne',
      'api::user-info.user-info'
    >;
    createdAt: Attribute.DateTime;
    createdBy: Attribute.Relation<
      'api::notification.notification',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
    is_read: Attribute.Boolean &
      Attribute.Required &
      Attribute.DefaultTo<false>;
    message: Attribute.Text & Attribute.Required;
    meta: Attribute.JSON;
    read_at: Attribute.DateTime;
    recipient: Attribute.Relation<
      'api::notification.notification',
      'manyToOne',
      'api::user-info.user-info'
    > &
      Attribute.Required;
    ticket: Attribute.Relation<
      'api::notification.notification',
      'manyToOne',
      'api::ticket.ticket'
    >;
    title: Attribute.String & Attribute.Required;
    type: Attribute.Enumeration<['info', 'success', 'warning', 'error']> &
      Attribute.Required &
      Attribute.DefaultTo<'info'>;
    updatedAt: Attribute.DateTime;
    updatedBy: Attribute.Relation<
      'api::notification.notification',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
  };
}

export interface ApiQcCriterionQcCriterion extends Schema.CollectionType {
  collectionName: 'qc_criteria';
  info: {
    description: 'Reusable criterion catalog';
    displayName: 'QC Criterion';
    pluralName: 'qc-criteria';
    singularName: 'qc-criterion';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    children: Attribute.Relation<
      'api::qc-criterion.qc-criterion',
      'oneToMany',
      'api::qc-criterion.qc-criterion'
    >;
    code: Attribute.String & Attribute.Required & Attribute.Unique;
    createdAt: Attribute.DateTime;
    createdBy: Attribute.Relation<
      'api::qc-criterion.qc-criterion',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
    default_max_score: Attribute.Decimal & Attribute.DefaultTo<0>;
    default_mode: Attribute.Enumeration<['pass_fail', 'point']> &
      Attribute.Required &
      Attribute.DefaultTo<'point'>;
    description: Attribute.Text;
    form_criteria: Attribute.Relation<
      'api::qc-criterion.qc-criterion',
      'oneToMany',
      'api::qc-form-criterion.qc-form-criterion'
    >;
    is_active: Attribute.Boolean & Attribute.DefaultTo<true>;
    level: Attribute.Integer & Attribute.DefaultTo<1>;
    name: Attribute.String & Attribute.Required;
    ordering: Attribute.String;
    parent: Attribute.Relation<
      'api::qc-criterion.qc-criterion',
      'manyToOne',
      'api::qc-criterion.qc-criterion'
    >;
    session_items: Attribute.Relation<
      'api::qc-criterion.qc-criterion',
      'oneToMany',
      'api::qc-session-item.qc-session-item'
    >;
    updatedAt: Attribute.DateTime;
    updatedBy: Attribute.Relation<
      'api::qc-criterion.qc-criterion',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
  };
}

export interface ApiQcDraftQcDraft extends Schema.CollectionType {
  collectionName: 'qc_drafts';
  info: {
    description: 'Draft payload for QC session editing';
    displayName: 'QC Draft';
    pluralName: 'qc-drafts';
    singularName: 'qc-draft';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    audited_at: Attribute.DateTime & Attribute.Required;
    auditor: Attribute.Relation<
      'api::qc-draft.qc-draft',
      'manyToOne',
      'api::user-info.user-info'
    >;
    createdAt: Attribute.DateTime;
    createdBy: Attribute.Relation<
      'api::qc-draft.qc-draft',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
    criteria_states: Attribute.JSON;
    note: Attribute.Text;
    store: Attribute.Relation<
      'api::qc-draft.qc-draft',
      'manyToOne',
      'api::store.store'
    > &
      Attribute.Required;
    template_id: Attribute.String & Attribute.Required;
    updatedAt: Attribute.DateTime;
    updatedBy: Attribute.Relation<
      'api::qc-draft.qc-draft',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
  };
}

export interface ApiQcFindingQcFinding extends Schema.CollectionType {
  collectionName: 'qc_findings';
  info: {
    description: 'Corrective action item from failed criterion';
    displayName: 'QC Finding';
    pluralName: 'qc-findings';
    singularName: 'qc-finding';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    assignee: Attribute.Relation<
      'api::qc-finding.qc-finding',
      'manyToOne',
      'api::user-info.user-info'
    >;
    corrective_action: Attribute.Text;
    corrective_note: Attribute.Text;
    createdAt: Attribute.DateTime;
    createdBy: Attribute.Relation<
      'api::qc-finding.qc-finding',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
    criterion_name: Attribute.String;
    due_date: Attribute.Date;
    evidence: Attribute.JSON;
    finding_code: Attribute.String & Attribute.Required & Attribute.Unique;
    meta: Attribute.JSON;
    resolved_at: Attribute.DateTime;
    session: Attribute.Relation<
      'api::qc-finding.qc-finding',
      'manyToOne',
      'api::qc-session.qc-session'
    > &
      Attribute.Required;
    session_item: Attribute.Relation<
      'api::qc-finding.qc-finding',
      'manyToOne',
      'api::qc-session-item.qc-session-item'
    >;
    severity: Attribute.Enumeration<['low', 'medium', 'high', 'critical']> &
      Attribute.DefaultTo<'medium'>;
    status: Attribute.Enumeration<
      ['open', 'in_progress', 'resolved', 'verified', 'rejected']
    > &
      Attribute.DefaultTo<'open'>;
    store: Attribute.Relation<
      'api::qc-finding.qc-finding',
      'manyToOne',
      'api::store.store'
    > &
      Attribute.Required;
    updatedAt: Attribute.DateTime;
    updatedBy: Attribute.Relation<
      'api::qc-finding.qc-finding',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
    verified_at: Attribute.DateTime;
    verifier: Attribute.Relation<
      'api::qc-finding.qc-finding',
      'manyToOne',
      'api::user-info.user-info'
    >;
  };
}

export interface ApiQcFormCriterionQcFormCriterion
  extends Schema.CollectionType {
  collectionName: 'qc_form_criteria';
  info: {
    description: 'Criterion config inside a form version';
    displayName: 'QC Form Criterion';
    pluralName: 'qc-form-criteria';
    singularName: 'qc-form-criterion';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    createdAt: Attribute.DateTime;
    createdBy: Attribute.Relation<
      'api::qc-form-criterion.qc-form-criterion',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
    criterion: Attribute.Relation<
      'api::qc-form-criterion.qc-form-criterion',
      'manyToOne',
      'api::qc-criterion.qc-criterion'
    > &
      Attribute.Required;
    form_version: Attribute.Relation<
      'api::qc-form-criterion.qc-form-criterion',
      'manyToOne',
      'api::qc-form-version.qc-form-version'
    > &
      Attribute.Required;
    max_score: Attribute.Decimal & Attribute.DefaultTo<0>;
    mode: Attribute.Enumeration<['pass_fail', 'point']> & Attribute.Required;
    section_name: Attribute.String;
    sort_order: Attribute.Integer & Attribute.DefaultTo<0>;
    updatedAt: Attribute.DateTime;
    updatedBy: Attribute.Relation<
      'api::qc-form-criterion.qc-form-criterion',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
  };
}

export interface ApiQcFormVersionQcFormVersion extends Schema.CollectionType {
  collectionName: 'qc_form_versions';
  info: {
    description: 'Immutable version of a QC form';
    displayName: 'QC Form Version';
    pluralName: 'qc-form-versions';
    singularName: 'qc-form-version';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    createdAt: Attribute.DateTime;
    createdBy: Attribute.Relation<
      'api::qc-form-version.qc-form-version',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
    effective_from: Attribute.DateTime;
    effective_to: Attribute.DateTime;
    form: Attribute.Relation<
      'api::qc-form-version.qc-form-version',
      'manyToOne',
      'api::qc-form.qc-form'
    > &
      Attribute.Required;
    form_criteria: Attribute.Relation<
      'api::qc-form-version.qc-form-version',
      'oneToMany',
      'api::qc-form-criterion.qc-form-criterion'
    >;
    pass_rule: Attribute.JSON;
    sessions: Attribute.Relation<
      'api::qc-form-version.qc-form-version',
      'oneToMany',
      'api::qc-session.qc-session'
    >;
    status: Attribute.Enumeration<['draft', 'published', 'archived']> &
      Attribute.Required &
      Attribute.DefaultTo<'draft'>;
    updatedAt: Attribute.DateTime;
    updatedBy: Attribute.Relation<
      'api::qc-form-version.qc-form-version',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
    version_no: Attribute.String & Attribute.Required;
  };
}

export interface ApiQcFormQcForm extends Schema.CollectionType {
  collectionName: 'qc_forms';
  info: {
    description: 'Master checklist form for QC';
    displayName: 'QC Form';
    pluralName: 'qc-forms';
    singularName: 'qc-form';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    code: Attribute.String & Attribute.Required & Attribute.Unique;
    createdAt: Attribute.DateTime;
    createdBy: Attribute.Relation<
      'api::qc-form.qc-form',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
    description: Attribute.Text;
    is_active: Attribute.Boolean & Attribute.DefaultTo<true>;
    name: Attribute.String & Attribute.Required;
    updatedAt: Attribute.DateTime;
    updatedBy: Attribute.Relation<
      'api::qc-form.qc-form',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
    versions: Attribute.Relation<
      'api::qc-form.qc-form',
      'oneToMany',
      'api::qc-form-version.qc-form-version'
    >;
  };
}

export interface ApiQcSessionItemQcSessionItem extends Schema.CollectionType {
  collectionName: 'qc_session_items';
  info: {
    description: 'Result for each criterion in a QC session';
    displayName: 'QC Session Item';
    pluralName: 'qc-session-items';
    singularName: 'qc-session-item';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    applicable: Attribute.Boolean & Attribute.DefaultTo<true>;
    attachments: Attribute.JSON;
    createdAt: Attribute.DateTime;
    createdBy: Attribute.Relation<
      'api::qc-session-item.qc-session-item',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
    criterion: Attribute.Relation<
      'api::qc-session-item.qc-session-item',
      'manyToOne',
      'api::qc-criterion.qc-criterion'
    >;
    criterion_code: Attribute.String;
    criterion_name: Attribute.String & Attribute.Required;
    max_score_snapshot: Attribute.Decimal & Attribute.DefaultTo<0>;
    mode_snapshot: Attribute.Enumeration<['pass_fail', 'point']> &
      Attribute.Required;
    note: Attribute.Text;
    requires_fix: Attribute.Boolean & Attribute.DefaultTo<false>;
    result: Attribute.Enumeration<
      ['pending', 'pass', 'fail', 'na', 'skipped_weekly']
    > &
      Attribute.Required &
      Attribute.DefaultTo<'pending'>;
    score: Attribute.Decimal;
    session: Attribute.Relation<
      'api::qc-session-item.qc-session-item',
      'manyToOne',
      'api::qc-session.qc-session'
    > &
      Attribute.Required;
    updatedAt: Attribute.DateTime;
    updatedBy: Attribute.Relation<
      'api::qc-session-item.qc-session-item',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
  };
}

export interface ApiQcSessionQcSession extends Schema.CollectionType {
  collectionName: 'qc_sessions';
  info: {
    description: 'QC execution session at store level';
    displayName: 'QC Session';
    pluralName: 'qc-sessions';
    singularName: 'qc-session';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    audited_at: Attribute.DateTime & Attribute.Required;
    auditor: Attribute.Relation<
      'api::qc-session.qc-session',
      'manyToOne',
      'api::user-info.user-info'
    >;
    code: Attribute.String & Attribute.Required & Attribute.Unique;
    createdAt: Attribute.DateTime;
    createdBy: Attribute.Relation<
      'api::qc-session.qc-session',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
    findings: Attribute.Relation<
      'api::qc-session.qc-session',
      'oneToMany',
      'api::qc-finding.qc-finding'
    >;
    form_version: Attribute.Relation<
      'api::qc-session.qc-session',
      'manyToOne',
      'api::qc-form-version.qc-form-version'
    > &
      Attribute.Required;
    items: Attribute.Relation<
      'api::qc-session.qc-session',
      'oneToMany',
      'api::qc-session-item.qc-session-item'
    >;
    max_score: Attribute.Decimal & Attribute.DefaultTo<0>;
    note: Attribute.Text;
    result: Attribute.Enumeration<['pending', 'pass', 'fail']> &
      Attribute.Required &
      Attribute.DefaultTo<'pending'>;
    status: Attribute.Enumeration<
      ['draft', 'submitted', 'needs_fix', 'closed']
    > &
      Attribute.Required &
      Attribute.DefaultTo<'draft'>;
    store: Attribute.Relation<
      'api::qc-session.qc-session',
      'manyToOne',
      'api::store.store'
    > &
      Attribute.Required;
    submitted_at: Attribute.DateTime;
    total_score: Attribute.Decimal & Attribute.DefaultTo<0>;
    updatedAt: Attribute.DateTime;
    updatedBy: Attribute.Relation<
      'api::qc-session.qc-session',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
  };
}

export interface ApiStoreStore extends Schema.CollectionType {
  collectionName: 'stores';
  info: {
    description: '';
    displayName: 'Store';
    pluralName: 'stores';
    singularName: 'store';
  };
  options: {
    draftAndPublish: true;
  };
  attributes: {
    address: Attribute.String;
    brandId: Attribute.String;
    code: Attribute.String;
    createdAt: Attribute.DateTime;
    createdBy: Attribute.Relation<
      'api::store.store',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
    name: Attribute.String;
    publishedAt: Attribute.DateTime;
    shortAddress: Attribute.String;
    storeId: Attribute.String;
    updatedAt: Attribute.DateTime;
    updatedBy: Attribute.Relation<
      'api::store.store',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
  };
}

export interface ApiTicketLogTicketLog extends Schema.CollectionType {
  collectionName: 'ticket_logs';
  info: {
    description: '';
    displayName: 'TicketLog';
    pluralName: 'ticket-logs';
    singularName: 'ticket-log';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    attachments: Attribute.JSON;
    createdAt: Attribute.DateTime;
    createdBy: Attribute.Relation<
      'api::ticket-log.ticket-log',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
    message: Attribute.Text & Attribute.Required;
    sender: Attribute.Relation<
      'api::ticket-log.ticket-log',
      'manyToOne',
      'api::user-info.user-info'
    >;
    sender_type: Attribute.Enumeration<['store', 'handler', 'system']> &
      Attribute.DefaultTo<'store'>;
    ticket: Attribute.Relation<
      'api::ticket-log.ticket-log',
      'manyToOne',
      'api::ticket.ticket'
    > &
      Attribute.Required;
    updatedAt: Attribute.DateTime;
    updatedBy: Attribute.Relation<
      'api::ticket-log.ticket-log',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
  };
}

export interface ApiTicketTicket extends Schema.CollectionType {
  collectionName: 'tickets';
  info: {
    description: '';
    displayName: 'Ticket';
    pluralName: 'tickets';
    singularName: 'ticket';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    assignees: Attribute.Relation<
      'api::ticket.ticket',
      'manyToMany',
      'api::user-info.user-info'
    >;
    attachments: Attribute.JSON;
    attachments_media: Attribute.Media<'images', true>;
    createdAt: Attribute.DateTime;
    createdBy: Attribute.Relation<
      'api::ticket.ticket',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
    description: Attribute.Text & Attribute.Required;
    end_date: Attribute.DateTime;
    handler: Attribute.Relation<
      'api::ticket.ticket',
      'manyToOne',
      'api::user-info.user-info'
    >;
    handler_id: Attribute.Integer;
    notifications: Attribute.Relation<
      'api::ticket.ticket',
      'oneToMany',
      'api::notification.notification'
    >;
    processing_started_at: Attribute.DateTime;
    requester: Attribute.Relation<
      'api::ticket.ticket',
      'manyToOne',
      'api::user-info.user-info'
    >;
    requester_id: Attribute.Integer & Attribute.Required;
    resolved_at: Attribute.DateTime;
    responsible_department: Attribute.Relation<
      'api::ticket.ticket',
      'manyToOne',
      'api::department.department'
    > &
      Attribute.Required;
    start_date: Attribute.DateTime;
    status: Attribute.Enumeration<
      ['new', 'assigned', 'in_progress', 'resolved', 'closed', 'rejected']
    > &
      Attribute.Required &
      Attribute.DefaultTo<'new'>;
    store: Attribute.Relation<
      'api::ticket.ticket',
      'manyToOne',
      'api::store.store'
    >;
    store_id: Attribute.Integer & Attribute.Required;
    ticket_category_id: Attribute.Integer;
    ticket_code: Attribute.String & Attribute.Required & Attribute.Unique;
    ticket_logs: Attribute.Relation<
      'api::ticket.ticket',
      'oneToMany',
      'api::ticket-log.ticket-log'
    >;
    title: Attribute.String & Attribute.Required;
    type: Attribute.String;
    updatedAt: Attribute.DateTime;
    updatedBy: Attribute.Relation<
      'api::ticket.ticket',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
  };
}

export interface ApiUserInfoUserInfo extends Schema.CollectionType {
  collectionName: 'user_infos';
  info: {
    description: '';
    displayName: 'UserInfo';
    pluralName: 'user-infos';
    singularName: 'user-info';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    assigned_tickets: Attribute.Relation<
      'api::user-info.user-info',
      'manyToMany',
      'api::ticket.ticket'
    >;
    createdAt: Attribute.DateTime;
    createdBy: Attribute.Relation<
      'api::user-info.user-info',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
    department: Attribute.Relation<
      'api::user-info.user-info',
      'manyToOne',
      'api::department.department'
    >;
    email: Attribute.String;
    is_active: Attribute.Boolean;
    name: Attribute.String;
    notifications: Attribute.Relation<
      'api::user-info.user-info',
      'oneToMany',
      'api::notification.notification'
    >;
    refresh_token_expires_at: Attribute.DateTime;
    refresh_token_hash: Attribute.String;
    role: Attribute.Enumeration<['store', 'handler', 'qc', 'admin']> &
      Attribute.Required &
      Attribute.DefaultTo<'store'>;
    stores: Attribute.Relation<
      'api::user-info.user-info',
      'oneToMany',
      'api::store.store'
    >;
    suite_token: Attribute.Text;
    token_version: Attribute.Integer & Attribute.DefaultTo<0>;
    updatedAt: Attribute.DateTime;
    updatedBy: Attribute.Relation<
      'api::user-info.user-info',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
  };
}

export interface PluginContentReleasesRelease extends Schema.CollectionType {
  collectionName: 'strapi_releases';
  info: {
    displayName: 'Release';
    pluralName: 'releases';
    singularName: 'release';
  };
  options: {
    draftAndPublish: false;
  };
  pluginOptions: {
    'content-manager': {
      visible: false;
    };
    'content-type-builder': {
      visible: false;
    };
  };
  attributes: {
    actions: Attribute.Relation<
      'plugin::content-releases.release',
      'oneToMany',
      'plugin::content-releases.release-action'
    >;
    createdAt: Attribute.DateTime;
    createdBy: Attribute.Relation<
      'plugin::content-releases.release',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
    name: Attribute.String & Attribute.Required;
    releasedAt: Attribute.DateTime;
    scheduledAt: Attribute.DateTime;
    status: Attribute.Enumeration<
      ['ready', 'blocked', 'failed', 'done', 'empty']
    > &
      Attribute.Required;
    timezone: Attribute.String;
    updatedAt: Attribute.DateTime;
    updatedBy: Attribute.Relation<
      'plugin::content-releases.release',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
  };
}

export interface PluginContentReleasesReleaseAction
  extends Schema.CollectionType {
  collectionName: 'strapi_release_actions';
  info: {
    displayName: 'Release Action';
    pluralName: 'release-actions';
    singularName: 'release-action';
  };
  options: {
    draftAndPublish: false;
  };
  pluginOptions: {
    'content-manager': {
      visible: false;
    };
    'content-type-builder': {
      visible: false;
    };
  };
  attributes: {
    contentType: Attribute.String & Attribute.Required;
    createdAt: Attribute.DateTime;
    createdBy: Attribute.Relation<
      'plugin::content-releases.release-action',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
    entry: Attribute.Relation<
      'plugin::content-releases.release-action',
      'morphToOne'
    >;
    isEntryValid: Attribute.Boolean;
    locale: Attribute.String;
    release: Attribute.Relation<
      'plugin::content-releases.release-action',
      'manyToOne',
      'plugin::content-releases.release'
    >;
    type: Attribute.Enumeration<['publish', 'unpublish']> & Attribute.Required;
    updatedAt: Attribute.DateTime;
    updatedBy: Attribute.Relation<
      'plugin::content-releases.release-action',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
  };
}

export interface PluginI18NLocale extends Schema.CollectionType {
  collectionName: 'i18n_locale';
  info: {
    collectionName: 'locales';
    description: '';
    displayName: 'Locale';
    pluralName: 'locales';
    singularName: 'locale';
  };
  options: {
    draftAndPublish: false;
  };
  pluginOptions: {
    'content-manager': {
      visible: false;
    };
    'content-type-builder': {
      visible: false;
    };
  };
  attributes: {
    code: Attribute.String & Attribute.Unique;
    createdAt: Attribute.DateTime;
    createdBy: Attribute.Relation<
      'plugin::i18n.locale',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
    name: Attribute.String &
      Attribute.SetMinMax<
        {
          max: 50;
          min: 1;
        },
        number
      >;
    updatedAt: Attribute.DateTime;
    updatedBy: Attribute.Relation<
      'plugin::i18n.locale',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
  };
}

export interface PluginUploadFile extends Schema.CollectionType {
  collectionName: 'files';
  info: {
    description: '';
    displayName: 'File';
    pluralName: 'files';
    singularName: 'file';
  };
  pluginOptions: {
    'content-manager': {
      visible: false;
    };
    'content-type-builder': {
      visible: false;
    };
  };
  attributes: {
    alternativeText: Attribute.String;
    caption: Attribute.String;
    createdAt: Attribute.DateTime;
    createdBy: Attribute.Relation<
      'plugin::upload.file',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
    ext: Attribute.String;
    folder: Attribute.Relation<
      'plugin::upload.file',
      'manyToOne',
      'plugin::upload.folder'
    > &
      Attribute.Private;
    folderPath: Attribute.String &
      Attribute.Required &
      Attribute.Private &
      Attribute.SetMinMax<
        {
          min: 1;
        },
        number
      >;
    formats: Attribute.JSON;
    hash: Attribute.String & Attribute.Required;
    height: Attribute.Integer;
    mime: Attribute.String & Attribute.Required;
    name: Attribute.String & Attribute.Required;
    previewUrl: Attribute.String;
    provider: Attribute.String & Attribute.Required;
    provider_metadata: Attribute.JSON;
    related: Attribute.Relation<'plugin::upload.file', 'morphToMany'>;
    size: Attribute.Decimal & Attribute.Required;
    updatedAt: Attribute.DateTime;
    updatedBy: Attribute.Relation<
      'plugin::upload.file',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
    url: Attribute.String & Attribute.Required;
    width: Attribute.Integer;
  };
}

export interface PluginUploadFolder extends Schema.CollectionType {
  collectionName: 'upload_folders';
  info: {
    displayName: 'Folder';
    pluralName: 'folders';
    singularName: 'folder';
  };
  pluginOptions: {
    'content-manager': {
      visible: false;
    };
    'content-type-builder': {
      visible: false;
    };
  };
  attributes: {
    children: Attribute.Relation<
      'plugin::upload.folder',
      'oneToMany',
      'plugin::upload.folder'
    >;
    createdAt: Attribute.DateTime;
    createdBy: Attribute.Relation<
      'plugin::upload.folder',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
    files: Attribute.Relation<
      'plugin::upload.folder',
      'oneToMany',
      'plugin::upload.file'
    >;
    name: Attribute.String &
      Attribute.Required &
      Attribute.SetMinMax<
        {
          min: 1;
        },
        number
      >;
    parent: Attribute.Relation<
      'plugin::upload.folder',
      'manyToOne',
      'plugin::upload.folder'
    >;
    path: Attribute.String &
      Attribute.Required &
      Attribute.SetMinMax<
        {
          min: 1;
        },
        number
      >;
    pathId: Attribute.Integer & Attribute.Required & Attribute.Unique;
    updatedAt: Attribute.DateTime;
    updatedBy: Attribute.Relation<
      'plugin::upload.folder',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
  };
}

export interface PluginUsersPermissionsPermission
  extends Schema.CollectionType {
  collectionName: 'up_permissions';
  info: {
    description: '';
    displayName: 'Permission';
    name: 'permission';
    pluralName: 'permissions';
    singularName: 'permission';
  };
  pluginOptions: {
    'content-manager': {
      visible: false;
    };
    'content-type-builder': {
      visible: false;
    };
  };
  attributes: {
    action: Attribute.String & Attribute.Required;
    createdAt: Attribute.DateTime;
    createdBy: Attribute.Relation<
      'plugin::users-permissions.permission',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
    role: Attribute.Relation<
      'plugin::users-permissions.permission',
      'manyToOne',
      'plugin::users-permissions.role'
    >;
    updatedAt: Attribute.DateTime;
    updatedBy: Attribute.Relation<
      'plugin::users-permissions.permission',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
  };
}

export interface PluginUsersPermissionsRole extends Schema.CollectionType {
  collectionName: 'up_roles';
  info: {
    description: '';
    displayName: 'Role';
    name: 'role';
    pluralName: 'roles';
    singularName: 'role';
  };
  pluginOptions: {
    'content-manager': {
      visible: false;
    };
    'content-type-builder': {
      visible: false;
    };
  };
  attributes: {
    createdAt: Attribute.DateTime;
    createdBy: Attribute.Relation<
      'plugin::users-permissions.role',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
    description: Attribute.String;
    name: Attribute.String &
      Attribute.Required &
      Attribute.SetMinMaxLength<{
        minLength: 3;
      }>;
    permissions: Attribute.Relation<
      'plugin::users-permissions.role',
      'oneToMany',
      'plugin::users-permissions.permission'
    >;
    type: Attribute.String & Attribute.Unique;
    updatedAt: Attribute.DateTime;
    updatedBy: Attribute.Relation<
      'plugin::users-permissions.role',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
    users: Attribute.Relation<
      'plugin::users-permissions.role',
      'oneToMany',
      'plugin::users-permissions.user'
    >;
  };
}

export interface PluginUsersPermissionsUser extends Schema.CollectionType {
  collectionName: 'up_users';
  info: {
    description: '';
    displayName: 'User';
    name: 'user';
    pluralName: 'users';
    singularName: 'user';
  };
  options: {
    draftAndPublish: false;
    timestamps: true;
  };
  attributes: {
    blocked: Attribute.Boolean & Attribute.DefaultTo<false>;
    confirmationToken: Attribute.String & Attribute.Private;
    confirmed: Attribute.Boolean & Attribute.DefaultTo<false>;
    createdAt: Attribute.DateTime;
    createdBy: Attribute.Relation<
      'plugin::users-permissions.user',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
    email: Attribute.Email &
      Attribute.Required &
      Attribute.SetMinMaxLength<{
        minLength: 6;
      }>;
    password: Attribute.Password &
      Attribute.Private &
      Attribute.SetMinMaxLength<{
        minLength: 6;
      }>;
    provider: Attribute.String;
    resetPasswordToken: Attribute.String & Attribute.Private;
    role: Attribute.Relation<
      'plugin::users-permissions.user',
      'manyToOne',
      'plugin::users-permissions.role'
    >;
    updatedAt: Attribute.DateTime;
    updatedBy: Attribute.Relation<
      'plugin::users-permissions.user',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
    username: Attribute.String &
      Attribute.Required &
      Attribute.Unique &
      Attribute.SetMinMaxLength<{
        minLength: 3;
      }>;
  };
}

declare module '@strapi/types' {
  export module Shared {
    export interface ContentTypes {
      'admin::api-token': AdminApiToken;
      'admin::api-token-permission': AdminApiTokenPermission;
      'admin::permission': AdminPermission;
      'admin::role': AdminRole;
      'admin::transfer-token': AdminTransferToken;
      'admin::transfer-token-permission': AdminTransferTokenPermission;
      'admin::user': AdminUser;
      'api::department.department': ApiDepartmentDepartment;
      'api::notification.notification': ApiNotificationNotification;
      'api::qc-criterion.qc-criterion': ApiQcCriterionQcCriterion;
      'api::qc-draft.qc-draft': ApiQcDraftQcDraft;
      'api::qc-finding.qc-finding': ApiQcFindingQcFinding;
      'api::qc-form-criterion.qc-form-criterion': ApiQcFormCriterionQcFormCriterion;
      'api::qc-form-version.qc-form-version': ApiQcFormVersionQcFormVersion;
      'api::qc-form.qc-form': ApiQcFormQcForm;
      'api::qc-session-item.qc-session-item': ApiQcSessionItemQcSessionItem;
      'api::qc-session.qc-session': ApiQcSessionQcSession;
      'api::store.store': ApiStoreStore;
      'api::ticket-log.ticket-log': ApiTicketLogTicketLog;
      'api::ticket.ticket': ApiTicketTicket;
      'api::user-info.user-info': ApiUserInfoUserInfo;
      'plugin::content-releases.release': PluginContentReleasesRelease;
      'plugin::content-releases.release-action': PluginContentReleasesReleaseAction;
      'plugin::i18n.locale': PluginI18NLocale;
      'plugin::upload.file': PluginUploadFile;
      'plugin::upload.folder': PluginUploadFolder;
      'plugin::users-permissions.permission': PluginUsersPermissionsPermission;
      'plugin::users-permissions.role': PluginUsersPermissionsRole;
      'plugin::users-permissions.user': PluginUsersPermissionsUser;
    }
  }
}
