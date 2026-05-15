import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, ImageMinus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { GroupCoverBackground } from "@/components/dashboard/group-media";
import {
  InviteRecipientPicker,
  type InviteRecipientDraft,
} from "@/components/dashboard/invite-recipient-picker";
import type { GroupData } from "@/hooks/use-groups";
import { ApiError } from "@/lib/api-client";
import { cn } from "@/lib/cn";

export interface GroupFormSubmission {
  id?: string | undefined;
  name: string;
  description: string;
  currency: string;
  imageUrl?: string | undefined;
  inviteRecipients: InviteRecipientDraft[];
}

interface AddGroupModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (group: GroupFormSubmission) => Promise<void> | void;
  initialData?: GroupData;
  isSubmitting?: boolean;
}

interface GroupFormModalProps extends AddGroupModalProps {
  mode: "create" | "edit";
}

const CURRENCY_OPTIONS = [
  { label: "Philippine Peso (₱)", value: "₱" },
  { label: "US Dollar (USD)", value: "USD" },
  { label: "Australian Dollar (AUD)", value: "AUD" },
  { label: "Canadian Dollar (CAD)", value: "CAD" },
  { label: "Chinese Yuan Renminbi (CNY)", value: "CNY" },
  { label: "Euro (€)", value: "€" },
  { label: "Hong Kong Dollar (HKD)", value: "HKD" },
  { label: "Japanese Yen (JPY)", value: "JPY" },
  { label: "Singapore Dollar (SGD)", value: "SGD" },
  { label: "UAE Dirham (AED)", value: "AED" },
  { label: "UK British Pound (£)", value: "£" },
];
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
  isSubmitting = false,
  mode,
}: GroupFormModalProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [name, setName] = useState("");
  const [currency, setCurrency] = useState("₱");
  const [description, setDescription] = useState("");
  const [imageUrl, setImageUrl] = useState<string | undefined>(undefined);
  const [inviteRecipients, setInviteRecipients] = useState<InviteRecipientDraft[]>([]);
  const [error, setError] = useState("");
  const [isDragActive, setIsDragActive] = useState(false);
  const [isImageUploading, setIsImageUploading] = useState(false);
  const isEditing = mode === "edit";

  useEffect(() => {
    if (!isOpen) return;

    setName(initialData?.name ?? "");
    setCurrency(initialData?.currency ?? "₱");
    setDescription(initialData?.description ?? "");
    setImageUrl(initialData?.imageUrl ?? undefined);
    setInviteRecipients([]);
    setError("");
  }, [isOpen, initialData]);

  const currentMembers = useMemo(() => (initialData?.members ?? []).filter((m) => m.isActive), [initialData?.members]);
  const previewName = name.trim() || (isEditing ? initialData?.name ?? "Group" : "New Group");

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
    if (isImageUploading || isSubmitting) return;
    fileInputRef.current?.click();
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!name.trim()) {
      setError("Group name is required.");
      return;
    }
    if (!currency) {
      setError("Please select a currency.");
      return;
    }

    try {
      setError("");
      await onSubmit({
        id: initialData?.id,
        name: name.trim(),
        description: description.trim(),
        currency,
        imageUrl,
        inviteRecipients,
      });
      onClose();
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : "Unable to save group.");
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-stretch justify-center p-0 sm:items-center sm:p-4">
      <div className="absolute inset-0 bg-ink-900/65 backdrop-blur-sm" onClick={isSubmitting ? undefined : onClose} />
      <div className="relative flex h-full min-h-dvh w-full flex-col overflow-hidden bg-white shadow-2xl sm:h-auto sm:min-h-0 sm:max-h-[calc(100dvh-2rem)] sm:max-w-lg sm:rounded-4xl">
        <div className="absolute left-4 top-4 z-20 flex items-center gap-3 text-white/70">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            aria-label={isEditing ? "Close edit group modal" : "Close add group modal"}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full p-2 text-white/80 transition hover:bg-white/10 hover:text-white disabled:opacity-50 sm:hidden"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <p className="text-xs font-medium uppercase tracking-[0.32em] text-white/70">
            {isEditing ? "Edit Group" : "Create Group"}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          disabled={isSubmitting}
          aria-label={isEditing ? "Close edit group modal" : "Close add group modal"}
          className="absolute right-4 top-4 z-20 hidden h-10 w-10 items-center justify-center rounded-full bg-white/92 text-slate-900 shadow-lg shadow-slate-950/15 transition hover:bg-white disabled:opacity-50 sm:inline-flex"
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
              if (isImageUploading || isSubmitting) return;
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
            <div className="mt-auto flex flex-col gap-3 text-white">
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
              {imageUrl ? (
                <div>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    className="rounded-full bg-white/90 text-slate-900 hover:bg-white"
                    onClick={(event) => {
                      event.stopPropagation();
                      setImageUrl(undefined);
                    }}
                    disabled={isSubmitting}
                  >
                    <ImageMinus className="h-4 w-4" /> Remove cover
                  </Button>
                </div>
              ) : null}
            </div>
          </div>
        </GroupCoverBackground>

        <form className="flex flex-1 flex-col overflow-y-auto px-6 pb-6" onSubmit={(event) => void handleSubmit(event)}>
          {error ? (
            <div className="mt-4 rounded-2xl border border-danger/20 bg-danger/10 px-4 py-3 text-sm text-danger">
              {error}
            </div>
          ) : null}

          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="group-name" className="mb-2 block text-sm font-semibold text-slate-700">
                Group name
              </label>
              <Input
                id="group-name"
                placeholder="Weekend trip"
                value={name}
                onChange={(event) => setName(event.target.value)}
                className="h-12"
                disabled={isSubmitting}
              />
            </div>

            <div>
              <label htmlFor="group-currency" className="mb-2 block text-sm font-semibold text-slate-700">
                Currency
              </label>
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

          <div className="mt-4">
            <label htmlFor="group-description" className="mb-2 block text-sm font-semibold text-slate-700">
              Description of expenses
            </label>
            <textarea
              id="group-description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              rows={4}
              disabled={isSubmitting}
              className="w-full rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-slate-400 disabled:opacity-70"
              placeholder="Flights, food, hotel, and shared transport"
            />
          </div>

          {isEditing && currentMembers.length > 0 ? (
            <div className="mt-5 space-y-3 rounded-3xl bg-slate-50 p-4">
              <div>
                <p className="text-sm font-semibold text-slate-900">Current members</p>
                <p className="mt-1 text-xs text-slate-500">Existing members stay in the group. New people are added through invitations.</p>
              </div>
              <div className="space-y-2">
                {currentMembers.map((member) => (
                  <div
                    key={member.id}
                    className="flex items-center justify-between rounded-3xl border border-slate-200 bg-white px-4 py-3"
                  >
                    <div>
                      <p className="font-semibold text-slate-900">{member.name}</p>
                      <p className="text-xs text-slate-500">{member.isAdmin ? "Admin" : "Member"}</p>
                    </div>
                    {member.email ? (
                      <p className="text-xs text-slate-500">{member.email}</p>
                    ) : null}
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          <div className="mt-5">
            <InviteRecipientPicker
              recipients={inviteRecipients}
              onChange={setInviteRecipients}
              excludeGroupId={initialData?.id}
              disabled={isSubmitting}
              title={isEditing ? "Invite more people" : "Invite people while creating"}
              description={
                isEditing
                  ? "Send one or many invites by email, or choose someone you already collaborated with."
                  : "Add emails in bulk, or search your past collaborators before the group is created."
              }
            />
          </div>

          <Button
            type="submit"
            size="lg"
            className="mt-5 w-full shrink-0 bg-ink-900 text-white hover:bg-ink-800 sm:mt-6"
            disabled={isSubmitting || isImageUploading}
          >
            {isSubmitting ? "Saving..." : isEditing ? "Save group" : "Create group"}
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
