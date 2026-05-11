import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Mail, Search, UserPlus, X } from "lucide-react";
import { groupsApi } from "@/features/groups/api";
import type { ApiCollaboratorSuggestion } from "@/features/groups/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export interface InviteRecipientDraft {
  key: string;
  type: "email" | "user";
  email: string;
  label: string;
  userId?: string;
  mutualGroups?: number;
}

interface InviteRecipientPickerProps {
  recipients: InviteRecipientDraft[];
  onChange: (recipients: InviteRecipientDraft[]) => void;
  excludeGroupId?: string | undefined;
  disabled?: boolean;
  title?: string;
  description?: string;
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i;

const normalizeEmail = (value: string): string => value.trim().toLowerCase();

const parseEmails = (value: string): string[] =>
  value
    .split(/[\n,;]+/)
    .map((part) => normalizeEmail(part))
    .filter((part) => part.length > 0);

const isValidEmail = (value: string): boolean => EMAIL_PATTERN.test(value);

const createEmailRecipient = (email: string): InviteRecipientDraft => ({
  key: `email:${email}`,
  type: "email",
  email,
  label: email,
});

const createUserRecipient = (suggestion: ApiCollaboratorSuggestion): InviteRecipientDraft => ({
  key: `user:${suggestion.userId}`,
  type: "user",
  userId: suggestion.userId,
  email: suggestion.email,
  label: suggestion.name,
  mutualGroups: suggestion.mutualGroups,
});

export function InviteRecipientPicker({
  recipients,
  onChange,
  excludeGroupId,
  disabled = false,
  title = "Invite people",
  description = "Paste one or more emails, or search by collaborator name.",
}: InviteRecipientPickerProps) {
  const [draft, setDraft] = useState("");
  const [error, setError] = useState("");

  const { data: collaborators = [], isFetching } = useQuery({
    queryKey: ["collaborators", excludeGroupId ?? "none", draft],
    queryFn: async () => {
      const { collaborators } = await groupsApi.searchCollaborators(draft.trim(), excludeGroupId);
      return collaborators;
    },
    enabled: !disabled && draft.trim().length >= 1,
    staleTime: 10_000,
  });

  const availableCollaborators = useMemo(
    () =>
      collaborators.filter(
        (suggestion) =>
          !recipients.some(
            (recipient) =>
              recipient.key === `user:${suggestion.userId}` ||
              normalizeEmail(recipient.email) === normalizeEmail(suggestion.email),
          ),
      ),
    [collaborators, recipients],
  );

  const appendRecipients = (nextRecipients: InviteRecipientDraft[]) => {
    const known = new Set(recipients.map((recipient) => recipient.key));
    const knownEmails = new Set(recipients.map((recipient) => normalizeEmail(recipient.email)));
    const merged = [...recipients];

    for (const recipient of nextRecipients) {
      if (known.has(recipient.key) || knownEmails.has(normalizeEmail(recipient.email))) {
        continue;
      }
      merged.push(recipient);
      known.add(recipient.key);
      knownEmails.add(normalizeEmail(recipient.email));
    }

    onChange(merged);
  };

  const handleAddDraft = () => {
    const trimmed = draft.trim();
    if (!trimmed) {
      return;
    }

    const looksLikeEmailInput = trimmed.includes("@") || /[\n,;]/.test(trimmed);
    if (looksLikeEmailInput) {
      const emailParts = parseEmails(trimmed);
      const invalidEmails = emailParts.filter((email) => !isValidEmail(email));
      if (invalidEmails.length > 0) {
        setError(`Invalid email: ${invalidEmails[0]}`);
        return;
      }

      appendRecipients(emailParts.map(createEmailRecipient));
      setDraft("");
      setError("");
      return;
    }

    const exactCollaborator = availableCollaborators.find(
      (suggestion) =>
        suggestion.name.toLowerCase() === trimmed.toLowerCase() ||
        suggestion.email.toLowerCase() === trimmed.toLowerCase(),
    );
    if (exactCollaborator) {
      appendRecipients([createUserRecipient(exactCollaborator)]);
      setDraft("");
      setError("");
      return;
    }

    if (isValidEmail(trimmed)) {
      appendRecipients([createEmailRecipient(normalizeEmail(trimmed))]);
      setDraft("");
      setError("");
      return;
    }

    setError("Enter a valid email, or pick one of your collaborators.");
  };

  const removeRecipient = (key: string) => {
    onChange(recipients.filter((recipient) => recipient.key !== key));
  };

  return (
    <div className="space-y-3 rounded-3xl bg-slate-50 p-4">
      <div>
        <p className="text-sm font-semibold text-slate-900">{title}</p>
        <p className="mt-1 text-xs text-slate-500">{description}</p>
      </div>

      <div className="relative">
        <div className="flex flex-col gap-2 sm:flex-row">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              value={draft}
              onChange={(event) => {
                setDraft(event.target.value);
                if (error) {
                  setError("");
                }
              }}
              onKeyDown={(event) => {
                if (event.key !== "Enter") {
                  return;
                }
                event.preventDefault();
                handleAddDraft();
              }}
              placeholder="friend@example.com, or search a collaborator"
              className="h-12 pl-10"
              disabled={disabled}
            />
          </div>
          <Button
            type="button"
            variant="secondary"
            className="justify-center"
            onClick={handleAddDraft}
            disabled={disabled || draft.trim().length === 0}
          >
            <UserPlus className="h-4 w-4" /> Add
          </Button>
        </div>

        {availableCollaborators.length > 0 ? (
          <div className="absolute left-0 right-0 top-full z-10 mt-1 space-y-1 rounded-2xl border border-slate-200 bg-white p-2 shadow-lg">
            {availableCollaborators.slice(0, 5).map((suggestion) => (
              <button
                key={suggestion.userId}
                type="button"
                className="flex w-full items-center justify-between rounded-2xl px-3 py-2 text-left transition hover:bg-slate-50"
                onClick={() => {
                  appendRecipients([createUserRecipient(suggestion)]);
                  setDraft("");
                  setError("");
                }}
                disabled={disabled}
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-slate-900">{suggestion.name}</p>
                  <p className="truncate text-xs text-slate-500">{suggestion.email}</p>
                </div>
                <span className="ml-3 shrink-0 text-[11px] font-semibold uppercase tracking-wide text-sky-700">
                  {suggestion.mutualGroups} shared
                </span>
              </button>
            ))}
          </div>
        ) : null}
      </div>

      <div className="">
        {error ? (
          <p className="text-xs text-red-600">{error}</p>
        ) : isFetching ? (
          <p className=""></p>
        ) : null}
      </div>

      {recipients.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {recipients.map((recipient) => (
            <div
              key={recipient.key}
              className="inline-flex max-w-full items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700"
            >
              <Mail className="h-3.5 w-3.5 shrink-0 text-slate-400" />
              <span className="truncate">
                {recipient.type === "user" ? `${recipient.label} (${recipient.email})` : recipient.email}
              </span>
              <button
                type="button"
                className="rounded-full p-0.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                onClick={() => removeRecipient(recipient.key)}
                aria-label={`Remove ${recipient.email}`}
                disabled={disabled}
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
