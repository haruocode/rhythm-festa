type Env = {
  RHYTHM_FESTA_BUCKET: R2Bucket;
  ASSETS?: {
    fetch(request: Request): Promise<Response>;
  };
  ADMIN_TOKEN?: string;
};

type ApiChart = {
  title?: unknown;
  artist?: unknown;
  audioUrl?: unknown;
  sections?: unknown;
  notes?: unknown;
};

type ApiNote = {
  id?: unknown;
  timeMs?: unknown;
  team?: unknown;
};

type ApiSection = {
  id?: unknown;
  name?: unknown;
  startMeasure?: unknown;
  endMeasure?: unknown;
};

const JSON_HEADERS = {
  "content-type": "application/json; charset=utf-8",
};
const MAX_MP3_BYTES = 50 * 1024 * 1024;
const CHART_PREFIX = "charts/";
const MUSIC_PREFIX = "music/";

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders() });
    }

    try {
      if (url.pathname === "/api/charts" && request.method === "GET") {
        return withCors(await listCharts(env));
      }

      if (url.pathname.startsWith("/api/charts/")) {
        const chartId = getSafeId(url.pathname.slice("/api/charts/".length));

        if (request.method === "GET") {
          return withCors(await getChart(env, chartId));
        }

        if (request.method === "PUT") {
          const authResponse = requireAdmin(request, env);
          if (authResponse) {
            return withCors(authResponse);
          }

          return withCors(await putChart(request, env, chartId));
        }

        if (request.method === "DELETE") {
          const authResponse = requireAdmin(request, env);
          if (authResponse) {
            return withCors(authResponse);
          }

          return withCors(await deleteChart(env, chartId));
        }
      }

      if (url.pathname === "/api/music" && request.method === "GET") {
        return withCors(await listMusic(env));
      }

      if (url.pathname === "/api/music" && request.method === "POST") {
        const authResponse = requireAdmin(request, env);
        if (authResponse) {
          return withCors(authResponse);
        }

        return withCors(await uploadMusic(request, env));
      }

      if (url.pathname.startsWith("/api/music/") && request.method === "DELETE") {
        const authResponse = requireAdmin(request, env);
        if (authResponse) {
          return withCors(authResponse);
        }

        const filename = getSafeMp3Filename(url.pathname.slice("/api/music/".length));
        return withCors(await deleteMusic(env, filename));
      }

      if (url.pathname.startsWith("/music/") && request.method === "GET") {
        const filename = getSafeMp3Filename(url.pathname.slice("/music/".length));
        return await getMusic(request, env, filename);
      }

      return await getAsset(request, env);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unexpected error.";
      return withCors(json({ error: message }, 500));
    }
  },
};

async function getAsset(request: Request, env: Env): Promise<Response> {
  if (!env.ASSETS) {
    return notFound("Not found.");
  }

  const response = await env.ASSETS.fetch(request);

  if (response.status !== 404 || !isPageRequest(request) || !acceptsHtml(request)) {
    return response;
  }

  const indexUrl = new URL(request.url);
  indexUrl.pathname = "/";
  indexUrl.search = "";

  return await env.ASSETS.fetch(new Request(indexUrl, request));
}

async function listCharts(env: Env): Promise<Response> {
  const objects = await listAll(env, CHART_PREFIX);
  const charts = objects
    .filter((object) => object.key.endsWith(".json"))
    .map((object) => ({
      id: object.key.slice(CHART_PREFIX.length, -".json".length),
      key: object.key,
      size: object.size,
      updatedAt: object.uploaded.toISOString(),
    }));

  return json({ charts });
}

async function getChart(env: Env, chartId: string): Promise<Response> {
  const object = await env.RHYTHM_FESTA_BUCKET.get(getChartKey(chartId));

  if (!object) {
    return notFound(`Chart "${chartId}" was not found.`);
  }

  return new Response(object.body, {
    headers: {
      ...JSON_HEADERS,
      "cache-control": "no-store",
    },
  });
}

