/**
 * Outbox sync: POST /api/sync, GET /api/expenses — upserts canonical `expenses` rows.
 * Requires auth (cookies). INSERT accepts optional `group_id`; falls back to
 * OFFLINE_SYNC_DEFAULT_GROUP_ID when set. User must be a member of the target group.
 */
import type { NextFunction, Request, Response } from "express";
import { Router } from "express";
import { z } from "zod";
import { pool } from "../../db/pool.js";
import { env } from "../../config/env.js";
import { getAuthenticatedUserId } from "../../middleware/require-auth.js";
import { badRequest } from "../../utils/errors.js";
import { broadcastGroupChange } from "../realtime/realtime-hub.js";

const InsertPayloadSchema = z.object({
  id: z.string().uuid(),
  description: z.string(),
  amount: z.coerce.number(),
  timestamp: z.coerce.number(),
  group_id: z.coerce.number().int().positive().optional(),
});

const DeletePayloadSchema = z.object({
  id: z.string().uuid(),
});

const SyncItemSchema = z.object({
  action: z.enum(["INSERT", "DELETE"]),
  id: z.string(),
  payload: z.unknown(),
});

const SyncBodySchema = z.object({
  items: z.array(SyncItemSchema),
});

async function isGroupMember(userId: number, groupId: number): Promise<boolean> {
  const { rows } = await pool.query<{ ok: number }>(
    `SELECT 1 AS ok FROM group_members WHERE user_id = $1 AND group_id = $2 LIMIT 1`,
    [userId, groupId],
  );
  return rows.length > 0;
}

function parseUserId(req: Request): number {
  const raw = getAuthenticatedUserId(req);
  const id = Number.parseInt(raw, 10);
  if (!Number.isFinite(id)) {
    throw badRequest("Invalid session subject");
  }
  return id;
}

export const offlineSyncRouter: Router = Router();

offlineSyncRouter.post("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = SyncBodySchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid payload" });
      return;
    }

    const userId = parseUserId(req);
    const { items } = parsed.data;
    const successIds: string[] = [];
    const changedGroupIds = new Set<number>();

    for (const item of items) {
      try {
        if (item.action === "INSERT") {
          const payload = InsertPayloadSchema.parse(item.payload);
          const groupId = payload.group_id ?? env.OFFLINE_SYNC_DEFAULT_GROUP_ID;
          if (groupId === undefined) {
            continue;
          }
          if (!(await isGroupMember(userId, groupId))) {
            continue;
          }

          const insertResult = await pool.query<{ expense_id: number }>(
            `INSERT INTO expenses (
               group_id, title_description, total_amount, sale_date, client_expense_uuid
             ) VALUES ($1, $2, $3::numeric(10,2), to_timestamp($4 / 1000.0)::date, $5::uuid)
             ON CONFLICT (client_expense_uuid) DO UPDATE SET
               title_description = EXCLUDED.title_description,
               total_amount = EXCLUDED.total_amount,
               sale_date = EXCLUDED.sale_date,
               group_id = EXCLUDED.group_id,
               updated_at = CURRENT_TIMESTAMP
             WHERE expenses.group_id IN (
               SELECT gm.group_id FROM group_members gm WHERE gm.user_id = $6
             )
             RETURNING expense_id`,
            [
              groupId,
              payload.description,
              payload.amount,
              payload.timestamp,
              payload.id,
              userId,
            ],
          );
          if (insertResult.rows.length === 0) {
            continue;
          }
          changedGroupIds.add(groupId);
        } else {
          const payload = DeletePayloadSchema.parse(item.payload);
          const r = await pool.query<{ group_id: number }>(
            `DELETE FROM expenses e
             USING group_members gm
             WHERE e.client_expense_uuid = $1::uuid
               AND e.group_id = gm.group_id
               AND gm.user_id = $2`,
            [payload.id, userId],
          );
          if (r.rowCount === 0) {
            continue;
          }
          const deletedGroupId = r.rows[0]?.group_id;
          if (deletedGroupId) {
            changedGroupIds.add(deletedGroupId);
          }
        }
        successIds.push(item.id);
      } catch {
        // Skip items that fail validation or authorization (batch continues).
      }
    }

    for (const groupId of changedGroupIds) {
      broadcastGroupChange(groupId);
    }

    res.json({ success: true, successIds });
  } catch (error) {
    next(error);
  }
});

export async function listSyncedExpenses(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const userId = parseUserId(req);

    const result = await pool.query<{
      client_expense_uuid: string | null;
      title_description: string;
      total_amount: string;
      sale_date: string;
    }>(
      `SELECT e.client_expense_uuid, e.title_description, e.total_amount, e.sale_date::text AS sale_date
       FROM expenses e
       INNER JOIN group_members gm ON gm.group_id = e.group_id AND gm.user_id = $1
       WHERE e.client_expense_uuid IS NOT NULL
       ORDER BY e.sale_date DESC, e.expense_id DESC`,
      [userId],
    );

    const rows = result.rows.map((row) => ({
      id: row.client_expense_uuid,
      description: row.title_description,
      amount: Number(row.total_amount),
      timestamp: Math.round(
        new Date(`${row.sale_date}T00:00:00.000Z`).getTime(),
      ),
    }));
    res.json(rows);
  } catch (error) {
    next(error);
  }
}
