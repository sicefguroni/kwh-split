import { Router } from "express";
import { requireAuth } from "../../middleware/require-auth.js";
import { validateBody } from "../../middleware/validate.js";
import { groupsController } from "./groups.controller.js";
import { CreateGroupSchema, JoinGroupSchema, UpdateGroupSchema, InviteByEmailSchema, AcceptInvitationSchema } from "./groups.schemas.js";

export const groupsRouter: Router = Router();

// Authenticated routes
const authRouter = Router();
authRouter.use(requireAuth);
authRouter.post("/", validateBody(CreateGroupSchema), groupsController.create);
authRouter.get("/", groupsController.list);
authRouter.get("/:id", groupsController.getById);
authRouter.post("/:id/join", validateBody(JoinGroupSchema), groupsController.join);
authRouter.put("/:id", validateBody(UpdateGroupSchema), groupsController.update);
authRouter.delete("/:id", groupsController.remove);

// Invitation routes (authenticated)
authRouter.post("/:id/invite", validateBody(InviteByEmailSchema), groupsController.inviteByEmail);
authRouter.get("/:id/invitations", groupsController.listInvitations);
authRouter.get("/:id/invite-link", groupsController.getInviteLink);
authRouter.post("/:id/regenerate-link", groupsController.regenerateInviteLink);

// Public routes (no auth required)
groupsRouter.post("/accept-invitation", validateBody(AcceptInvitationSchema), groupsController.acceptInvitation);
groupsRouter.get("/join/:token", groupsController.joinViaPublicLink);

// Mount authenticated routes
groupsRouter.use("/", authRouter);
