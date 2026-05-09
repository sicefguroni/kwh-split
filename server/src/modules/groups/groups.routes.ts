import { Router } from "express";
import { requireAuth } from "../../middleware/require-auth.js";
import { validateBody } from "../../middleware/validate.js";
import { groupsController } from "./groups.controller.js";
import {
  AcceptInvitationSchema,
  CreateGroupSchema,
  CreateInvitationsSchema,
  JoinGroupSchema,
  UpdateGroupSchema,
} from "./groups.schemas.js";

export const groupsRouter: Router = Router();

// Authenticated routes
const authRouter = Router();
authRouter.use(requireAuth);
authRouter.get("/collaborators/search", groupsController.searchCollaborators);
authRouter.get("/invitations/incoming", groupsController.listIncomingInvitations);
authRouter.get("/notifications", groupsController.listNotifications);
authRouter.post("/notifications/read", groupsController.markNotificationsRead);
authRouter.post("/invitations/:invitationId/accept", groupsController.acceptIncomingInvitation);
authRouter.post("/invitations/:invitationId/decline", groupsController.declineIncomingInvitation);
authRouter.post("/", validateBody(CreateGroupSchema), groupsController.create);
authRouter.get("/", groupsController.list);
authRouter.get("/:id", groupsController.getById);
authRouter.post("/:id/join", validateBody(JoinGroupSchema), groupsController.join);
authRouter.put("/:id", validateBody(UpdateGroupSchema), groupsController.update);
authRouter.delete("/:id", groupsController.remove);

// Invitation routes (authenticated)
authRouter.post("/:id/invite", validateBody(CreateInvitationsSchema), groupsController.createInvitations);
authRouter.get("/:id/invitations", groupsController.listInvitations);
authRouter.get("/:id/invite-link", groupsController.getInviteLink);
authRouter.post("/:id/regenerate-link", groupsController.regenerateInviteLink);

// Invite token routes
groupsRouter.get("/join/:token", groupsController.previewInviteToken);
groupsRouter.post("/join/:token", requireAuth, groupsController.acceptInviteToken);
groupsRouter.post(
  "/accept-invitation",
  requireAuth,
  validateBody(AcceptInvitationSchema),
  groupsController.acceptInvitation,
);

// Mount authenticated routes
groupsRouter.use("/", authRouter);
