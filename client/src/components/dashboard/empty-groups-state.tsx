import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

interface EmptyGroupsStateProps {
  onCreate?: () => void;
}

export function EmptyGroupsState({ onCreate }: EmptyGroupsStateProps) {
  return (
    <Card>
      <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
        <div
          className="grid h-12 w-12 place-items-center rounded-full bg-mint-100 text-ink-900"
          aria-hidden="true"
        >
          <Plus className="h-5 w-5" />
        </div>

        <div>
          <h3 className="text-base font-semibold text-ink-900">
            No groups yet
          </h3>
          <p className="mt-1 max-w-xs text-sm text-ink-500">
            Create your first group to start splitting expenses with friends,
            roommates, or trip buddies.
          </p>
        </div>

        <Button size="md" onClick={onCreate}>
          Create a group
        </Button>
      </CardContent>
    </Card>
  );
}
