import { pool } from "../../db/pool.js";
import { badRequest, unauthorized } from "../../utils/errors.js";

export const parseSubjectUserId = (subject: string): number => {
  const userId = Number.parseInt(subject, 10);
  if (!Number.isInteger(userId) || userId <= 0) {
    throw unauthorized("Invalid session");
  }
  return userId;
};

export const parsePositiveInt = (
  value: string | string[] | undefined,
  fieldName: string,
): number => {
  const raw = Array.isArray(value) ? value[0] : value;
  const parsed = Number.parseInt(raw ?? "", 10);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw badRequest(`${fieldName} must be a positive integer`, "validation_error");
  }
  return parsed;
};

export const assertGroupMember = async (userId: number, groupId: number): Promise<void> => {
  const { rows } = await pool.query<{ ok: number }>(
    `SELECT 1 AS ok FROM group_members WHERE user_id = $1 AND group_id = $2 LIMIT 1`,
    [userId, groupId],
  );
  if (rows.length === 0) {
    throw unauthorized("You are not a member of this group");
  }
};
