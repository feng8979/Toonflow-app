import express from "express";
import u from "@/utils";
import { success, error } from "@/lib/responseFormat";
import { resolvePromptDisplayItem } from "./promptDisplay";

const router = express.Router();

export default router.post("/", async (req, res) => {
  const list = await u.db("o_prompt").select("*");
  const projectId = req.body?.projectId;
  const projectQuery = u.db("o_project").select("id", "videoModel", "mode");
  const project = projectId
    ? await projectQuery.clone().where({ id: projectId }).first()
    : await projectQuery.clone().orderBy("createTime", "desc").first();
  const [vendorId, model] = (project?.videoModel ?? "").split(/:(.+)/);
  const modelPromptData =
    vendorId && model ? await u.db("o_modelPrompt").where("vendorId", vendorId).where("model", model).first() : null;
  const modelPromptRoot = u.getPath(["modelPrompt"]);
  const data = await Promise.all(
    list.map(async (item) => {
      return resolvePromptDisplayItem(item, {
        modelPromptRoot,
        project,
        boundPromptPath: modelPromptData?.path ?? null,
      });
    }),
  );
  res.status(200).send(success(data));
});
