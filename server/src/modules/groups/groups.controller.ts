import type { NextFunction, Request, Response } from "express";
import { getAuthenticatedUserId } from "../../middleware/require-auth.js";
import { parsePositiveInt, parseSubjectUserId } from "../common/authorization.js";
import { groupsService } from "./groups.service.js";
import type { CreateGroupInput, JoinGroupInput, UpdateGroupInput, InviteByEmailInput, AcceptInvitationInput } from "./groups.schemas.js";

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

  // Invitation methods
  async inviteByEmail(
    req: TypedBody<InviteByEmailInput> & Request<{ id: string }>,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const inviterId = parseSubjectUserId(getAuthenticatedUserId(req));
      const groupId = parsePositiveInt(req.params.id ?? "", "id");
      const invitation = await groupsService.inviteByEmail(groupId, inviterId, req.body.email);
      res.status(201).json({ invitation });
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

  // Public routes (no auth required)
  async acceptInvitation(req: TypedBody<AcceptInvitationInput>, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = parseSubjectUserId(getAuthenticatedUserId(req));
      const { group, wasNewMember } = await groupsService.acceptInvitation(req.body.token, userId);
      res.status(200).json({ group, wasNewMember });
    } catch (error) {
      next(error);
    }
  },

  async joinViaPublicLink(req: Request<{ token: string }>, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = parseSubjectUserId(getAuthenticatedUserId(req));
      const { group, wasNewMember } = await groupsService.joinViaPublicLink(req.params.token, userId);
      res.status(200).json({ group, wasNewMember });
    } catch (error) {
      next(error);
    }
  },
};
