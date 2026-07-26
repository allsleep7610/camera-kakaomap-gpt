import type { CameraMatch, CameraRepository } from "../../src/lib/camera-store.js";

export interface TripItemInput {
  code: string;
  sourceAddress?: string;
  siteName?: string;
  inspectionType?: string;
  manualLatitude?: number;
  manualLongitude?: number;
}

export interface TripDateInput {
  date: string;
  items: TripItemInput[];
}

export interface ManifestOptions {
  dates: TripDateInput[];
  allowKRows?: boolean;
}

export interface ManifestItem {
  code: string;
  favoriteName: string;
  kakaoMapUrl: string;
  sourceAddress?: string;
  resolvedAddress?: string;
  addressMatch: "match" | "mismatch" | "unverified";
  lookupSource: "camera-dataset" | "kakaomap-address-search";
}

export interface ManifestResult {
  folders: Array<{ folder: string; items: ManifestItem[] }>;
  excluded: Array<{ date: string; code: string; reason: string }>;
  missing: Array<{ date: string; code: string; reason: string }>;
  coverage: { selected: number; accounted: number; complete: boolean };
  note: string;
}

function normalizeDate(value: string): string | null {
  const digits = value.replace(/[^0-9]/g, "");
  if (/^\d{6}$/.test(digits)) return digits;
  if (/^\d{8}$/.test(digits)) return `${digits.slice(2, 4)}${digits.slice(4, 6)}${digits.slice(6, 8)}`;
  return null;
}

function normalizeText(value: string): string {
  return value.toLowerCase().replace(/[\s,./()\-]/g, "");
}

function addressMatch(sourceAddress: string | undefined, match: CameraMatch): ManifestItem["addressMatch"] {
  if (!sourceAddress?.trim()) return "unverified";
  const source = normalizeText(sourceAddress);
  const resolved = normalizeText(match.roadAddress ?? match.lotNumberAddress ?? "");
  if (!resolved) return "unverified";
  if (source.includes(resolved) || resolved.includes(source)) return "match";

  const sourceDistricts = sourceAddress.match(/(?:서울|부산|대구|인천|광주|대전|울산|세종|경기|강원|충북|충남|전북|전남|경북|경남|제주)[^\s,]*/g) ?? [];
  const resolvedDistricts = `${match.roadAddress ?? ""} ${match.lotNumberAddress ?? ""}`.match(/(?:서울|부산|대구|인천|광주|대전|울산|세종|경기|강원|충북|충남|전북|전남|경북|경남|제주)[^\s,]*/g) ?? [];
  if (sourceDistricts.length > 0 && resolvedDistricts.length > 0 && sourceDistricts[0] !== resolvedDistricts[0]) {
    return "mismatch";
  }
  return "unverified";
}

function safeFavoriteLabel(value: string): string {
  return value.replaceAll(",", "-").replace(/\s+/g, " ").trim();
}

function buildSaveUrl(favoriteName: string, latitude: number, longitude: number): string {
  return `https://map.kakao.com/link/map/${encodeURIComponent(favoriteName)},${latitude},${longitude}`;
}

function itemFromMatch(index: number, input: TripItemInput, match: CameraMatch): ManifestItem {
  const resolvedAddress = match.roadAddress ?? match.lotNumberAddress;
  return {
    code: input.code,
    favoriteName: `${index}. ${safeFavoriteLabel(input.code)} ${safeFavoriteLabel(match.cameraName)}`,
    kakaoMapUrl: buildSaveUrl(`${index}. ${safeFavoriteLabel(input.code)} ${safeFavoriteLabel(match.cameraName)}`, match.latitude, match.longitude),
    sourceAddress: input.sourceAddress,
    resolvedAddress,
    addressMatch: addressMatch(input.sourceAddress, match),
    lookupSource: "camera-dataset",
  };
}

function manualItemFromInput(index: number, input: TripItemInput): ManifestItem | null {
  if (input.manualLatitude === undefined || input.manualLongitude === undefined) return null;
  const favoriteName = `${index}. ${safeFavoriteLabel(input.code)} ${safeFavoriteLabel(input.siteName ?? input.code)}`;
  return {
    code: input.code,
    favoriteName,
    kakaoMapUrl: buildSaveUrl(favoriteName, input.manualLatitude, input.manualLongitude),
    sourceAddress: input.sourceAddress,
    resolvedAddress: input.sourceAddress,
    addressMatch: input.sourceAddress ? "match" : "unverified",
    lookupSource: "kakaomap-address-search",
  };
}

export function buildManifest(repository: CameraRepository, options: ManifestOptions): ManifestResult {
  const folders = new Map<string, ManifestItem[]>();
  const excluded: ManifestResult["excluded"] = [];
  const missing: ManifestResult["missing"] = [];
  let selected = 0;

  const sortedDates = [...options.dates].sort((left, right) => (normalizeDate(left.date) ?? "").localeCompare(normalizeDate(right.date) ?? ""));

  for (const dateGroup of sortedDates) {
    const folder = normalizeDate(dateGroup.date);
    if (!folder) {
      for (const item of dateGroup.items) missing.push({ date: dateGroup.date, code: item.code, reason: "invalid-date" });
      continue;
    }

    const included: ManifestItem[] = [];
    for (const input of dateGroup.items) {
      selected += 1;
      const code = input.code.trim().toUpperCase();
      if (code.startsWith("K") && !options.allowKRows) {
        excluded.push({ date: folder, code, reason: "K-row requires explicit allowKRows=true" });
        continue;
      }

      if (code.startsWith("K")) {
        const manualItem = manualItemFromInput(included.length + 1, { ...input, code });
        if (!manualItem) {
          missing.push({ date: folder, code, reason: "K-row-requires-manual-kakaomap-resolution" });
          continue;
        }
        included.push(manualItem);
        continue;
      }

      const lookup = repository.lookup(code);
      if (!lookup.matched || lookup.results.length !== 1) {
        missing.push({ date: folder, code, reason: lookup.results.length > 1 ? "ambiguous-camera-code" : "camera-not-found" });
        continue;
      }

      const item = itemFromMatch(included.length + 1, { ...input, code }, lookup.results[0]);
      if (item.addressMatch === "mismatch") {
        missing.push({ date: folder, code, reason: "address-mismatch" });
        continue;
      }
      included.push(item);
    }
    if (included.length > 0) folders.set(folder, included);
  }

  const resultFolders = [...folders.entries()].sort(([left], [right]) => left.localeCompare(right)).map(([folder, items]) => ({ folder, items }));
  const accounted = resultFolders.reduce((sum, folder) => sum + folder.items.length, 0) + excluded.length + missing.length;
  return {
    folders: resultFolders,
    excluded,
    missing,
    coverage: { selected, accounted, complete: selected === accounted },
    note: "이 결과는 저장 전 검토용입니다. 웹 ChatGPT 앱은 사용자의 KakaoMap 폴더에 자동 저장하지 않습니다.",
  };
}
