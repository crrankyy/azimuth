export const attemptsResponse = {
  type: "array",
  items: {
    type: "object",
    required: ["attempt", "startedAt", "durationMs", "status", "error", "truncated"],
    properties: {
      attempt: { type: "integer" },
      startedAt: { type: "string", format: "date-time" },
      durationMs: { type: "integer" },
      status: { type: ["integer", "null"] },
      error: { type: ["string", "null"] },
      responseExcerpt: { type: ["string", "null"] },
      truncated: { type: "boolean" },
    },
  },
} as const;
