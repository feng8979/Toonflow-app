import assert from "assert/strict";
import fs from "fs/promises";
import path from "path";
import { resolvePromptDisplayItem } from "../src/routes/setting/promptManage/promptDisplay";

async function main() {
  const root = process.cwd();
  const templatePath = path.join(root, "data", "modelPrompt", "video", "seedance2Multi-parameterMode.md");
  const expectedTemplate = await fs.readFile(templatePath, "utf-8");

  const prompt = await resolvePromptDisplayItem(
    {
      id: 3,
      type: "videoPromptGeneration",
      name: "video prompt generation",
      data: "generic video prompt fallback",
      useData: "",
    },
    {
      modelPromptRoot: path.join(root, "data", "modelPrompt"),
      project: {
        videoModel: "toonflow:Seedance 2.0",
        mode: '["imageReference:9","videoReference:3","audioReference:3"]',
      },
    },
  );

  assert.equal(prompt.effectivePromptPath, "video/seedance2Multi-parameterMode.md");
  const data = prompt.data;
  if (typeof data !== "string") throw new Error("Expected prompt display data to be a string");
  assert.equal(data, expectedTemplate);
  assert.match(data, /Seedance 2\.0/);
  assert.match(data, /<storyboardItem/);
  assert.match(data, /duration=/);
  assert.match(data, /\{N\}s/);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
