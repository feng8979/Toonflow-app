export function buildAssetPromptGuard(nameLabel: string, name: string, describe: string): string {
  return [
    "Asset prompt guard:",
    "The visual manual is style guidance only. Do not copy any example subject, scene, name, or story from it.",
    "Generate the final image prompt for exactly the current asset below.",
    `Current asset type: ${nameLabel}`,
    `Current asset name: ${name}`,
    `Current asset description: ${describe}`,
    "The output must preserve the current asset name and core description. If the manual conflicts with the current asset, the current asset wins.",
    "Do not mention unrelated example subjects, cyber streets, neon rain, unrelated characters, or any object not supported by the current asset.",
    "Return only the final image-generation prompt. Do not include analysis, markdown headings, confirmations, or explanations.",
  ].join("\n");
}
