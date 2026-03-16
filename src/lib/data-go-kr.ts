import { writeFile } from "node:fs/promises";
import path from "node:path";

import type { CameraRecord } from "./camera-store.js";

const SERVICE_URL = "http://api.data.go.kr/openapi/tn_pubr_public_unmanned_traffic_camera_api";

interface FetchOptions {
  serviceKey: string;
  pageSize?: number;
  maxPages?: number;
  outputPath?: string;
}

function extractItems(payload: any): any[] {
  const candidates = [
    payload?.response?.body?.items?.item,
    payload?.response?.body?.items,
    payload?.items?.item,
    payload?.items,
    payload?.data,
  ];

  for (const candidate of candidates) {
    if (Array.isArray(candidate)) {
      return candidate;
    }
  }

  return [];
}

function extractTotalCount(payload: any, fallbackCount: number): number {
  const totalCount = Number(payload?.response?.body?.totalCount);
  return Number.isFinite(totalCount) && totalCount > 0 ? totalCount : fallbackCount;
}

function toCameraRecord(item: Record<string, unknown>): CameraRecord | null {
  const cameraCode = typeof item.mnlssRegltCameraManageNo === "string"
    ? item.mnlssRegltCameraManageNo.trim()
    : "";
  const latitude = Number(item.latitude);
  const longitude = Number(item.longitude);

  if (!cameraCode || !Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return null;
  }

  return {
    cameraCode,
    cameraName:
      typeof item.itlpc === "string" && item.itlpc.trim() !== ""
        ? item.itlpc.trim()
        : cameraCode,
    roadAddress: typeof item.rdnmadr === "string" ? item.rdnmadr.trim() : undefined,
    lotNumberAddress: typeof item.lnmadr === "string" ? item.lnmadr.trim() : undefined,
    latitude,
    longitude,
    installationLocation:
      typeof item.itlpc === "string" ? item.itlpc.trim() : undefined,
    enforcementType: typeof item.regltSe === "string" ? item.regltSe.trim() : undefined,
    speedLimit: Number.isFinite(Number(item.lmttVe)) ? Number(item.lmttVe) : undefined,
    provinceName: typeof item.ctprvnNm === "string" ? item.ctprvnNm.trim() : undefined,
    cityName: typeof item.signguNm === "string" ? item.signguNm.trim() : undefined,
    sourceUpdatedAt:
      typeof item.referenceDate === "string" ? item.referenceDate.trim() : undefined,
  };
}

export async function fetchCameraRecordsFromApi(options: FetchOptions): Promise<CameraRecord[]> {
  const pageSize = options.pageSize ?? 1000;
  const maxPages = options.maxPages ?? 100;
  const output: CameraRecord[] = [];

  for (let pageNo = 1; pageNo <= maxPages; pageNo += 1) {
    const url = new URL(SERVICE_URL);
    url.searchParams.set("serviceKey", options.serviceKey);
    url.searchParams.set("pageNo", String(pageNo));
    url.searchParams.set("numOfRows", String(pageSize));
    url.searchParams.set("type", "json");

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Public data request failed with status ${response.status}`);
    }

    const payload = await response.json();
    const items = extractItems(payload);
    const records = items
      .map((item) => toCameraRecord(item as Record<string, unknown>))
      .filter((item): item is CameraRecord => item !== null);

    output.push(...records);

    const totalCount = extractTotalCount(payload, output.length);
    if (records.length === 0 || output.length >= totalCount) {
      break;
    }
  }

  return output;
}

export async function writeCameraRecords(
  records: CameraRecord[],
  outputPath = "data/cameras.json",
): Promise<string> {
  const resolvedPath = path.isAbsolute(outputPath)
    ? outputPath
    : path.resolve(process.cwd(), outputPath);
  const serialized = JSON.stringify(records, null, 2);
  await writeFile(resolvedPath, `${serialized}\n`, "utf8");
  return resolvedPath;
}
