/**
 * Toonflow AI供应商模板
 * @version 2.0
 */
// ============================================================
// 类型定义
// ============================================================
type VideoMode =
  | "singleImage"
  | "startEndRequired"
  | "endFrameOptional"
  | "startFrameOptional"
  | "text"
  | (`videoReference:${number}` | `imageReference:${number}` | `audioReference:${number}`)[];
interface TextModel {
  name: string;
  modelName: string;
  type: "text";
  think: boolean;
}
interface ImageModel {
  name: string;
  modelName: string;
  type: "image";
  mode: ("text" | "singleImage" | "multiReference")[];
  associationSkills?: string;
}
interface VideoModel {
  name: string;
  modelName: string;
  type: "video";
  mode: VideoMode[];
  associationSkills?: string;
  audio: "optional" | false | true;
  durationResolutionMap: { duration: number[]; resolution: string[] }[];
}
interface TTSModel {
  name: string;
  modelName: string;
  type: "tts";
  voices: { title: string; voice: string }[];
}
interface VendorConfig {
  id: string;
  version: string;
  name: string;
  author: string;
  description?: string;
  icon?: string;
  inputs: { key: string; label: string; type: "text" | "password" | "url"; required: boolean; placeholder?: string }[];
  inputValues: Record<string, string>;
  models: (TextModel | ImageModel | VideoModel | TTSModel)[];
}
type ReferenceList =
  | { type: "image"; sourceType?: "base64"; base64: string }
  | { type: "audio"; sourceType?: "base64"; base64: string }
  | { type: "video"; sourceType?: "base64"; base64: string };
interface ImageConfig {
  prompt: string;
  referenceList?: Extract<ReferenceList, { type: "image" }>[];
  imageBase64?: string[];
  size: "1K" | "2K" | "4K";
  aspectRatio: `${number}:${number}`;
}
interface VideoConfig {
  duration: number;
  resolution: string;
  aspectRatio: "16:9" | "9:16";
  prompt: string;
  imageBase64?: string[];
  audio?: boolean;
  mode: VideoMode[];
}
interface TTSConfig {
  text: string;
  voice: string;
  speechRate: number;
  pitchRate: number;
  volume: number;
}
interface PollResult {
  completed: boolean;
  data?: string;
  error?: string;
}
// ============================================================
// 全局声明
// ============================================================
declare const axios: any;
declare const logger: (msg: string) => void;
declare const jsonwebtoken: any;
declare const zipImage: (base64: string, size: number) => Promise<string>;
declare const zipImageResolution: (base64: string, w: number, h: number) => Promise<string>;
declare const mergeImages: (base64Arr: string[], maxSize?: string) => Promise<string>;
declare const urlToBase64: (url: string) => Promise<string>;
declare const pollTask: (fn: () => Promise<PollResult>, interval?: number, timeout?: number) => Promise<PollResult>;
declare const createOpenAI: any;
declare const createDeepSeek: any;
declare const createZhipu: any;
declare const createQwen: any;
declare const createAnthropic: any;
declare const createOpenAICompatible: any;
declare const createXai: any;
declare const createMinimax: any;
declare const createGoogleGenerativeAI: any;
declare const exports: {
  vendor: VendorConfig;
  textRequest: (m: TextModel, t: boolean, tl: 0 | 1 | 2 | 3) => any;
  imageRequest: (c: ImageConfig, m: ImageModel) => Promise<string>;
  videoRequest: (c: VideoConfig, m: VideoModel) => Promise<string>;
  ttsRequest: (c: TTSConfig, m: TTSModel) => Promise<string>;
  checkForUpdates?: () => Promise<{ hasUpdate: boolean; latestVersion: string; notice: string }>;
  updateVendor?: () => Promise<string>;
};
// ============================================================
// 供应商配置
// ============================================================
const vendor: VendorConfig = {
  id: "openai",
  version: "2.0",
  author: "Toonflow",
  name: "OpenAI标准接口",
  description: "OpenAI标准格式接口，可修改请求地址并手动添加模型。",
  icon: "",
  inputs: [
    { key: "apiKey", label: "API密钥", type: "password", required: true },
    { key: "baseUrl", label: "请求地址", type: "url", required: true, placeholder: "以v1结束，示例：https://api.openai.com/v1" },
  ],
  inputValues: {
    apiKey: "",
    baseUrl: "https://api.openai.com/v1",
  },
  models: [
    { name: "GPT-4o", modelName: "gpt-4o", type: "text", think: false },
    { name: "GPT-4.1", modelName: "gpt-4.1", type: "text", think: false },
    { name: "GPT-5.1", modelName: "gpt-5.1", type: "text", think: false },
    { name: "GPT-5.2", modelName: "gpt-5.2", type: "text", think: false },
    { name: "GPT-5.4", modelName: "gpt-5.4", type: "text", think: false },
  ],
};
// ============================================================
// 适配器函数
// ============================================================
const getBaseUrl = () => {
  if (!vendor.inputValues.baseUrl) throw new Error("Missing OpenAI-compatible baseUrl");
  return vendor.inputValues.baseUrl.replace(/\/+$/, "");
};

const getApiKey = () => {
  if (!vendor.inputValues.apiKey) throw new Error("Missing API Key");
  return vendor.inputValues.apiKey.replace(/^Bearer\s+/i, "");
};

