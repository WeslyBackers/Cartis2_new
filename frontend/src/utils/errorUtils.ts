type ApiErrorShape = {
  message?: unknown;
  code?: unknown;
};

export function getApiErrorMessage(error: unknown, fallback = 'Er ging iets mis'): string {
  const maybeError = error as any;
  const apiError = maybeError?.response?.data?.error as unknown;

  if (typeof apiError === 'string' && apiError.trim()) {
    return apiError;
  }

  if (apiError && typeof apiError === 'object') {
    const structuredError = apiError as ApiErrorShape;

    if (typeof structuredError.message === 'string' && structuredError.message.trim()) {
      return structuredError.message;
    }

    if (typeof structuredError.code === 'string' && structuredError.code.trim()) {
      return `${fallback} (${structuredError.code})`;
    }
  }

  if (typeof maybeError?.message === 'string' && maybeError.message.trim()) {
    return maybeError.message;
  }

  return fallback;
}
