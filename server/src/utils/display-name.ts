/**
 * Returns a display name for the actor, appending their email in parentheses
 * when another member in the group shares the same name.
 */
export function displayName(
  actor: { name: string; email: string },
  members: { name: string }[],
): string {
  const sameNameCount = members.filter(
    (m) => m.name.toLowerCase() === actor.name.toLowerCase(),
  ).length;
  return sameNameCount > 1 ? `${actor.name} (${actor.email})` : actor.name;
}
