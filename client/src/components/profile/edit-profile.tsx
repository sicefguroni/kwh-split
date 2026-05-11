import { useEffect, useRef, useState } from "react";
import { Mail, Image, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useCurrentUser } from "@/features/auth/use-auth";
import { cn } from "@/lib/cn";

export interface EditProfileProps {
  onSubmit?: (data: { name: string; email: string; imageUrl?: string }) => Promise<void>;
  onClose?: () => void;
  isSubmitting?: boolean;
}

const MAX_AVATAR_IMAGE_SIZE_BYTES = 1024 * 1024;

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

export function EditProfile({
  onSubmit,
  onClose,
  isSubmitting = false,
}: EditProfileProps) {
  const { data: user } = useCurrentUser();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [imageUrl, setImageUrl] = useState<string | undefined>(undefined);
  const [error, setError] = useState("");
  const [isDragActive, setIsDragActive] = useState(false);
  const [isImageUploading, setIsImageUploading] = useState(false);

  useEffect(() => {
    if (!user) return;

    setName(user.name ?? "");
    setEmail(user.email ?? "");
    setImageUrl(undefined);
    setError("");
  }, [user]);

  const handleImageFile = async (file: File | null | undefined) => {
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setError("Please upload an image file.");
      return;
    }

    if (file.size > MAX_AVATAR_IMAGE_SIZE_BYTES) {
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
      setError("Name is required.");
      return;
    }

    if (!email.trim()) {
      setError("Email is required.");
      return;
    }

    try {
      setError("");
      if (onSubmit) {
        await onSubmit({
          name: name.trim(),
          email: email.trim(),
          ...(imageUrl && { imageUrl }),
        });
      }
      if (onClose) {
        onClose();
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to update profile.");
    }
  };

  const avatarInitial = name.trim() ? name.charAt(0).toUpperCase() : (user?.name.charAt(0) ?? "?");

  return (
    <div className="fixed inset-0 z-50 flex items-stretch justify-center p-0 sm:items-center sm:p-4">
      <div className="absolute inset-0 bg-ink-900/65 backdrop-blur-sm" onClick={isSubmitting ? undefined : onClose} />
      <div className="relative flex h-full min-h-dvh w-full flex-col overflow-hidden bg-white shadow-2xl sm:h-auto sm:min-h-0 sm:max-h-[calc(100dvh-2rem)] sm:max-w-lg sm:rounded-4xl">
        <button
          type="button"
          onClick={onClose}
          disabled={isSubmitting}
          aria-label="Close edit profile modal"
          className="absolute right-4 top-4 z-20 flex h-10 w-10 items-center justify-center rounded-full bg-white/92 text-slate-900 shadow-lg shadow-slate-950/15 transition hover:bg-white disabled:opacity-50"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="flex flex-col items-center gap-6 bg-gradient-to-b from-slate-900 via-slate-950 to-slate-900/95 px-6 py-8 sm:py-10">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.32em] text-white/70">
              Edit Profile
            </p>
          </div>

          {/* Avatar Section */}
          <div className="relative">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/jpg,image/webp,image/gif"
              className="hidden"
              onChange={handleImageInputChange}
            />
            <div
              className={cn(
                "flex h-32 w-32 items-center justify-center rounded-full bg-gradient-to-br from-mint-500 to-mint-600 text-5xl font-bold text-white shadow-2xl transition",
                isDragActive && "ring-4 ring-white/40",
              )}
              role="button"
              tabIndex={0}
              aria-label="Change profile avatar"
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
              style={imageUrl ? { backgroundImage: `url(${imageUrl})`, backgroundSize: 'cover', backgroundPosition: 'center' } : undefined}
            >
              {!imageUrl && avatarInitial}
              <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/0 transition hover:bg-black/30">
                <Image className="h-6 w-6 text-white/70 opacity-0 transition group-hover:opacity-100" aria-hidden="true" />
              </div>
            </div>
          </div>

          <p className="text-center text-xs text-white/70">Click to change avatar</p>
        </div>

        <form className="flex flex-1 flex-col overflow-y-auto px-6 pb-6" onSubmit={(event) => void handleSubmit(event)}>
          {error ? (
            <div className="mt-4 rounded-2xl border border-danger/20 bg-danger/10 px-4 py-3 text-sm text-danger">
              {error}
            </div>
          ) : null}

          <div className="mt-6 space-y-4">
            <div>
              <label htmlFor="profile-name" className="mb-2 block text-sm font-semibold text-slate-700">
                Name
              </label>
              <Input
                id="profile-name"
                type="text"
                placeholder="Your name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                className="h-12"
                disabled={isSubmitting}
              />
            </div>

            <div>
              <label htmlFor="profile-email" className="mb-2 block text-sm font-semibold text-slate-700">
                Email
              </label>
              <div className="relative flex items-center">
                <Mail className="absolute left-4 h-4 w-4 text-slate-500" aria-hidden="true" />
                <Input
                  id="profile-email"
                  type="email"
                  placeholder="your.email@example.com"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  className="h-12 pl-11"
                  disabled={isSubmitting}
                />
              </div>
            </div>
          </div>

          <Button
            type="submit"
            size="lg"
            className="mt-6 w-full shrink-0 bg-ink-900 text-white hover:bg-ink-800"
            disabled={isSubmitting || isImageUploading}
          >
            {isSubmitting ? "Saving..." : "Update Profile"}
          </Button>
        </form>
      </div>
    </div>
  );
}
