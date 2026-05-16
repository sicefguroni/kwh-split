import { useMemo } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { MemberSettlementDetailsSections } from "@/components/bank-accounts/member-settlement-details-modal";
import { Spinner } from "@/components/ui/spinner";
import { useGroupQuery } from "@/features/groups/use-groups";

interface LocationState {
  memberName?: string;
}

export default function MemberSettlementDetailsPage() {
  const { groupId, memberId } = useParams<{ groupId: string; memberId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { data: group, isLoading } = useGroupQuery(groupId ?? "");

  const locationState = location.state as LocationState | null;
  const memberName = useMemo(() => {
    if (locationState?.memberName) {
      return locationState.memberName;
    }
    return group?.members.find((member) => member.id === memberId)?.name ?? "Member";
  }, [group?.members, locationState?.memberName, memberId]);

  if (!groupId || !memberId) {
    return null;
  }

  if (isLoading || !group) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-12">
      <header className="sticky top-0 z-10 bg-white shadow-sm">
        <div className="mx-auto flex h-14 max-w-3xl items-center gap-3 px-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-1">
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="inline-flex shrink-0 items-center justify-center rounded-full p-2 text-slate-700 transition hover:bg-slate-100"
              aria-label="Back"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <h1 className="truncate text-base font-semibold text-slate-900">{group.name}</h1>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 pt-6 sm:px-6">
        <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200 sm:p-8">
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">Payment details</p>
          <h2 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">{memberName}</h2>
        </section>

        <MemberSettlementDetailsSections
          groupId={groupId}
          memberId={memberId}
          memberName={memberName}
          className="mt-5"
        />
      </main>
    </div>
  );
}