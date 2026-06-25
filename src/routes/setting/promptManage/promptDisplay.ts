import fs from "fs/promises";
import path from "path";

type PromptItemBase = {
  type?: string | null;
  data?: string | null;
  useData?: string | null;
};

type ProjectPromptContext = {
  videoModel?: string | null;
  mode?: string | null;
};

type ResolvePromptDisplayOptions = {
  modelPromptRoot: string;
  project?: ProjectPromptContext | null;
  boundPromptPath?: string | null;
};

function fallbackPromptData(item: PromptItemBase) {
  return item.useData ? item.useData : item.data;
}

export function resolveVideoPromptTemplateFileName(modelName?: string | null, mode?: string | null) {
  const [, modelData = modelName ?? ""] = (modelName ?? "").split(/:(.+)/);
  const modelLower = modelData.toLowerCase();

  if (modelLower.includes("wan") && modelLower.includes("2.6")) {
    return "wan2.6Single-imageFirstFrameMode.md";
  }
  if (/seedance.*2[.\-]0/i.test(modelData)) {
    return "seedance2Multi-parameterMode.md";
  }
  if (mode === "startEndRequired" || mode === "endFrameOptional" || mode === "startFrameOptional") {
    return "universalFirstAndLastFrameMode.md";
  }
  if (typeof mode === "string" && mode.startsWith('["') && mode.endsWith('"]')) {
    return "universalMulti-parameterMode.md";
  }

  return null;
}

async function readModelPrompt(modelPromptRoot: string, relativePath: string) {
  const resolvedRoot = path.resolve(modelPromptRoot);
  const resolvedFile = path.resolve(modelPromptRoot, relativePath);
  if (!resolvedFile.startsWith(resolvedRoot + path.sep)) {
    return null;
  }
  return fs.readFile(resolvedFile, "utf-8");
}

export async function resolvePromptDisplayItem<T extends PromptItemBase>(
  item: T,
  options: ResolvePromptDisplayOptions,
): Promise<T & { data?: string | null; effectivePromptPath?: string }> {
  if (item.type !== "videoPromptGeneration") {
    return {
      ...item,
      data: fallbackPromptData(item),
    };
  }

  const boundPromptPath = options.boundPromptPath ?? null;
  const templatePath =
    boundPromptPath ||
    (() => {
      const fileName = resolveVideoPromptTemplateFileName(options.project?.videoModel, options.project?.mode);
      return fileName ? path.join("video", fileName) : null;
    })();

  if (templatePath) {
    try {
      const data = await readModelPrompt(options.modelPromptRoot, templatePath);
      if (data) {
        return {
          ...item,
          data,
          effectivePromptPath: templatePath.replace(/\\/g, "/"),
        };
      }
    } catch {}
  }

  return {
    ...item,
    data: fallbackPromptData(item),
  };
}
