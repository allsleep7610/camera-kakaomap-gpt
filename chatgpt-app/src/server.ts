import { createServer } from "node:http";
import { loadCameraRepository } from "../../src/lib/camera-store.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { z } from "zod";
import { buildManifest } from "./manifest.js";

const port = Number(process.env.PORT ?? 8787);
const repositoryPromise = loadCameraRepository(process.env.CAMERA_DATA_PATH ?? "data/cameras.json");

const itemSchema = z.object({
  code: z.string().min(1).describe("제어기번호 또는 카메라 관리번호"),
  sourceAddress: z.string().optional().describe("일정표에 표시된 주소/지점 위치"),
  siteName: z.string().optional().describe("일정표에 표시된 지점명"),
  inspectionType: z.string().optional().describe("점검/인수 등 일정표의 작업 유형"),
  manualLatitude: z.number().optional().describe("K 행을 수동 처리할 때 KakaoMap에서 확인한 위도"),
  manualLongitude: z.number().optional().describe("K 행을 수동 처리할 때 KakaoMap에서 확인한 경도"),
});

const dateSchema = z.object({
  date: z.string().min(1).describe("YYYY-MM-DD, YYYYMMDD 또는 YYMMDD"),
  items: z.array(itemSchema).min(1),
});

function createAppServer() {
  const server = new McpServer({ name: "camera-kakaomap-chatgpt-app", version: "0.1.0" });

  server.registerTool(
    "lookup_camera",
    {
      title: "카메라 위치 조회",
      description: "Use this when the user wants to look up one unmanned traffic-enforcement camera code and receive its resolved address and KakaoMap link.",
      inputSchema: { code: z.string().min(1).describe("전체 관리번호 또는 끝 4자리") },
      annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false, idempotentHint: true },
    },
    async ({ code }) => {
      const repository = await repositoryPromise;
      const result = repository.lookup(code);
      return {
        content: [{ type: "text", text: JSON.stringify(result) }],
        structuredContent: result as unknown as Record<string, unknown>,
      };
    },
  );

  server.registerTool(
    "prepare_trip_manifest",
    {
      title: "출장 일정 저장안 만들기",
      description: "Use this when the user provides a schedule image or table and wants the selected camera rows normalized into YYMMDD folders, checked against the camera dataset and source addresses, and converted into KakaoMap save links. Do not call this for Google Photos availability checks. K-prefixed handover rows are excluded unless the user explicitly confirms them.",
      inputSchema: {
        dates: z.array(dateSchema).min(1).describe("사용자가 선택한 날짜별 일정 행. 인접 행을 임의로 추가하지 마세요."),
        allowKRows: z.boolean().optional().default(false).describe("사용자가 K 인수/인수검사 행을 명시적으로 포함한 경우에만 true"),
      },
      annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false, idempotentHint: true },
    },
    async ({ dates, allowKRows }) => {
      const repository = await repositoryPromise;
      const result = buildManifest(repository, { dates, allowKRows });
      return {
        content: [{ type: "text", text: JSON.stringify(result) }],
        structuredContent: result as unknown as Record<string, unknown>,
      };
    },
  );

  return server;
}

function setCors(res: import("node:http").ServerResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Expose-Headers", "Mcp-Session-Id");
}

createServer(async (req, res) => {
  if (!req.url) {
    res.writeHead(400).end("Missing URL");
    return;
  }
  const url = new URL(req.url, `http://${req.headers.host ?? "localhost"}`);
  const isMcpRoute = url.pathname === "/mcp" || url.pathname.startsWith("/mcp/");

  if (req.method === "OPTIONS" && isMcpRoute) {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, GET, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "content-type, mcp-session-id",
      "Access-Control-Expose-Headers": "Mcp-Session-Id",
    }).end();
    return;
  }

  if (req.method === "GET" && url.pathname === "/") {
    res.writeHead(200, { "content-type": "application/json; charset=utf-8" }).end(JSON.stringify({ ok: true, name: "camera-kakaomap-chatgpt-app", mcp: "/mcp" }));
    return;
  }

  if (isMcpRoute && req.method && new Set(["GET", "POST", "DELETE"]).has(req.method)) {
    setCors(res);
    const server = createAppServer();
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
    res.on("close", () => { void transport.close(); void server.close(); });
    try {
      await server.connect(transport);
      await transport.handleRequest(req, res);
    } catch (error) {
      console.error("MCP request failed", error);
      if (!res.headersSent) res.writeHead(500).end("Internal server error");
    }
    return;
  }

  res.writeHead(404).end("Not Found");
}).listen(port, () => {
  console.log(`camera-kakaomap-chatgpt-app listening on http://localhost:${port}/mcp`);
});
