import { readFile } from "node:fs/promises";
import path from "node:path";

import { classifyCameraQuery, extractLastFourDigits, normalizeCameraCode } from "./camera-code.js";
import { buildKakaoMapUrl } from "./kakao-link.js";

export interface CameraRecord {
  cameraCode: string;
  cameraName: string;
  roadAddress?: string;
  lotNumberAddress?: string;
  latitude: number;
  longitude: number;
  installationLocation?: string;
  enforcementType?: string;
  speedLimit?: number;
  provinceName?: string;
  cityName?: string;
  sourceUpdatedAt?: string;
}

export interface CameraMatch {
  cameraCode: string;
  cameraName: string;
  roadAddress?: string;
  lotNumberAddress?: string;
  latitude: number;
  longitude: number;
  installationLocation?: string;
  enforcementType?: string;
  speedLimit?: number;
  provinceName?: string;
  cityName?: string;
  sourceUpdatedAt?: string;
  kakaoMapUrl: string;
  suffixDigits: string | null;
}

export interface CameraLookupResponse {
  query: string;
  normalizedQuery: string;
  queryType: "exact" | "suffix";
  matched: boolean;
  count: number;
  source: string;
  results: CameraMatch[];
  message?: string;
}

interface IndexedCameraRecord extends CameraRecord {
  normalizedCameraCode: string;
  suffixDigits: string | null;
}

function toNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function toOptionalString(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed === "" ? undefined : trimmed;
}

function pickFirstString(input: Record<string, unknown>, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = toOptionalString(input[key]);
    if (value) {
      return value;
    }
  }

  return undefined;
}

function pickFirstNumber(input: Record<string, unknown>, keys: string[]): number | undefined {
  for (const key of keys) {
    const value = toNumber(input[key]);
    if (value !== null) {
      return value;
    }
  }

  return undefined;
}

function toCameraRecord(input: Record<string, unknown>): CameraRecord | null {
  const cameraCode = pickFirstString(input, ["cameraCode", "mnlssRegltCameraManageNo"]);
  const latitude = pickFirstNumber(input, ["latitude"]);
  const longitude = pickFirstNumber(input, ["longitude"]);

  if (!cameraCode || latitude === undefined || longitude === undefined) {
    return null;
  }

  return {
    cameraCode,
    cameraName:
      pickFirstString(input, ["cameraName"]) ??
      pickFirstString(input, ["instlLc", "itlpc"]) ??
      cameraCode,
    roadAddress: pickFirstString(input, ["roadAddress", "rdnmadr"]),
    lotNumberAddress: pickFirstString(input, ["lotNumberAddress", "lnmadr"]),
    latitude,
    longitude,
    installationLocation: pickFirstString(input, ["installationLocation", "instlLc", "itlpc"]),
    enforcementType: pickFirstString(input, ["enforcementType", "regltSe"]),
    speedLimit: pickFirstNumber(input, ["speedLimit", "lmttVe"]),
    provinceName: pickFirstString(input, ["provinceName", "ctprvnNm"]),
    cityName: pickFirstString(input, ["cityName", "signguNm"]),
    sourceUpdatedAt: pickFirstString(input, ["sourceUpdatedAt", "referenceDate"]),
  };
}

function toMatch(record: IndexedCameraRecord): CameraMatch {
  const name = record.cameraName || record.installationLocation || record.cameraCode;
  return {
    cameraCode: record.cameraCode,
    cameraName: record.cameraName,
    roadAddress: record.roadAddress,
    lotNumberAddress: record.lotNumberAddress,
    latitude: record.latitude,
    longitude: record.longitude,
    installationLocation: record.installationLocation,
    enforcementType: record.enforcementType,
    speedLimit: record.speedLimit,
    provinceName: record.provinceName,
    cityName: record.cityName,
    sourceUpdatedAt: record.sourceUpdatedAt,
    suffixDigits: record.suffixDigits,
    kakaoMapUrl: buildKakaoMapUrl(name, record.latitude, record.longitude),
  };
}

export class CameraRepository {
  constructor(
    private readonly records: IndexedCameraRecord[],
    private readonly source = "NationalTrafficEnforcementCameraStandardData",
  ) {}

  lookup(queryValue: string): CameraLookupResponse {
    const query = classifyCameraQuery(queryValue);
    const messageBase = {
      query: query.rawQuery,
      normalizedQuery: query.normalizedQuery,
      queryType: query.queryType,
      source: this.source,
    } as const;

    if (query.queryType === "suffix") {
      const matches = this.records
        .filter((record) => record.suffixDigits === query.normalizedQuery)
        .sort((left, right) => left.cameraCode.localeCompare(right.cameraCode))
        .map(toMatch);

      return matches.length > 0
        ? {
            ...messageBase,
            matched: true,
            count: matches.length,
            results: matches,
          }
        : {
            ...messageBase,
            matched: false,
            count: 0,
            results: [],
            message: "No cameras found with the same last four digits.",
          };
    }

    const match = this.records.find(
      (record) => record.normalizedCameraCode === query.normalizedQuery,
    );

    if (!match) {
      return {
        ...messageBase,
        matched: false,
        count: 0,
        results: [],
        message: "No camera found for the provided management number.",
      };
    }

    return {
      ...messageBase,
      matched: true,
      count: 1,
      results: [toMatch(match)],
    };
  }
}

export async function loadCameraRepository(dataFilePath: string): Promise<CameraRepository> {
  const resolvedPath = path.isAbsolute(dataFilePath)
    ? dataFilePath
    : path.resolve(process.cwd(), dataFilePath);
  const raw = await readFile(resolvedPath, "utf8");
  const parsed = JSON.parse(raw) as unknown;

  if (!Array.isArray(parsed)) {
    throw new Error(`Camera data must be a JSON array: ${resolvedPath}`);
  }

  const records = parsed
    .map((item) => toCameraRecord(item as Record<string, unknown>))
    .filter((item): item is CameraRecord => item !== null)
    .map((record) => ({
      ...record,
      normalizedCameraCode: normalizeCameraCode(record.cameraCode),
      suffixDigits: extractLastFourDigits(record.cameraCode),
    }));

  return new CameraRepository(records);
}