async function putChart(request: Request, env: Env, chartId: string): Promise<Response> {
  const rawChart = (await request.json()) as ApiChart;
  const chart = validateChart(rawChart);
  const body = `${JSON.stringify(chart, null, 2)}\n`;

  await env.RHYTHM_FESTA_BUCKET.put(getChartKey(chartId), body, {
    httpMetadata: { contentType: "application/json; charset=utf-8" },
  });

  return json({ id: chartId, chart });
}

async function deleteChart(env: Env, chartId: string): Promise<Response> {
  await env.RHYTHM_FESTA_BUCKET.delete(getChartKey(chartId));
  return json({ id: chartId, deleted: true });
}

async function listMusic(env: Env): Promise<Response> {
  const objects = await listAll(env, MUSIC_PREFIX);
  const files = objects
    .filter((object) => object.key.endsWith(".mp3"))
    .map((object) => {
      const filename = object.key.slice(MUSIC_PREFIX.length);

      return {
        filename,
        audioUrl: `/music/${filename}`,
        size: object.size,
        updatedAt: object.uploaded.toISOString(),
      };
    });

  return json({ files });
}

async function uploadMusic(request: Request, env: Env): Promise<Response> {
  const formData = await request.formData();
  const upload = formData.get("file");

  if (!(upload instanceof File)) {
    return badRequest("Upload field \"file\" must be an MP3 file.");
  }

  if (!isAllowedMp3(upload)) {
    return badRequest("Only .mp3 files are supported.");
  }

  if (upload.size > MAX_MP3_BYTES) {
    return badRequest("MP3 file is too large. Maximum size is 50 MB.");
  }

  const filename = createStoredMp3Filename(upload.name);
  await env.RHYTHM_FESTA_BUCKET.put(`${MUSIC_PREFIX}${filename}`, await upload.arrayBuffer(), {
    httpMetadata: { contentType: "audio/mpeg" },
  });

  return json({
    filename,
    audioUrl: `/music/${filename}`,
    size: upload.size,
  });
}

async function deleteMusic(env: Env, filename: string): Promise<Response> {
  await env.RHYTHM_FESTA_BUCKET.delete(`${MUSIC_PREFIX}${filename}`);
  return json({ filename, deleted: true });
}

async function getMusic(request: Request, env: Env, filename: string): Promise<Response> {
  const object = await env.RHYTHM_FESTA_BUCKET.get(`${MUSIC_PREFIX}${filename}`);

  if (!object) {
    return env.ASSETS?.fetch(request) ?? notFound(`Music file "${filename}" was not found.`);
  }

  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set("content-type", headers.get("content-type") ?? "audio/mpeg");
  headers.set("cache-control", "public, max-age=31536000, immutable");

  return new Response(object.body, { headers });
}

async function listAll(env: Env, prefix: string): Promise<R2Object[]> {
  const objects: R2Object[] = [];
  let cursor: string | undefined;

  do {
    const page = await env.RHYTHM_FESTA_BUCKET.list({ prefix, cursor, limit: 1000 });
    objects.push(...page.objects);
    cursor = page.truncated ? page.cursor : undefined;
  } while (cursor);

  return objects;
}

function validateChart(rawChart: ApiChart) {
  if (typeof rawChart.title !== "string" || rawChart.title.trim().length === 0) {
    throw new Error("Chart title must be a non-empty string.");
  }

  if (typeof rawChart.audioUrl !== "string" || rawChart.audioUrl.trim().length === 0) {
    throw new Error("Chart audioUrl must be a non-empty string.");
  }

  if (!Array.isArray(rawChart.notes)) {
    throw new Error("Chart notes must be an array.");
  }

  return {
    title: rawChart.title.trim(),
    artist: typeof rawChart.artist === "string" && rawChart.artist.trim() ? rawChart.artist.trim() : undefined,
    audioUrl: rawChart.audioUrl.trim(),
    sections: Array.isArray(rawChart.sections) ? rawChart.sections.map(validateSection) : undefined,
    notes: rawChart.notes.map(validateNote),
  };
}

