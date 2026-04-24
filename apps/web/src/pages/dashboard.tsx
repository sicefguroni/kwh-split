import { Plus } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { EmptyGroupsState } from "@/components/dashboard/empty-groups-state";
import { useCurrentUser, useLogoutMutation } from "@/features/auth/use-auth";

const getFirstName = (fullName: string | undefined): string =>
  fullName?.split(" ")[0] ?? "there";

export default function DashboardPage() {
  const navigate = useNavigate();
  const { data: user } = useCurrentUser();
  const logout = useLogoutMutation();

  const handleLogout = async (): Promise<void> => {
    await logout.mutateAsync();
    navigate("/login", { replace: true });
  };

  return (
    <div className="min-h-[100svh]">
      <DashboardHeader
        onLogout={handleLogout}
        isLoggingOut={logout.isPending}
      />

      <main className="mx-auto flex max-w-5xl flex-col gap-6 px-4 py-8 sm:px-6 sm:py-10">
        <section className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm text-ink-500">Welcome back</p>
            <h1 className="text-2xl font-semibold text-ink-900 sm:text-3xl">
              Hello, {getFirstName(user?.name)}
            </h1>
          </div>
          <Button size="md" className="self-start sm:self-auto" disabled>
            <Plus className="h-4 w-4" />
            New group
          </Button>
        </section>

        <section aria-labelledby="groups-heading" className="flex flex-col gap-3">
          <h2
            id="groups-heading"
            className="text-sm font-medium uppercase tracking-wide text-ink-400"
          >
            Your groups
          </h2>
          <EmptyGroupsState />
        </section>
      </main>
    </div>
  );
}
