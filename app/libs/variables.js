
const mustExcludes = ['/', 'favicon.ico', 'favicon.png', 'api/refresh_token', 'api/login'];
const enableStatuses = [true, 'e', 'enable'];
const availableSortFields = ['reason', 'money', 'created_at', 'updated_at'];
const sortDirectionAscending = ['a', 'asc', 'ascending', 'true', true];
const redisNamespace = 'money-diary-server';
const maxLimit = 1000;
const initializeStatuses = { start: 'start', done: 'done' };

const env = process.env.ENVIRONMENT;
const isProductionEnv = (env === 'production');
const isDemoEnv = (env === 'demo');

const statusCodes = {
  MISSING_TOKEN: 425,
  NOT_HAVE_PERMISSION: 405,
  INVALID_AUTH_TOKEN: 410,
  INVALID_REQUEST_SO_MANY_TIMES: 428,
  ERROR_CONSUME_POINT: 501,
  NOT_FOUND: 404,
  DUPLICATED: 409,
  OK: 200,
  INTERNAL_SERVER_ERROR: 500,
  DATA_CREATED: 201,
  UNPROCESSABLE_ENTITY: 422,
  MUST_PROVIDE_USER_IP_ADDRESS: 421,
  INVALID_REFRESH_TOKEN: 402,
  REFRESH_TOKEN_EXPIRED: 423,
  MUST_PROVIDE_USERNAME_AND_PASSWORD: 424,
  INVALID_USERNAME_OR_PASSWORD: 410,
  TOO_MANY_LOGIN_ATTEMPS: 420,
  TOO_MANY_FAILED_LOGIN_ATTEMPS: 426,
  NO_CONTENT: 204,
  SESSION_HAS_BEEN_EXPIRED: 427,
  RECORD_ALREADY_EXISTS: 430,
  NOTHING_TO_IMPORT: 411,
  TOO_MANY_REQUESTS: 429,
}

const tableDefinition = `

-- ----------------------------
-- Table structure for diaries
-- ----------------------------
-- DROP TABLE IF EXISTS "public"."diaries";

CREATE TABLE "public"."diaries" (
  "id" SERIAL PRIMARY KEY NOT NULL,
  "reason" varchar(500) COLLATE "pg_catalog"."default" NOT NULL,
  "money" numeric(18,4) NOT NULL DEFAULT 0,
  "category_id" int NOT NULL DEFAULT 0,
  "created_at" timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE public.categories (
  id SERIAL PRIMARY KEY NOT NULL,
  name varchar NOT NULL,
  text_color_variant varchar NOT NULL,
  bg_color_variant varchar NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  "created_at" timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP
);


-- ----------------------------
-- Indexes structure for table diaries
-- ----------------------------
CREATE INDEX "diary_created_at" ON "public"."diaries" USING btree (
  "created_at" "pg_catalog"."timestamp_ops" ASC NULLS LAST
);
CREATE INDEX "diary_money" ON "public"."diaries" USING btree (
  "money" "pg_catalog"."numeric_ops" ASC NULLS LAST
);
CREATE INDEX "diary_reason" ON "public"."diaries" USING btree (
  "reason" COLLATE "pg_catalog"."default" "pg_catalog"."text_ops" ASC NULLS LAST
);
CREATE INDEX "diary_updated_at" ON "public"."diaries" USING btree (
  "updated_at" "pg_catalog"."timestamp_ops" ASC NULLS LAST
);

CREATE INDEX "category_created_at" ON "public"."categories" USING btree (
  "created_at" "pg_catalog"."timestamp_ops" ASC NULLS LAST
);
CREATE INDEX "category_updated_at" ON "public"."categories" USING btree (
  "updated_at" "pg_catalog"."timestamp_ops" ASC NULLS LAST
);
CREATE INDEX "category_enabled" ON "public"."categories" USING btree (
  "enabled" "pg_catalog"."bool_ops" ASC NULLS LAST
);

`;

const jwtConfig = {
  payload: {},
  options: {
    issuer: 'Money Diary Server',
    audience: process.env.SERVER_DOMAIN,
    expiresIn: process.env.JWT_EXPIRES_IN || '2h',
    algorithm: 'RS256'
  }
}

const ISO8601format = ['YYYY-MM-DDTHH:mm:ss.sssZ', 'YYYY-MM-DDTHH:mm:ssZ'];

const tokenQuerySchema = {
  type: 'object',
  properties: {
    auth_token: { type: 'string' },
  },
};

const paramSchema = {
  type: 'object',
  properties: {
    id: { type: 'integer' },
  },
  required: ['id'],
};

const baseQuerySchema = {
  type: 'object',
  properties: {
    ...tokenQuerySchema.properties,
    limit: { type: 'integer' },
    offset: { type: 'integer' },
    sort_field: { type: 'string' },
    sort_direction: { type: 'string' },
  },
};

const dateSchema = {
  date: { type: 'number' },
  utc_offset: { type: 'number' },
  group_by_date: { type: 'boolean' },
};

const dateQuerySchema = {
  type: 'object',
  properties: {
    ...baseQuerySchema.properties,
    ...dateSchema,
  },
  required: ['date'],
};

const searchSchema = {
  from_date: { type: ['null', 'number'] },
  to_date: { type: ['null', 'number'] },
  utc_offset: { type: ['null', 'number'] },
};

const baseSearchQuerySchema = {
  type: 'object',
  properties: {
    ...baseQuerySchema.properties,
    ...searchSchema,
  },
};

const dateRangeQuerySchema = {
  type: 'object',
  properties: {
    ...baseSearchQuerySchema.properties,
    group_by_date: { type: 'boolean' },
  },
};

const bulkDeleteParamSchema = {
  type: 'array',
  items: { type: 'number' }
};

module.exports = {
  mustExcludes, enableStatuses, tableDefinition,
  sortDirectionAscending, availableSortFields,
  statusCodes, jwtConfig, maxLimit, ISO8601format,
  redisNamespace, isDemoEnv, isProductionEnv, paramSchema,
  dateRangeQuerySchema, baseSearchQuerySchema, dateQuerySchema,
  bulkDeleteParamSchema, baseQuerySchema, initializeStatuses,
}
