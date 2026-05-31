import type { Chart } from "./chart";

export const ADMIN_TOKEN_STORAGE_KEY = "rhythm-festa-admin-token";

export type UploadedMusic = {
  filename: string;
  audioUrl: string;
  size: number;
};

export async function saveChartToCloud(chartId: string, chart: Chart, adminToken: string): Promise<void> {
  const response = await fetch(`/api/charts/${encodeURIComponent(chartId)}`, {
    method: "PUT",
    headers: createJsonHeaders(adminToken),
    body: JSON.stringify(chart),
  });

  if (!response.ok) {
    throw new Error(await getApiErrorMessage(response, "Failed to save chart."));
  }
}

export async function deleteChartFromCloud(chartId: string, adminToken: string): Promise<void> {
  const response = await fetch(`/api/charts/${encodeURIComponent(chartId)}`, {
    method: "DELETE",
    headers: createAuthHeaders(adminToken),
  });

  if (!response.ok) {
    throw new Error(await getApiErrorMessage(response, "Failed to delete chart."));
  }
}

export async function uploadMusicToCloud(file: File, adminToken: string): Promise<UploadedMusic> {
  const formData = new FormData();
  formData.set("file", file);

  const response = await fetch("/api/music", {
    method: "POST",
    headers: createAuthHeaders(adminToken),
    body: formData,
  });

  if (!response.ok) {
    throw new Error(await getApiErrorMessage(response, "Failed to upload MP3."));
  }

  return (await response.json()) as UploadedMusic;
}

function createJsonHeaders(adminToken: string): HeadersInit {
  return {
    ...createAuthHeaders(adminToken),
    "content-type": "application/json",
  };
}

function createAuthHeaders(adminToken: string): HeadersInit {
  return adminToken.trim() ? { authorization: `Bearer ${adminToken.trim()}` } : {};
}

async function getApiErrorMessage(response: Response, fallback: string): Promise<string> {
  try {
    const body = (await response.json()) as { error?: unknown };

    if (typeof body.error === "string" && body.error.length > 0) {
      return body.error;
    }
  } catch {
    // Non-JSON error responses can happen when the Cloudflare Worker is not running locally.
  }

  return `${fallback} (${response.status})`;
}
