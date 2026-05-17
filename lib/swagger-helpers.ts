/** Shared OpenAPI fragments for SSDomada specs. */

export const stdErrorResponses = {
  "401": { description: "Unauthorized — missing or invalid session" },
  "403": { description: "Forbidden — wrong role or suspended account" },
  "404": { description: "Not found" },
  "422": { description: "Validation error" },
  "500": { description: "Server error" },
};

export const successEnvelope = {
  type: "object" as const,
  properties: {
    success: { type: "boolean" as const, example: true },
    data: { type: "object" as const },
    meta: {
      type: "object" as const,
      properties: {
        page: { type: "integer" as const },
        limit: { type: "integer" as const },
        total: { type: "integer" as const },
      },
    },
  },
};

export function pathId(name = "id") {
  return [{ name, in: "path" as const, required: true, schema: { type: "string" as const } }];
}

export function paginatedQuery() {
  return [
    { name: "page", in: "query" as const, schema: { type: "integer" as const, default: 1 } },
    { name: "limit", in: "query" as const, schema: { type: "integer" as const, default: 20 } },
  ];
}
