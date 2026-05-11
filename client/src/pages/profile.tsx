import { useState } from "react";
import { Mail } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { EditProfile } from "@/components/profile/edit-profile";
import { Button } from "@/components/ui/button";
import { useCurrentUser, useLogoutMutation } from "@/features/auth/use-auth";
import { useOnlineStatus } from "@/hooks/use-persistent-state";

export default function ProfilePage() {
  const navigate = useNavigate();
  const { data: user, isLoading: isUserLoading } = useCurrentUser();
  const { mutate: logout, isPending: isLoggingOut } = useLogoutMutation();
  const isOnline = useOnlineStatus();
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleLogout = () => {
    logout(undefined, {
      onSuccess: () => {
        navigate("/login");
      },
    });
  };

  const handleEditProfile = () => {
    setIsEditModalOpen(true);
  };

  const handleCloseEditModal = () => {
    setIsEditModalOpen(false);
  };

  const handleUpdateProfile = async (data: { name: string; email: string; imageUrl?: string }) => {
    setIsSubmitting(true);
    try {
      // TODO: Implement profile update API call
      console.log("Profile update:", data);
      
      // Simulate API call
      await new Promise((resolve) => setTimeout(resolve, 500));
      
      // Close modal on success
      handleCloseEditModal();
    } catch (error) {
      console.error("Failed to update profile:", error);
      throw error;
    } finally {
      setIsSubmitting(false);
    }
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
    <div className="flex min-h-screen flex-col bg-white">
      {/* Header */}
      <DashboardHeader
        onLogout={handleLogout}
        isLoggingOut={isLoggingOut}
        isOnline={isOnline}
      />

      {/* Main Content */}
      <div className="flex flex-1 flex-col">
        <div className="mx-auto w-full max-w-3xl flex-1 px-4 py-8 sm:px-6">
          {/* Profile Section - Centered */}
          <div className="flex flex-col items-center">
            {/* Avatar */}
            <div className="mb-6">
              <div className="flex h-24 w-24 items-center justify-center rounded-full bg-gradient-to-br from-mint-500 to-mint-600 text-3xl font-bold text-white shadow-lg">
                {user.name.charAt(0).toUpperCase()}
              </div>
            </div>

            {/* Name */}
            <h1 className="mb-8 text-3xl font-bold text-ink-900 sm:text-4xl">
              {user.name}
            </h1>
          </div>

          {/* Contact Info - Left Aligned */}
          <div className="flex flex-col items-start gap-4">
            <div className="flex items-center gap-3">
              <Mail className="h-5 w-5 text-ink-700" aria-hidden="true" />
              <span className="text-ink-700">{user.email}</span>
            </div>
          </div>
        </div>

        {/* Footer Action - Sticky */}
        <div className="border-t border-ink-100/60 bg-white px-4 py-4 sm:px-6">
          <div className="mx-auto max-w-3xl">
            <Button
              onClick={handleEditProfile}
              variant="primary"
              size="md"
              fullWidth
            >
              Edit Profile
            </Button>
          </div>
        </div>
      </div>

      {/* Edit Profile Modal */}
      {isEditModalOpen && (
        <EditProfile
          onSubmit={handleUpdateProfile}
          onClose={handleCloseEditModal}
          isSubmitting={isSubmitting}
        />
      )}
    </div>
  );
}
