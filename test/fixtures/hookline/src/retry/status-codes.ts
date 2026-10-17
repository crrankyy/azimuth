/** 4xx responses that mean "try again later" rather than "this request is wrong". */
export const RETRYABLE_4XX: ReadonlySet<number> = new Set([408, 429]);
