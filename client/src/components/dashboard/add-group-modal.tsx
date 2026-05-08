import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Plus, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { GroupCoverBackground } from "@/components/dashboard/group-media";
import { cn } from "@/lib/cn";
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

interface GroupFormModalProps extends AddGroupModalProps {
  mode: "create" | "edit";
}

const COMMON_CURRENCIES = ["₱", "USD", "EUR", "SGD"];
const CURRENCY_OPTIONS = COMMON_CURRENCIES.map((option) => ({ label: option, value: option }));
const MAX_GROUP_IMAGE_SIZE_BYTES = 1024 * 1024;

const fileToDataUrl = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
        return;
      }

      reject(new Error("Invalid image result"));
    };
    reader.onerror = () => reject(reader.error ?? new Error("Unable to read image"));
    reader.readAsDataURL(file);
  });

function GroupFormModal({
  isOpen,
  onClose,
  onSubmit,
  initialData,
  mode,
}: GroupFormModalProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [name, setName] = useState("");
  const [currency, setCurrency] = useState("₱");
  const [description, setDescription] = useState("");
  const [imageUrl, setImageUrl] = useState<string | undefined>(undefined);
  const [memberName, setMemberName] = useState("");
  const [members, setMembers] = useState<GroupMember[]>([
    { id: "1", name: "You", isAdmin: true },
  ]);
  const [adminId, setAdminId] = useState("1");
  const [error, setError] = useState("");
  const [isDragActive, setIsDragActive] = useState(false);
  const [isImageUploading, setIsImageUploading] = useState(false);
  const isEditing = mode === "edit";

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
      setCurrency("₱");
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

  const handleImageFile = async (file: File | null | undefined) => {
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setError("Please upload an image file.");
      return;
    }

    if (file.size > MAX_GROUP_IMAGE_SIZE_BYTES) {
      setError("Please choose an image under 1 MB.");
      return;
    }

    setIsImageUploading(true);

    try {
      const nextImageUrl = await fileToDataUrl(file);
      setImageUrl(nextImageUrl);
      setError("");
    } catch {
      setError("We couldn't load that image.");
    } finally {
      setIsImageUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleImageInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    void handleImageFile(event.target.files?.[0]);
  };

  const handleImageDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragActive(false);
    void handleImageFile(event.dataTransfer.files?.[0]);
  };

  const handleUploadZoneKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    if (isImageUploading) return;
    fileInputRef.current?.click();
  };

  const previewName = name.trim() || (isEditing ? initialData?.name ?? "Group" : "New Group");

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
    <div className="fixed inset-0 z-50 flex items-stretch justify-center p-0 sm:items-center sm:p-4">
      <div className="absolute inset-0 bg-ink-900/65 backdrop-blur-sm" onClick={onClose} />
      <div className="relative flex h-full min-h-dvh w-full flex-col overflow-hidden bg-white shadow-2xl sm:h-auto sm:min-h-0 sm:max-h-[calc(100dvh-2rem)] sm:max-w-lg sm:rounded-4xl">
        <div className="absolute left-4 top-4 z-20 flex items-center gap-3 text-white/70">
          <button
            type="button"
            onClick={onClose}
            aria-label={isEditing ? "Close edit group modal" : "Close add group modal"}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full p-2 text-white/80 transition hover:bg-white/10 hover:text-white sm:hidden"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <p className="text-xs font-medium uppercase tracking-[0.32em] text-white/70">
            {isEditing ? "Edit Group" : "Add New Group"}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label={isEditing ? "Close edit group modal" : "Close add group modal"}
          className="absolute right-4 top-4 z-20 hidden h-10 w-10 items-center justify-center rounded-full bg-white/92 text-slate-900 shadow-lg shadow-slate-950/15 transition hover:bg-white sm:inline-flex"
        >
          <X className="h-4 w-4" />
        </button>
        <GroupCoverBackground
          name={previewName}
          imageUrl={imageUrl}
          className="h-48 shrink-0 sm:h-40"
          overlayClassName="bg-linear-to-t from-slate-950/90 via-slate-950/30 to-slate-900/15"
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/jpg,image/webp,image/gif"
            className="hidden"
            onChange={handleImageInputChange}
          />
          <div
            className={cn(
              "absolute inset-x-4 bottom-4 top-16 flex cursor-pointer flex-col rounded-[2rem] border border-dashed border-white/30 bg-black/10 p-4 backdrop-blur-[2px] transition sm:inset-4 sm:top-14 sm:p-5",
              isDragActive && "border-white/80 bg-black/25",
            )}
            role="button"
            tabIndex={0}
            aria-label={imageUrl ? "Replace group cover image" : "Upload group cover image"}
            onClick={() => {
              if (isImageUploading) return;
              fileInputRef.current?.click();
            }}
            onKeyDown={handleUploadZoneKeyDown}
            onDragOver={(event) => {
              event.preventDefault();
              setIsDragActive(true);
            }}
            onDragLeave={() => setIsDragActive(false)}
            onDrop={handleImageDrop}
          >
            <div className="mt-auto flex flex-col gap-3 text-white justify-center">
              <div className="max-w-sm text-white">
                <p className="text-base font-medium leading-tight text-white/95 sm:text-sm">
                  {imageUrl ? "Replace the group cover or drop a new one here." : "Upload a cover image for this group."}
                </p>
                <p className="mt-1 text-xs text-white/70">
                  {imageUrl
                    ? "Click anywhere in this area to replace it."
                    : "Click anywhere in this area or drag an image here."}
                </p>
              </div>
            </div>
          </div>
        </GroupCoverBackground>

        <form className="flex flex-1 flex-col overflow-y-auto px-6 pb-3" onSubmit={handleSubmit}>
          {error ? (
            <div className="rounded-2xl border border-danger/20 bg-danger/10 px-4 py-3 text-sm text-danger">
              {error}
            </div>
          ) : null}

          <div className="mt-5 grid gap-4 sm:grid-cols-2">
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
              <Select
                id="group-currency"
                value={currency}
                onValueChange={setCurrency}
                options={CURRENCY_OPTIONS}
                triggerClassName="border-slate-200 bg-slate-50 text-slate-700 focus:ring-slate-400/20"
                menuClassName="border-slate-200"
              />
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

          <div className="mt-5 space-y-3 rounded-3xl bg-slate-50 p-4">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-semibold text-slate-900">{isEditing ? "Manage members" : "Add member"}</p>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <Input
                  placeholder="Member name"
                  aria-label="Member name"
                  value={memberName}
                  onChange={(event) => setMemberName(event.target.value)}
                  className="h-12 sm:min-w-44"
                />
                <Button type="button" variant="secondary" size="sm" onClick={handleAddMember} className="justify-center">
                  <Plus className="h-4 w-4" /> {isEditing ? "Add member" : "Add"}
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              {memberList.map((member) => (
                <div key={member.id} className="flex flex-col gap-3 rounded-3xl border border-slate-200 bg-white px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-100 text-sm font-bold text-slate-700">
                      {member.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="font-semibold text-slate-900">{member.name}</p>
                      <p className="text-xs text-slate-500">{member.isAdmin ? "Admin" : "Member"}</p>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
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

          <Button type="submit" size="lg" className="mt-5 w-full shrink-0 bg-ink-900 text-white hover:bg-ink-800 sm:mt-6">
            {initialData ? "Save group" : "Create group"}
          </Button>
        </form>
      </div>
    </div>
  );
}

export function AddGroupModal(props: AddGroupModalProps) {
  return <GroupFormModal {...props} mode="create" />;
}

export function EditGroupModal(props: AddGroupModalProps) {
  return <GroupFormModal {...props} mode="edit" />;
}