function validateSection(rawSection: unknown, index: number) {
  const section = rawSection as ApiSection;

  if (typeof section.name !== "string" || section.name.trim().length === 0) {
    throw new Error(`Section ${index + 1} name must be a non-empty string.`);
  }

  if (!isPositiveInteger(section.startMeasure)) {
    throw new Error(`Section ${index + 1} startMeasure must be a positive integer.`);
  }

  if (!isPositiveInteger(section.endMeasure)) {
    throw new Error(`Section ${index + 1} endMeasure must be a positive integer.`);
  }

  return {
    id: typeof section.id === "string" && section.id.trim() ? section.id.trim() : `section-${index + 1}`,
    name: section.name.trim(),
    startMeasure: section.startMeasure,
    endMeasure: Math.max(section.startMeasure, section.endMeasure),
  };
}

function validateNote(rawNote: unknown, index: number) {
  const note = rawNote as ApiNote;

  if (typeof note.timeMs !== "number" || !Number.isFinite(note.timeMs) || note.timeMs < 0) {
    throw new Error(`Note ${index + 1} timeMs must be a non-negative number.`);
  }

  if (note.team !== "red" && note.team !== "blue") {
    throw new Error(`Note ${index + 1} team must be "red" or "blue".`);
  }

  return {
    id: typeof note.id === "string" && note.id.trim() ? note.id.trim() : `note-${index + 1}`,
    timeMs: note.timeMs,
    team: note.team,
  };
}

function requireAdmin(request: Request, env: Env): Response | null {
  if (!env.ADMIN_TOKEN) {
    return null;
  }

  const authorization = request.headers.get("authorization");

  if (authorization === `Bearer ${env.ADMIN_TOKEN}`) {
    return null;
  }

  return json({ error: "Unauthorized." }, 401);
}

function isAllowedMp3(file: File): boolean {
  const name = file.name.toLowerCase();
  const type = file.type.toLowerCase();

  return (
    name.endsWith(".mp3") &&
    (type === "" || type === "audio/mpeg" || type === "audio/mp3" || type === "application/octet-stream")
  );
}

function createStoredMp3Filename(originalName: string): string {
  const baseName = originalName.replace(/\.[^.]+$/, "");
  const slug = baseName
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  const safeSlug = slug || "music";

  return `${safeSlug}-${Date.now()}.mp3`;
}

function getChartKey(chartId: string): string {
  return `${CHART_PREFIX}${chartId}.json`;
}

function getSafeId(rawId: string): string {
  const id = decodeURIComponent(rawId).trim().toLowerCase();

  if (!/^[a-z0-9][a-z0-9-]{0,63}$/.test(id)) {
    throw new Error("Chart id must use lowercase letters, numbers, and hyphens.");
  }

  return id;
}

function getSafeMp3Filename(rawFilename: string): string {
  const filename = decodeURIComponent(rawFilename).trim();

  if (!/^[a-z0-9][a-z0-9-]{0,127}\.mp3$/.test(filename)) {
    throw new Error("Music filename must be a safe .mp3 filename.");
  }

  return filename;
}

function isPositiveInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 1;
}

function acceptsHtml(request: Request): boolean {
  const accept = request.headers.get("accept");

  return accept === null || accept.includes("text/html");
}

function isPageRequest(request: Request): boolean {
  return request.method === "GET" || request.method === "HEAD";
}

function badRequest(message: string): Response {
  return json({ error: message }, 400);
}

function notFound(message: string): Response {
  return json({ error: message }, 404);
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: JSON_HEADERS,
  });
}

function withCors(response: Response): Response {
  const headers = new Headers(response.headers);

  for (const [key, value] of Object.entries(corsHeaders())) {
    headers.set(key, value);
  }

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

function corsHeaders(): Record<string, string> {
  return {
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "GET, POST, PUT, DELETE, OPTIONS",
    "access-control-allow-headers": "content-type, authorization",
  };
}
