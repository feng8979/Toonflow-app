import assert from "node:assert/strict";
import fs from "node:fs";
import { transform } from "sucrase";
import { VM } from "vm2";

type FetchCall = {
  url: string;
  body: any;
};

function loadOpenAiVendor(fetchImpl: (url: string, options?: any) => Promise<any>) {
  const code = fs.readFileSync("data/vendor/openai.ts", "utf8").replace(/export\s*\{\s*\};?/g, "");
  const jsCode = transform(code, { transforms: ["typescript"] }).code;
  const exports: Record<string, any> = {};
  const sandbox = {
    exports,
    logger: () => {},
    urlToBase64: async (url: string) => `data:image/png;base64,from-url:${url}`,
    fetch: fetchImpl,
    createOpenAI: () => {
      throw new Error("createOpenAI should not be used for the OpenAI-compatible vendor");
    },
    createOpenAICompatible: ({ name, baseURL, apiKey, fetch }: any) => ({
      chatModel: (modelName: string) => ({ provider: name, baseURL, apiKey, modelName, fetch }),
    }),
  };
  new VM({ sandbox, timeout: 1000, eval: false, wasm: false }).run(jsCode);
  exports.vendor.inputValues.apiKey = "sk-test";
  exports.vendor.inputValues.baseUrl = "http://example.test/v1///";
  return exports;
}

async function main() {
  const calls: FetchCall[] = [];
  const vendor = loadOpenAiVendor(async (url: string, options?: any) => {
    calls.push({ url, body: JSON.parse(options?.body ?? "{}") });
    return {
      ok: true,
      json: async () => ({ data: [{ b64_json: "aW1hZ2UtYnl0ZXM=" }] }),
    };
  });

  const reasoningCases = [
    { label: "关闭思考", think: false, thinkLevel: 0, expected: "low" },
    { label: "轻度思考", think: true, thinkLevel: 1, expected: "medium" },
    { label: "深度思考", think: true, thinkLevel: 2, expected: "high" },
    { label: "极致思考", think: true, thinkLevel: 3, expected: "xhigh" },
  ] as const;

  for (const item of reasoningCases) {
    const textModel = vendor.textRequest({ modelName: "gpt-5.5", type: "text", think: true }, item.think, item.thinkLevel);
    assert.equal(textModel.provider, "openai-compatible");
    assert.equal(textModel.baseURL, "http://example.test/v1");
    assert.equal(textModel.modelName, "gpt-5.5");
    await textModel.fetch("http://example.test/v1/chat/completions", {
      body: JSON.stringify({ model: "gpt-5.5", label: item.label }),
    });
    assert.equal(calls.at(-1)?.body.reasoning_effort, item.expected, item.label);
  }

  const result = await vendor.imageRequest(
    { prompt: "draw a teak boat deck", referenceList: [], size: "1K", aspectRatio: "16:9" },
    { modelName: "gpt-image-2", type: "image", mode: ["text"] },
  );

  assert.equal(calls.length, 5);
  assert.equal(calls[4].url, "http://example.test/v1/images/generations");
  assert.equal(calls[4].body.model, "gpt-image-2");
  assert.equal(calls[4].body.prompt, "draw a teak boat deck");
  assert.equal(calls[4].body.size, "1536x1024");
  assert.match(result, /^data:image\/png;base64,aW1hZ2UtYnl0ZXM=$/);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
