import { useRef, useState } from "react";
import { Camera, LogOut, QrCode, Upload } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { useCurrentUser, useLogoutMutation } from "@/features/auth/use-auth";
import { useOnlineStatus } from "@/hooks/use-persistent-state";

export default function ProfilePage() {
  const navigate = useNavigate();
  const { data: user, isLoading: isUserLoading } = useCurrentUser();
  const { mutate: logout, isPending: isLoggingOut } = useLogoutMutation();
  const isOnline = useOnlineStatus();

  // Avatar & QR state
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [qrUrl, setQrUrl] = useState<string | null>(null);
  const [name, setName] = useState(user?.name ?? "");
  const [saving, setSaving] = useState(false);

  const avatarInput = useRef<HTMLInputElement>(null);
  const qrInput = useRef<HTMLInputElement>(null);

  const handleLogout = () => {
    logout(undefined, {
      onSuccess: () => {
        navigate("/login");
      },
    });
  };

  const handleUpdateProfile = async (data: { name: string; email: string; imageUrl?: string }) => {
    try {
      // TODO: Implement profile update API call
      console.log("Profile update:", data);
      await new Promise((resolve) => setTimeout(resolve, 500));
    } catch (error) {
      console.error("Failed to update profile:", error);
      throw error;
    }
  };

  const handleSaveName = async () => {
    if (!user || !name.trim()) return;
    setSaving(true);
    try {
      await handleUpdateProfile({ name: name.trim(), email: user.email });
    } finally {
      setSaving(false);
    }
  };

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    setAvatarUrl(url);
    await handleUpdateProfile({ name: user?.name ?? "", email: user?.email ?? "", imageUrl: url });
  };

  const handleQrChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    setQrUrl(url);
  };

  if (isUserLoading) {
    return (
      <div className="flex min-h-screen flex-col bg-white">
        <DashboardHeader
          onLogout={handleLogout}
          isLoggingOut={isLoggingOut}
          isOnline={isOnline}
        />
        <div className="flex flex-1 items-center justify-center">
          <div className="text-ink-600">Loading...</div>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex min-h-screen flex-col bg-white">
        <DashboardHeader
          onLogout={handleLogout}
          isLoggingOut={isLoggingOut}
          isOnline={isOnline}
        />
        <div className="flex flex-1 items-center justify-center">
          <div className="text-ink-600">User not found</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Header — kept exactly from My Version */}
      <DashboardHeader
        onLogout={handleLogout}
        isLoggingOut={isLoggingOut}
        isOnline={isOnline}
      />

      {/* Main Content — Lovable's layout */}
      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-10 space-y-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-ink-900">Profile</h1>
          <p className="text-ink-600 mt-1 text-sm">Manage your account and payment details.</p>
        </div>

        {/* Identity Card */}
        <Card className="p-6 sm:p-8">
          <div className="flex flex-col sm:flex-row items-start gap-6">
            {/* Avatar */}
            <div className="relative group">
              <div className="h-28 w-28 rounded-full overflow-hidden bg-gradient-to-br from-mint-500 to-mint-600 ring-4 ring-white shadow-lg flex items-center justify-center">
                {avatarUrl ? (
                  <img
                    src={avatarUrl}
                    alt={user.name}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <span className="text-4xl font-bold text-white">
                    {user.name.charAt(0).toUpperCase()}
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={() => avatarInput.current?.click()}
                className="absolute bottom-0 right-0 h-9 w-9 rounded-full bg-ink-900 text-white flex items-center justify-center shadow-md hover:bg-ink-700 transition-colors"
                aria-label="Change profile picture"
              >
                <Camera className="h-4 w-4" />
              </button>
              <input
                ref={avatarInput}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="hidden"
                onChange={handleAvatarChange}
              />
            </div>

            {/* Name & Email Fields */}
            <div className="flex-1 w-full space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name" className="text-sm font-bold text-ink-900">
                  Name
                </Label>
                <div className="flex gap-2">
                  <Input
                    id="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Your name"
                    className="text-ink-900"
                  />
                  <Button
                    onClick={handleSaveName}
                    variant="primary"
                    size="md"
                    disabled={saving || name.trim() === (user.name ?? "")}
                  >
                    {saving ? "Saving…" : "Save"}
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="email" className="text-sm font-bold text-ink-900">
                  Email
                </Label>
                <Input
                  id="email"
                  value={user.email}
                  disabled
                  className="text-ink-600 bg-ink-50"
                />
                <p className="text-xs text-ink-500">Email can't be changed here.</p>
              </div>
            </div>
          </div>
        </Card>

        {/* Wallet / Bank QR Card */}
        <Card className="p-6 sm:p-8">
          <div className="flex items-start justify-between gap-4 mb-4">
            <div>
              <div className="flex items-center gap-2">
                <QrCode className="h-5 w-5 text-mint-600" />
                <h2 className="text-lg font-bold text-ink-900">Wallet / Bank QR</h2>
              </div>
              <p className="text-sm text-ink-600 mt-1">
                Upload a photo of your payment QR so friends can settle up faster.
              </p>
            </div>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => qrInput.current?.click()}
            >
              <Upload className="h-4 w-4 mr-1" />
              {qrUrl ? "Replace" : "Upload"}
            </Button>
            <input
              ref={qrInput}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="hidden"
              onChange={handleQrChange}
            />
          </div>

          {qrUrl ? (
            <div className="rounded-xl border bg-ink-50/30 p-4 flex justify-center">
              <img
                src={qrUrl}
                alt="Wallet QR"
                className="max-h-80 rounded-lg object-contain"
              />
            </div>
          ) : (
            <button
              type="button"
              onClick={() => qrInput.current?.click()}
              className="w-full rounded-xl border-2 border-dashed border-ink-200 bg-ink-50/30 hover:bg-ink-50/60 transition py-12 flex flex-col items-center gap-2 text-ink-500"
            >
              <QrCode className="h-10 w-10" />
              <span className="text-sm font-bold">Click to upload QR card</span>
              <span className="text-xs">PNG, JPG, or WebP — up to 5MB</span>
            </button>
          )}
        </Card>

        {/* Sign Out */}
        <div className="pb-6">
          <Button
            onClick={handleLogout}
            variant="secondary"
            size="md"
            fullWidth
            disabled={isLoggingOut}
          >
            <LogOut className="h-4 w-4 mr-2" />
            {isLoggingOut ? "Signing out…" : "Sign out"}
          </Button>
        </div>
      </main>
    </div>
  );
}