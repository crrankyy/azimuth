import { RETRYABLE_4XX } from "./status-codes";

export function classifyResponse(status: number, _headers: Headers): "retryable" | "permanent" {
  if (status >= 500) return "retryable";
  return RETRYABLE_4XX.has(status) ? "retryable" : "permanent";
}
