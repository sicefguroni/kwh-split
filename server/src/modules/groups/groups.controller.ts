import type { NextFunction, Request, Response } from "express";
import { getAuthenticatedUserId } from "../../middleware/require-auth.js";
import { parsePositiveInt, parseSubjectUserId } from "../common/authorization.js";
import { groupsService } from "./groups.service.js";
import type {
  AcceptInvitationInput,
  CreateGroupInput,
  CreateInvitationsInput,
  JoinGroupInput,
  UpdateGroupInput,
} from "./groups.schemas.js";

type TypedBody<T> = Request<Record<string, string>, unknown, T>;

export const groupsController = {
  async create(req: TypedBody<CreateGroupInput>, res: Response, next: NextFunction): Promise<void> {
    try {
      const ownerUserId = parseSubjectUserId(getAuthenticatedUserId(req));
      const group = await groupsService.create(ownerUserId, req.body);
      res.status(201).json({ group });
    } catch (error) {
      next(error);
    }
  },

  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = parseSubjectUserId(getAuthenticatedUserId(req));
      const groups = await groupsService.listForUser(userId);
      res.status(200).json({ groups });
    } catch (error) {
      next(error);
    }
  },

  async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = parseSubjectUserId(getAuthenticatedUserId(req));
      const groupId = parsePositiveInt(req.params.id ?? "", "id");
      const group = await groupsService.getByIdForUser(groupId, userId);
      res.status(200).json({ group });
    } catch (error) {
      next(error);
    }
  },

  async searchCollaborators(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = parseSubjectUserId(getAuthenticatedUserId(req));
      const query = typeof req.query.q === "string" ? req.query.q : "";
      const excludeGroupIdRaw = typeof req.query.excludeGroupId === "string" ? req.query.excludeGroupId : undefined;
      const excludeGroupId =
        excludeGroupIdRaw && excludeGroupIdRaw.length > 0
          ? parsePositiveInt(excludeGroupIdRaw, "excludeGroupId")
          : undefined;
      const collaborators = await groupsService.searchCollaborators(userId, query, excludeGroupId);
      res.status(200).json({ collaborators });
    } catch (error) {
      next(error);
    }
  },

  async join(
    req: TypedBody<JoinGroupInput> & Request<{ id: string }>,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const requesterId = parseSubjectUserId(getAuthenticatedUserId(req));
      const groupId = parsePositiveInt(req.params.id ?? "", "id");
      await groupsService.join(groupId, requesterId, req.body);
      res.status(204).end();
    } catch (error) {
      next(error);
    }
  },

  async update(
    req: TypedBody<UpdateGroupInput> & Request<{ id: string }>,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const requesterId = parseSubjectUserId(getAuthenticatedUserId(req));
      const groupId = parsePositiveInt(req.params.id ?? "", "id");
      const group = await groupsService.update(groupId, requesterId, req.body);
      res.status(200).json({ group });
    } catch (error) {
      next(error);
    }
  },

  async remove(req: Request<{ id: string }>, res: Response, next: NextFunction): Promise<void> {
    try {
      const requesterId = parseSubjectUserId(getAuthenticatedUserId(req));
      const groupId = parsePositiveInt(req.params.id ?? "", "id");
      await groupsService.remove(groupId, requesterId);
      res.status(204).end();
    } catch (error) {
      next(error);
    }
  },

  async leave(req: Request<{ id: string }>, res: Response, next: NextFunction): Promise<void> {
    try {
      const requesterId = parseSubjectUserId(getAuthenticatedUserId(req));
      const groupId = parsePositiveInt(req.params.id ?? "", "id");
      const body = req.body as { newAdminUserId?: number } | undefined;
      const newAdminUserId =
        body?.newAdminUserId !== undefined ? Number(body.newAdminUserId) : undefined;
      await groupsService.leaveGroup(groupId, requesterId, newAdminUserId);
      res.status(204).end();
    } catch (error) {
      next(error);
    }
  },

  async promoteToAdmin(req: Request<{ id: string }>, res: Response, next: NextFunction): Promise<void> {
    try {
      const requesterId = parseSubjectUserId(getAuthenticatedUserId(req));
      const groupId = parsePositiveInt(req.params.id ?? "", "id");
      const body = req.body as { targetUserId?: number } | undefined;
      const targetUserId = Number(body?.targetUserId);
      if (!Number.isInteger(targetUserId) || targetUserId <= 0) {
        res.status(400).json({ error: "targetUserId is required" });
        return;
      }
      await groupsService.promoteToAdmin(groupId, requesterId, targetUserId);
      res.status(204).end();
    } catch (error) {
      next(error);
    }
  },

  async createInvitations(
    req: TypedBody<CreateInvitationsInput> & Request<{ id: string }>,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const inviterId = parseSubjectUserId(getAuthenticatedUserId(req));
      const groupId = parsePositiveInt(req.params.id ?? "", "id");
      const result = await groupsService.createInvitations(groupId, inviterId, req.body);
      res.status(201).json(result);
    } catch (error) {
      next(error);
    }
  },

  async listInvitations(req: Request<{ id: string }>, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = parseSubjectUserId(getAuthenticatedUserId(req));
      const groupId = parsePositiveInt(req.params.id ?? "", "id");
      const invitations = await groupsService.listInvitations(groupId, userId);
      res.status(200).json({ invitations });
    } catch (error) {
      next(error);
    }
  },

  async listIncomingInvitations(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = parseSubjectUserId(getAuthenticatedUserId(req));
      const invitations = await groupsService.listIncomingInvitations(userId);
      res.status(200).json({ invitations });
    } catch (error) {
      next(error);
    }
  },

  async listNotifications(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = parseSubjectUserId(getAuthenticatedUserId(req));
      const notifications = await groupsService.listNotifications(userId);
      res.status(200).json({ notifications });
    } catch (error) {
      next(error);
    }
  },

  async markNotificationsRead(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = parseSubjectUserId(getAuthenticatedUserId(req));
      await groupsService.markNotificationsRead(userId);
      res.status(204).end();
    } catch (error) {
      next(error);
    }
  },

  async clearNotifications(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = parseSubjectUserId(getAuthenticatedUserId(req));
      const category = req.query.category as "invitations" | "activity" | undefined;
      await groupsService.clearNotifications(userId, category);
      res.status(204).end();
    } catch (error) {
      next(error);
    }
  },

  async acceptIncomingInvitation(
    req: Request<{ invitationId: string }>,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const userId = parseSubjectUserId(getAuthenticatedUserId(req));
      const invitationId = parsePositiveInt(req.params.invitationId ?? "", "invitationId");
      const result = await groupsService.acceptIncomingInvitation(invitationId, userId);
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  },

  async declineIncomingInvitation(
    req: Request<{ invitationId: string }>,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const userId = parseSubjectUserId(getAuthenticatedUserId(req));
      const invitationId = parsePositiveInt(req.params.invitationId ?? "", "invitationId");
      await groupsService.declineIncomingInvitation(invitationId, userId);
      res.status(204).end();
    } catch (error) {
      next(error);
    }
  },

  async getInviteLink(req: Request<{ id: string }>, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = parseSubjectUserId(getAuthenticatedUserId(req));
      const groupId = parsePositiveInt(req.params.id ?? "", "id");
      const inviteToken = await groupsService.getPublicInviteLink(groupId, userId);
      res.status(200).json({ inviteToken });
    } catch (error) {
      next(error);
    }
  },

  async regenerateInviteLink(req: Request<{ id: string }>, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = parseSubjectUserId(getAuthenticatedUserId(req));
      const groupId = parsePositiveInt(req.params.id ?? "", "id");
      const newToken = await groupsService.regenerateInviteLink(groupId, userId);
      res.status(200).json({ inviteToken: newToken });
    } catch (error) {
      next(error);
    }
  },

  async previewInviteToken(req: Request<{ token: string }>, res: Response, next: NextFunction): Promise<void> {
    try {
      const invite = await groupsService.previewInviteToken(req.params.token);
      res.status(200).json({ invite });
    } catch (error) {
      next(error);
    }
  },

  async acceptInviteToken(req: Request<{ token: string }>, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = parseSubjectUserId(getAuthenticatedUserId(req));
      const result = await groupsService.acceptInviteToken(req.params.token, userId);
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  },

  async acceptInvitation(req: TypedBody<AcceptInvitationInput>, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = parseSubjectUserId(getAuthenticatedUserId(req));
      const result = await groupsService.acceptInvitation(req.body.token, userId);
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  },

};
