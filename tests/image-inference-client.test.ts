import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { IMAGE_EMBEDDING_DIM } from "../lib/ai/image-embedding-model";
import {
  getImageEmbeddingViaService,
  ImageInferenceError,
} from "../lib/ai/image-inference-client";

const URL = "https://inference.example.com";
const TOKEN = "test-secret";

function embeddingResponse(overrides = {}) {
  return {
    embedding: Array.from({ length: IMAGE_EMBEDDING_DIM }, (_, i) => (i + 1) / 1000),
    model: "Xenova/clip-vit-base-patch32",
    dim: IMAGE_EMBEDDING_DIM,
    ...overrides,
  };
}

function mockFetchOnce(response: Partial<Response> & { jsonValue?: unknown }) {
  const json = async () => {
    if ("jsonError" in response && response.jsonError) throw response.jsonError;
    return response.jsonValue;
  };
  return vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
    ok: response.ok ?? true,
    status: response.status ?? 200,
    json,
  } as Response);
}

beforeEach(() => {
  process.env.IMAGE_SEARCH_SERVICE_URL = URL;
  process.env.IMAGE_SEARCH_SERVICE_TOKEN = TOKEN;
  vi.restoreAllMocks();
});

afterEach(() => {
  delete process.env.IMAGE_SEARCH_SERVICE_URL;
  delete process.env.IMAGE_SEARCH_SERVICE_TOKEN;
  vi.restoreAllMocks();
});

describe("getImageEmbeddingViaService", () => {
  it("returns the embedding on success and sends bearer auth", async () => {
    const spy = mockFetchOnce({ ok: true, status: 200, jsonValue: embeddingResponse() });

    const embedding = await getImageEmbeddingViaService(new Blob(["bytes"]));

    expect(embedding).toHaveLength(IMAGE_EMBEDDING_DIM);
    const [, init] = spy.mock.calls[0];
    expect((init?.headers as Record<string, string>).authorization).toBe(
      `Bearer ${TOKEN}`,
    );
  });

  it("throws config when env is missing", async () => {
    delete process.env.IMAGE_SEARCH_SERVICE_URL;
    await expect(getImageEmbeddingViaService(new Blob(["x"]))).rejects.toMatchObject({
      code: "config",
    });
  });

  it("maps inference timeout to unavailable", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValueOnce(new DOMException("timeout", "TimeoutError"));
    await expect(getImageEmbeddingViaService(new Blob(["x"]))).rejects.toMatchObject({
      code: "unavailable",
    });
  });

  it("maps 4xx from the service to rejected", async () => {
    mockFetchOnce({ ok: false, status: 422, jsonValue: {} });
    await expect(getImageEmbeddingViaService(new Blob(["x"]))).rejects.toMatchObject({
      code: "rejected",
    });
  });

  it("maps 5xx from the service to unavailable", async () => {
    mockFetchOnce({ ok: false, status: 500, jsonValue: {} });
    await expect(getImageEmbeddingViaService(new Blob(["x"]))).rejects.toMatchObject({
      code: "unavailable",
    });
  });

  it("rejects an invalid embedding shape", async () => {
    mockFetchOnce({ ok: true, status: 200, jsonValue: embeddingResponse({ embedding: [1, 2, 3] }) });
    await expect(getImageEmbeddingViaService(new Blob(["x"]))).rejects.toMatchObject({
      code: "invalid",
    });
  });

  it("rejects a model mismatch", async () => {
    mockFetchOnce({ ok: true, status: 200, jsonValue: embeddingResponse({ model: "other" }) });
    await expect(getImageEmbeddingViaService(new Blob(["x"]))).rejects.toMatchObject({
      code: "invalid",
    });
  });

  it("maps 401 to unauthorized", async () => {
    mockFetchOnce({ ok: false, status: 401, jsonValue: {} });
    const err = await getImageEmbeddingViaService(new Blob(["x"])).catch((e) => e);
    expect(err).toBeInstanceOf(ImageInferenceError);
    expect(err.code).toBe("unauthorized");
  });
});
