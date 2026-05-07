import { Router } from "express";
import { requireAuth } from "../../middleware/require-auth.js";
import { validateBody } from "../../middleware/validate.js";
import { groupsController } from "./groups.controller.js";
import { CreateGroupSchema, JoinGroupSchema, UpdateGroupSchema } from "./groups.schemas.js";

export const groupsRouter: Router = Router();

groupsRouter.use(requireAuth);
groupsRouter.post("/", validateBody(CreateGroupSchema), groupsController.create);
groupsRouter.get("/", groupsController.list);
groupsRouter.get("/:id", groupsController.getById);
groupsRouter.post("/:id/join", validateBody(JoinGroupSchema), groupsController.join);
groupsRouter.put("/:id", validateBody(UpdateGroupSchema), groupsController.update);
groupsRouter.delete("/:id", groupsController.remove);
