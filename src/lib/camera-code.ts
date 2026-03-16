export type CameraQueryType = "exact" | "suffix";

export interface CameraQuery {
  rawQuery: string;
  normalizedQuery: string;
  queryType: CameraQueryType;
}

export function normalizeCameraCode(value: string): string {
  return value.trim().replace(/[\s-]+/g, "").toUpperCase();
}

export function extractLastFourDigits(value: string): string | null {
  const normalized = normalizeCameraCode(value);
  const digits = normalized.replace(/\D/g, "");
  if (digits.length < 4) {
    return null;
  }

  return digits.slice(-4);
}

export function classifyCameraQuery(value: string): CameraQuery {
  const normalizedQuery = normalizeCameraCode(value);
  return {
    rawQuery: value,
    normalizedQuery,
    queryType: /^\d{4}$/.test(normalizedQuery) ? "suffix" : "exact",
  };
}
