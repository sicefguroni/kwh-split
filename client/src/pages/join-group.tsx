import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { groupsApi } from "@/features/groups/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";

export default function JoinGroupPage() {
    const { token } = useParams<{ token: string }>();
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [group, setGroup] = useState<any>(null);

    useEffect(() => {
        if (!token) {
            setError("Invalid invite link");
            setLoading(false);
            return;
        }

        // Try to join the group
        const joinGroup = async () => {
            try {
                const response = await groupsApi.joinViaPublicLink(token);
                setGroup(response.group);
            } catch (err: any) {
                if (err.response?.status === 401) {
                    // User needs to login first
                    navigate(`/login?redirect=/join/${token}`);
                    return;
                }
                setError(err.response?.data?.message || "Failed to join group");
            } finally {
                setLoading(false);
            }
        };

        joinGroup();
    }, [token, navigate]);

    const handleAcceptInvitation = async () => {
        if (!token) return;

        try {
            setLoading(true);
            const response = await groupsApi.acceptInvitation(token);
            navigate(`/groups/${response.group.id}`);
        } catch (err: any) {
            setError(err.response?.data?.message || "Failed to accept invitation");
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <Spinner />
            </div>
        );
    }

    if (error) {
        return (
            <div className="min-h-screen flex items-center justify-center p-4">
                <Card className="w-full max-w-md">
                    <CardHeader>
                        <h2 className="text-red-600 text-lg font-semibold">Unable to Join Group</h2>
                        <p className="text-sm text-gray-600 mt-2">{error}</p>
                    </CardHeader>
                    <CardContent>
                        <Button onClick={() => navigate("/")} className="w-full">
                            Go Home
                        </Button>
                    </CardContent>
                </Card>
            </div>
        );
    }

    if (!group) {
        return (
            <div className="min-h-screen flex items-center justify-center p-4">
                <Card className="w-full max-w-md">
                    <CardHeader>
                        <h2 className="text-lg font-semibold">Invalid Invite Link</h2>
                        <p className="text-sm text-gray-600 mt-2">This invite link is not valid or has expired.</p>
                    </CardHeader>
                    <CardContent>
                        <Button onClick={() => navigate("/")} className="w-full">
                            Go Home
                        </Button>
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <div className="min-h-screen flex items-center justify-center p-4">
            <Card className="w-full max-w-md">
                <CardHeader>
                    <h2 className="text-lg font-semibold">Join Group</h2>
                    <p className="text-sm text-gray-600 mt-2">
                        You've been invited to join <strong>{group.name}</strong>
                    </p>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div>
                        <p className="text-sm text-gray-600 mb-2">Group Details:</p>
                        <p><strong>Name:</strong> {group.name}</p>
                        <p><strong>Members:</strong> {group.memberCount}</p>
                        <p><strong>Currency:</strong> {group.currency}</p>
                        {group.description && <p><strong>Description:</strong> {group.description}</p>}
                    </div>

                    <Button onClick={handleAcceptInvitation} className="w-full" disabled={loading}>
                        {loading ? <Spinner /> : "Accept Invitation"}
                    </Button>

                    <Button variant="secondary" onClick={() => navigate("/")} className="w-full">
                        Cancel
                    </Button>
                </CardContent>
            </Card>
        </div>
    );
}