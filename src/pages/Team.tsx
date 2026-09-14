import { useEffect, useState } from "react";
import { useAuthStore } from "@/store/authStore";
import * as companyService from "@/services/companyService";
import type { AsyncState, CompanyMemberWithProfile } from "@/types";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";

const ROLE_LABELS: Record<string, string> = {
  owner: "Owner",
  admin: "Admin",
  designer: "Designer",
  viewer: "Viewer",
};

export default function TeamPage() {
  const company = useAuthStore((s) => s.company);
  const [members, setMembers] = useState<AsyncState<CompanyMemberWithProfile[]>>({
    status: "idle",
  });

  useEffect(() => {
    if (!company?.id) return;
    setMembers({ status: "loading" });
    companyService
      .listTeamMembers(company.id)
      .then((data) =>
        setMembers(
          data.length === 0 ? { status: "empty" } : { status: "success", data }
        )
      )
      .catch((err) =>
        setMembers({
          status: "error",
          error: err instanceof Error ? err.message : "Failed to load team.",
        })
      );
  }, [company?.id]);

  return (
    <div className="p-8 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Team</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Everyone with access to {company?.name ?? "your company"}.
        </p>
      </div>

      {members.status === "loading" && (
        <Card>
          <CardContent className="p-6 space-y-3">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
          </CardContent>
        </Card>
      )}

      {members.status === "error" && (
        <p className="text-sm text-destructive">{members.error}</p>
      )}

      {members.status === "empty" && (
        <p className="text-sm text-muted-foreground">No team members found.</p>
      )}

      {members.status === "success" && (
        <Card>
          <CardContent className="p-0">
            <ul className="divide-y">
              {members.data.map((member) => (
                <li key={member.id} className="flex items-center justify-between px-6 py-4">
                  <div>
                    <p className="font-medium">
                      {member.profile?.full_name || member.profile?.email}
                    </p>
                    <p className="text-sm text-muted-foreground">{member.profile?.email}</p>
                  </div>
                  <Badge>{ROLE_LABELS[member.role] ?? member.role}</Badge>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
