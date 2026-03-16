import "dotenv/config";

import { fetchCameraRecordsFromApi, writeCameraRecords } from "../src/lib/data-go-kr.js";

async function main(): Promise<void> {
  const serviceKey = process.env.DATA_GO_KR_SERVICE_KEY;

  if (!serviceKey) {
    throw new Error("DATA_GO_KR_SERVICE_KEY is required.");
  }

  const pageSize = Number(process.env.PAGE_SIZE ?? 1000);
  const maxPages = Number(process.env.MAX_PAGES ?? 100);
  const outputPath = process.env.OUTPUT_PATH ?? "data/cameras.json";

  const records = await fetchCameraRecordsFromApi({
    serviceKey,
    pageSize,
    maxPages,
    outputPath,
  });

  const writtenPath = await writeCameraRecords(records, outputPath);
  console.log(`Synced ${records.length} records to ${writtenPath}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
