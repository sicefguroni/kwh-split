import { useRef, useState } from "react";
import { Camera, LogOut, QrCode, Upload } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { BankAccountsSection } from "@/components/bank-accounts/bank-accounts-section";
import { useCurrentUser, useLogoutMutation, useUpdateProfileMutation } from "@/features/auth/use-auth";
import { useOnlineStatus } from "@/hooks/use-persistent-state";

export default function ProfilePage() {
  const navigate = useNavigate();
  const { data: user, isLoading: isUserLoading } = useCurrentUser();
  const { mutate: logout, isPending: isLoggingOut } = useLogoutMutation();
  const { mutateAsync: updateProfile, isPending: isSavingProfile } = useUpdateProfileMutation();
  const isOnline = useOnlineStatus();

  // Avatar & QR state for preview
  const [name, setName] = useState(user?.name ?? "");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [qrUrl, setQrUrl] = useState<string | null>(null);
  const [savingName, setSavingName] = useState(false);

  const avatarInput = useRef<HTMLInputElement>(null);
  const qrInput = useRef<HTMLInputElement>(null);

  const handleLogout = () => {
    logout(undefined, {
      onSuccess: () => {
        navigate("/login");
      },
    });
  };

  const handleSaveName = async () => {
    if (!user || !name.trim()) return;
    setSavingName(true);
    try {
      await updateProfile({ name: name.trim() });
    } finally {
      setSavingName(false);
    }
  };

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Create preview URL
    const url = URL.createObjectURL(file);
    setAvatarUrl(url);

    // Convert file to base64 data URL for storage
    const reader = new FileReader();
    reader.onload = async (event) => {
      const dataUrl = event.target?.result as string;
      try {
        await updateProfile({ profileImageUrl: dataUrl });
      } catch (error) {
        console.error("Failed to upload avatar:", error);
        setAvatarUrl(null);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleQrChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Create preview URL
    const url = URL.createObjectURL(file);
    setQrUrl(url);

    // Convert file to base64 data URL for storage
    const reader = new FileReader();
    reader.onload = async (event) => {
      const dataUrl = event.target?.result as string;
      try {
        await updateProfile({ bankQrUrl: dataUrl });
      } catch (error) {
        console.error("Failed to upload QR code:", error);
        setQrUrl(null);
      }
    };
    reader.readAsDataURL(file);
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
                {avatarUrl || user?.profileImageUrl ? (
                  <img
                    src={avatarUrl || user?.profileImageUrl || ""}
                    alt={user?.name}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <span className="text-4xl font-bold text-white">
                    {user?.name?.charAt(0).toUpperCase()}
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={() => avatarInput.current?.click()}
                disabled={isSavingProfile}
                className="absolute bottom-0 right-0 h-9 w-9 rounded-full bg-ink-900 text-white flex items-center justify-center shadow-md hover:bg-ink-700 transition-colors disabled:opacity-50"
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
                    disabled={savingName || isSavingProfile || name.trim() === (user?.name ?? "")}
                  >
                    {savingName || isSavingProfile ? "Saving…" : "Save"}
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="email" className="text-sm font-bold text-ink-900">
                  Email
                </Label>
                <Input
                  id="email"
                  value={user?.email ?? ""}
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
              disabled={isSavingProfile}
            >
              <Upload className="h-4 w-4 mr-1" />
              {isSavingProfile ? "Saving…" : (qrUrl || user?.bankQrUrl) ? "Replace" : "Upload"}
            </Button>
            <input
              ref={qrInput}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="hidden"
              onChange={handleQrChange}
            />
          </div>

          {qrUrl || user?.bankQrUrl ? (
            <div className="rounded-xl border bg-ink-50/30 p-4 flex justify-center">
              <img
                src={qrUrl || user?.bankQrUrl || ""}
                alt="Wallet QR"
                className="max-h-80 rounded-lg object-contain"
              />
            </div>
          ) : (
            <button
              type="button"
              onClick={() => qrInput.current?.click()}
              disabled={isSavingProfile}
              className="w-full rounded-xl border-2 border-dashed border-ink-200 bg-ink-50/30 hover:bg-ink-50/60 transition py-12 flex flex-col items-center gap-2 text-ink-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <QrCode className="h-10 w-10" />
              <span className="text-sm font-bold">Click to upload QR card</span>
              <span className="text-xs">PNG, JPG, or WebP — up to 5MB</span>
            </button>
          )}
        </Card>

        {/* Bank Accounts */}
        <Card className="p-6 sm:p-8">
          <BankAccountsSection />
        </Card>

        {/* PWD / Senior Discount Status */}
        <Card className="p-6 sm:p-8">
          <h2 className="text-lg font-bold text-ink-900 mb-1">Discount Status</h2>
          <p className="text-sm text-ink-600 mb-4">
            Set your PWD or Senior Citizen discount status. This will be visible to all your groups.
          </p>
          <Select
            value={user?.discountType ?? "none"}
            onValueChange={async (value) => {
              try {
                await updateProfile({ discountType: value });
              } catch {
                // silent
              }
            }}
            options={[
              { label: "None", value: "none" },
              { label: "PWD", value: "pwd" },
              { label: "Senior Citizen", value: "senior" },
            ]}
            ariaLabel="Discount status"
            placeholder="None"
            triggerClassName="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700"
            menuClassName="border-slate-200"
          />
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