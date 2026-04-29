import { useEffect, useMemo, useState } from "react";
import { X, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { type GroupData, type GroupMember } from "@/hooks/use-groups";

export interface AddGroupData {
  id?: string;
  name: string;
  description: string;
  currency: string;
  imageUrl?: string;
  members: GroupMember[];
  balance?: number;
  createdAt?: string;
}

interface AddGroupModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (group: GroupData) => void;
  initialData?: GroupData;
}

const COMMON_CURRENCIES = ["PHP", "USD", "EUR", "SGD"];

export function AddGroupModal({
  isOpen,
  onClose,
  onSubmit,
  initialData,
}: AddGroupModalProps) {
  const [name, setName] = useState("");
  const [currency, setCurrency] = useState("PHP");
  const [description, setDescription] = useState("");
  const [imageUrl, setImageUrl] = useState<string | undefined>(undefined);
  const [memberName, setMemberName] = useState("");
  const [members, setMembers] = useState<GroupMember[]>([
    { id: "1", name: "You", isAdmin: true },
  ]);
  const [adminId, setAdminId] = useState("1");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isOpen) return;
    if (initialData) {
      setName(initialData.name);
      setCurrency(initialData.currency);
      setDescription(initialData.description);
      setImageUrl(initialData.imageUrl ?? undefined);
      setMembers(initialData.members);
      setAdminId(initialData.members.find((member) => member.isAdmin)?.id ?? initialData.members[0]?.id ?? "1");
      setError("");
    } else {
      setName("");
      setCurrency("PHP");
      setDescription("");
      setImageUrl(undefined);
      setMembers([{ id: "1", name: "You", isAdmin: true }]);
      setAdminId("1");
      setError("");
    }
  }, [isOpen, initialData]);

  const memberList = useMemo(
    () => members.map((member) => ({
      ...member,
      isAdmin: member.id === adminId,
    })),
    [members, adminId],
  );

  const handleAddMember = () => {
    const trimmed = memberName.trim();
    if (!trimmed) return;
    if (members.some((member) => member.name.toLowerCase() === trimmed.toLowerCase())) {
      setError("That member is already added.");
      return;
    }
    const next = {
      id: Math.random().toString(36).slice(2),
      name: trimmed,
      isAdmin: false,
    };
    setMembers((prev) => [...prev, next]);
    setMemberName("");
    setError("");
  };

  const handleRemoveMember = (memberId: string) => {
    setMembers((prev) => prev.filter((member) => member.id !== memberId));
    if (adminId === memberId) {
      setAdminId(members.filter((member) => member.id !== memberId)[0]?.id ?? "");
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError("Group name is required.");
      return;
    }
    if (!currency) {
      setError("Please select a currency.");
      return;
    }
    if (!members.length) {
      setError("Add at least one member.");
      return;
    }

    const group: GroupData = {
      id: initialData?.id ?? `group-${Math.random().toString(36).slice(2)}`,
      name: name.trim(),
      currency,
      description: description.trim(),
      ...(imageUrl ? { imageUrl } : {}),
      members: memberList,
      balance: initialData?.balance ?? 0,
      createdAt: initialData?.createdAt ?? new Date().toISOString(),
    };

    onSubmit(group);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-ink-900/65 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg overflow-hidden rounded-4xl bg-white shadow-2xl">
        <button
          type="button"
          onClick={onClose}
          aria-label="Close group modal"
          className="absolute right-4 top-4 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-white/90 text-ink-900 shadow-sm hover:bg-white"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="relative h-40 bg-slate-900/80">
          <img
            src={imageUrl ?? "https://images.unsplash.com/photo-1518509562904-e7ef99cdcc86?w=1200&q=80"}
            alt="Group cover"
            className="h-full w-full object-cover"
          />
          <div className="absolute inset-0 bg-linear-to-t from-slate-950/90 via-slate-950/10 to-transparent" />
          <div className="absolute left-6 bottom-6 text-white">
            <p className="text-xs uppercase tracking-[0.32em] text-white/70">Add New Group</p>
            <h2 className="mt-2 text-2xl font-semibold">Create your next trip or expense group</h2>
          </div>
        </div>

        <form className="space-y-5 p-6" onSubmit={handleSubmit}>
          {error ? (
            <div className="rounded-2xl border border-danger/20 bg-danger/10 px-4 py-3 text-sm text-danger">
              {error}
            </div>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-1">
              <label htmlFor="group-name" className="mb-2 block text-sm font-semibold text-slate-700">Group name</label>
              <Input
                id="group-name"
                placeholder="Group name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                className="h-12"
              />
            </div>

            <div className="sm:col-span-1">
              <label htmlFor="group-currency" className="mb-2 block text-sm font-semibold text-slate-700">Currency</label>
              <select
                id="group-currency"
                value={currency}
                onChange={(event) => setCurrency(event.target.value)}
                className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm outline-none transition focus:border-slate-400"
              >
                {COMMON_CURRENCIES.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label htmlFor="group-description" className="mb-2 block text-sm font-semibold text-slate-700">Description of expenses</label>
            <textarea
              id="group-description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              rows={4}
              className="w-full rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-slate-400"
              placeholder="Describe your trip or expense purpose"
            />
          </div>

          <div className="space-y-3 rounded-3xl bg-slate-50 p-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-slate-900">Add member</p>
                <p className="text-xs text-slate-500">Invite the people who will share this group.</p>
              </div>
              <div className="flex items-center gap-2">
                <Input
                  placeholder="Member name"
                  aria-label="Member name"
                  value={memberName}
                  onChange={(event) => setMemberName(event.target.value)}
                  className="h-12"
                />
                <Button type="button" variant="secondary" size="sm" onClick={handleAddMember}>
                  <Plus className="h-4 w-4" /> Add
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              {memberList.map((member) => (
                <div key={member.id} className="flex items-center justify-between gap-3 rounded-3xl border border-slate-200 bg-white px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-100 text-sm font-bold text-slate-700">
                      {member.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="font-semibold text-slate-900">{member.name}</p>
                      <p className="text-xs text-slate-500">{member.isAdmin ? "Admin" : "Member"}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-slate-600">
                      <input
                        type="radio"
                        name="admin"
                        checked={adminId === member.id}
                        onChange={() => setAdminId(member.id)}
                        className="h-4 w-4 accent-slate-900"
                      />
                      Assign Admin
                    </label>
                    {members.length > 1 ? (
                      <button
                        type="button"
                        onClick={() => handleRemoveMember(member.id)}
                        aria-label={`Remove ${member.name}`}
                        className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <Button type="submit" size="lg" className="w-full bg-ink-900 text-white hover:bg-ink-800">
            {initialData ? "Save group" : "Create group"}
          </Button>
        </form>
      </div>
    </div>
  );
}