const getHeaders = () => ({
  "Content-Type": "application/json",
  Authorization: `Bearer ${getApiKey()}`,
});

const readByPath = (obj: any, path: string): any => {
  if (!obj || !path) return undefined;
  const normalizedPath = path.replace(/\[(\d+)\]/g, ".$1");
  return normalizedPath.split(".").reduce((acc, key) => (acc == null ? undefined : acc[key]), obj);
};

const pickFirstPath = (obj: any, paths: string[]): any => {
  for (const path of paths) {
    const value = readByPath(obj, path);
    if (value !== undefined && value !== null && value !== "") return value;
  }
  return undefined;
};

const extractB64 = (data: any): string | undefined => {
  return pickFirstPath(data, ["b64_json", "image", "data.b64_json", "data.image", "data.0.b64_json", "data[0].b64_json"]);
};

const extractUrl = (data: any): string | undefined => {
  return pickFirstPath(data, ["url", "image_url", "data.url", "data.image_url", "data.0.url", "data[0].url", "output.url"]);
};

const extractError = (data: any): string | undefined => {
  return pickFirstPath(data, ["error.message", "message", "msg", "data.error.message", "data.message"]);
};

const ensureImageDataUrl = (value: string): string => {
  const trimmed = value.trim();
  if (trimmed.startsWith("data:")) return trimmed;
  return `data:image/png;base64,${trimmed}`;
};

const resolveOpenAIImageSize = (aspectRatio: string): string => {
  const [w, h] = aspectRatio.split(":").map(Number);
  if (!Number.isFinite(w) || !Number.isFinite(h) || w === h) return "1024x1024";
  return w > h ? "1536x1024" : "1024x1536";
};

const fetchWithTimeout = async (url: string, options: RequestInit, timeoutMs = 600000): Promise<Response> => {
  if (typeof AbortController === "undefined" || typeof setTimeout === "undefined" || typeof clearTimeout === "undefined") {
    return await fetch(url, options);
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } catch (err: any) {
    if (err?.name === "AbortError") {
      throw new Error(`Image generation request timed out after ${Math.round(timeoutMs / 1000)}s`);
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
};

const textRequest = (model: TextModel, think: boolean, thinkLevel: 0 | 1 | 2 | 3) => {
  const effortMap: Record<0 | 1 | 2 | 3, "low" | "medium" | "high" | "xhigh"> = {
    0: "low",
    1: "medium",
    2: "high",
    3: "xhigh",
  };
  const reasoningEffort = effortMap[thinkLevel];
  const enableReasoning = !!model.think;

  return createOpenAICompatible({
    name: "openai-compatible",
    baseURL: getBaseUrl(),
    apiKey: getApiKey(),
    fetch: async (url: string, options?: RequestInit) => {
      const rawBody = JSON.parse((options?.body as string) ?? "{}");
      const body = enableReasoning
        ? {
            ...rawBody,
            reasoning_effort: reasoningEffort,
          }
        : rawBody;
      return await fetch(url, {
        ...options,
        body: JSON.stringify(body),
      });
    },
  }).chatModel(model.modelName);
};

const imageRequest = async (config: ImageConfig, model: ImageModel): Promise<string> => {
  const imageRefs = [
    ...(config.referenceList || []).map((ref) => ref.base64),
    ...(config.imageBase64 || []),
  ].filter(Boolean);

  const body: any = {
    model: model.modelName,
    prompt: config.prompt || "",
    n: 1,
    size: resolveOpenAIImageSize(config.aspectRatio || "1:1"),
    response_format: "b64_json",
  };

  if (imageRefs.length > 0) {
    body.images = imageRefs;
  }

  logger(`[OpenAI-compatible image] model=${model.modelName}, size=${body.size}, refs=${imageRefs.length}`);
  const res = await fetchWithTimeout(`${getBaseUrl()}/images/generations`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Image generation request failed: ${errorText}`);
  }

  const response = await res.json();
  const errorMessage = extractError(response);
  if (response?.error || errorMessage) {
    throw new Error(`Image generation failed: ${errorMessage || response.error?.code || "unknown error"}`);
  }

  const b64 = extractB64(response);
  if (b64) return ensureImageDataUrl(b64);

  const url = extractUrl(response);
  if (url) {
    if (url.startsWith("data:")) return url;
    return await urlToBase64(url);
  }

  throw new Error(`Image generation failed: no image data returned. Response: ${JSON.stringify(response).slice(0, 500)}`);
};
const videoRequest = async (config: VideoConfig, model: VideoModel): Promise<string> => {
  return "";
};
const ttsRequest = async (config: TTSConfig, model: TTSModel): Promise<string> => {
  return "";
};
const checkForUpdates = async (): Promise<{ hasUpdate: boolean; latestVersion: string; notice: string }> => {
  return { hasUpdate: false, latestVersion: "2.0", notice: "" };
};
const updateVendor = async (): Promise<string> => {
  return "";
};
// ============================================================
// 导出
// ============================================================
exports.vendor = vendor;
exports.textRequest = textRequest;
exports.imageRequest = imageRequest;
exports.videoRequest = videoRequest;
exports.ttsRequest = ttsRequest;
exports.checkForUpdates = checkForUpdates;
exports.updateVendor = updateVendor;
export {};
