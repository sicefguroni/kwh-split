import { useState } from "react";
import { X, Mail, Copy, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { groupsApi } from "@/features/groups/api";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

interface InviteModalProps {
    isOpen: boolean;
    onClose: () => void;
    groupId: string;
    groupName: string;
}

export function InviteModal({ isOpen, onClose, groupId, groupName }: InviteModalProps) {
    const [email, setEmail] = useState("");
    const [inviteLink, setInviteLink] = useState<string | null>(null);
    const queryClient = useQueryClient();

    // Fetch invite link
    const { data: inviteLinkData, isLoading: linkLoading } = useQuery({
        queryKey: ["group-invite-link", groupId],
        queryFn: () => groupsApi.getInviteLink(groupId),
        enabled: isOpen,
    });

    // Invite by email mutation
    const inviteMutation = useMutation({
        mutationFn: (email: string) => groupsApi.inviteByEmail(groupId, email),
        onSuccess: () => {
            setEmail("");
            queryClient.invalidateQueries({ queryKey: ["group-invitations", groupId] });
        },
    });

    // Regenerate link mutation
    const regenerateMutation = useMutation({
        mutationFn: () => groupsApi.regenerateInviteLink(groupId),
        onSuccess: (response) => {
            setInviteLink(`${window.location.origin}/join/${response.inviteToken}`);
            queryClient.invalidateQueries({ queryKey: ["group-invite-link", groupId] });
        },
    });

    const handleInvite = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!email.trim()) return;

        try {
            await inviteMutation.mutateAsync(email);
        } catch (error) {
            // Error is handled by the mutation
        }
    };

    const copyInviteLink = async () => {
        const link = inviteLink || `${window.location.origin}/join/${inviteLinkData?.inviteToken}`;
        if (link) {
            await navigator.clipboard.writeText(link);
            // Could add a toast notification here
        }
    };

    const handleRegenerateLink = async () => {
        try {
            await regenerateMutation.mutateAsync();
        } catch (error) {
            // Error is handled by the mutation
        }
    };

    if (!isOpen) return null;

    const currentInviteLink = inviteLink || (inviteLinkData?.inviteToken ? `${window.location.origin}/join/${inviteLinkData.inviteToken}` : null);

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <Card className="w-full max-w-md">
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <div>
                            <h2 className="text-lg font-semibold">Invite to {groupName}</h2>
                            <p className="text-sm text-gray-600">Add new members to your group</p>
                        </div>
                        <Button variant="ghost" size="sm" onClick={onClose}>
                            <X className="h-4 w-4" />
                        </Button>
                    </div>
                </CardHeader>

                <CardContent className="space-y-6">
                    {/* Invite by Email */}
                    <div>
                        <Label htmlFor="email">Invite by Email</Label>
                        <form onSubmit={handleInvite} className="mt-2 flex gap-2">
                            <Input
                                id="email"
                                type="email"
                                placeholder="friend@example.com"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                disabled={inviteMutation.isPending}
                            />
                            <Button
                                type="submit"
                                disabled={!email.trim() || inviteMutation.isPending}
                            >
                                {inviteMutation.isPending ? <Spinner /> : <Mail className="h-4 w-4" />}
                            </Button>
                        </form>
                        {inviteMutation.isError && (
                            <p className="mt-1 text-sm text-red-600">
                                Failed to send invitation
                            </p>
                        )}
                        {inviteMutation.isSuccess && (
                            <p className="mt-1 text-sm text-green-600">Invitation sent successfully!</p>
                        )}
                    </div>

                    {/* Public Invite Link */}
                    <div>
                        <Label>Public Invite Link</Label>
                        <p className="mt-1 text-sm text-gray-600">
                            Share this link with anyone you want to invite. They can join without needing an email invitation.
                        </p>

                        {linkLoading ? (
                            <div className="mt-2 flex items-center gap-2">
                                <Spinner />
                                <span className="text-sm text-gray-500">Loading link...</span>
                            </div>
                        ) : currentInviteLink ? (
                            <div className="mt-2 space-y-2">
                                <div className="flex items-center gap-2 rounded border p-2">
                                    <input
                                        type="text"
                                        value={currentInviteLink}
                                        readOnly
                                        className="flex-1 bg-transparent text-sm"
                                    />
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={copyInviteLink}
                                        title="Copy link"
                                    >
                                        <Copy className="h-4 w-4" />
                                    </Button>
                                </div>
                                <Button
                                    variant="secondary"
                                    size="sm"
                                    onClick={handleRegenerateLink}
                                    disabled={regenerateMutation.isPending}
                                    className="w-full"
                                >
                                    {regenerateMutation.isPending ? (
                                        <Spinner />
                                    ) : (
                                        <RefreshCw className="mr-2 h-4 w-4" />
                                    )}
                                    Regenerate Link
                                </Button>
                            </div>
                        ) : (
                            <div className="mt-2">
                                <Button
                                    variant="secondary"
                                    onClick={handleRegenerateLink}
                                    disabled={regenerateMutation.isPending}
                                >
                                    {regenerateMutation.isPending ? <Spinner /> : "Generate Invite Link"}
                                </Button>
                            </div>
                        )}

                        {regenerateMutation.isError && (
                            <p className="mt-1 text-sm text-red-600">
                                Failed to regenerate link
                            </p>
                        )}
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}