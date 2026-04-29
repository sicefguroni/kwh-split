import { Plus } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { EmptyGroupsState } from "@/components/dashboard/empty-groups-state";
import { GroupCard } from "@/components/dashboard/group-card";
import { AddGroupModal, type AddGroupData } from "@/components/dashboard/add-group-modal";
import { useCurrentUser, useLogoutMutation } from "@/features/auth/use-auth";

const getFirstName = (fullName: string | undefined): string =>
  fullName?.split(" ")[0] ?? "there";

// Mock data for groups
const MOCK_GROUPS = [
  {
    id: "1",
    name: "PADAGAT WHEN",
    description: "Palawan, Philippines",
    imageUrl: "https://images.unsplash.com/photo-1518509562904-e7ef99cdcc86?w=400&q=80",
    balance: 1750.00,
  },
  {
    id: "2",
    name: "Palawan",
    description: "Company outing September 2024",
    balance: -4520.50,
  },
  {
    id: "3",
    name: "Bohol Country",
    description: "Cebu / Bohol / Siquijor Oct 2024",
    imageUrl: "https://images.unsplash.com/photo-1542359649-31e03cd4d909?w=400&q=80",
    balance: 15724.00,
  }
];

export default function DashboardPage() {
  const navigate = useNavigate();
  const { data: user } = useCurrentUser();
  const logout = useLogoutMutation();
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [groups, setGroups] = useState(MOCK_GROUPS);

  const handleLogout = async (): Promise<void> => {
    await logout.mutateAsync();
    navigate("/login", { replace: true });
  };

  const handleAddGroup = (data: AddGroupData) => {
    const newGroup = {
      id: Math.random().toString(36).substring(7),
      name: data.name,
      description: data.description,
      ...(data.imageUrl ? { imageUrl: data.imageUrl } : {}),
      balance: 0,
    };
    setGroups([newGroup, ...groups]);
    setIsAddModalOpen(false);
  };

  return (
    <div className="min-h-[100svh] bg-white">
      <DashboardHeader
        onLogout={handleLogout}
        isLoggingOut={logout.isPending}
      />

      <main className="mx-auto flex max-w-5xl flex-col gap-6 px-4 py-8 sm:px-6 sm:py-10">
        <section className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-ink-900 sm:text-3xl">
              Hello, {getFirstName(user?.name)}
            </h1>
          </div>
          <Button 
            size="md" 
            className="self-start sm:self-auto rounded-full bg-ink-900 px-6 font-semibold shadow-md hover:bg-ink-800"
            onClick={() => setIsAddModalOpen(true)}
          >
            <Plus className="h-4 w-4" />
            Add Group
          </Button>
        </section>

        <section aria-labelledby="groups-heading" className="flex flex-col gap-4 mt-4">
          {groups.length === 0 ? (
            <EmptyGroupsState />
          ) : (
            groups.map((group) => (
              <GroupCard key={group.id} {...group} />
            ))
          )}
        </section>
      </main>

      <AddGroupModal 
        isOpen={isAddModalOpen} 
        onClose={() => setIsAddModalOpen(false)} 
        onSubmit={handleAddGroup} 
      />
    </div>
  );
}
