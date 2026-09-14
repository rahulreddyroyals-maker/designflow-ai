import { useEffect } from "react";
import { Link } from "react-router-dom";
import { Plus, FolderKanban, Clock3, CheckCircle2 } from "lucide-react";
import { useAuthStore } from "@/store/authStore";
import { useDashboardStore } from "@/store/dashboardStore";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { PROJECT_STATUS_LABELS } from "@/types";

export default function DashboardPage() {
  const profile = useAuthStore((s) => s.profile);
  const company = useAuthStore((s) => s.company);
  const { data, fetch } = useDashboardStore();

  useEffect(() => {
    if (company?.id) fetch(company.id);
  }, [company?.id, fetch]);

  return (
    <div className="p-8 space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">
            Good to see you{profile?.full_name ? `, ${profile.full_name.split(" ")[0]}` : ""}
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Here&apos;s what&apos;s happening at {company?.name ?? "your studio"}.
          </p>
        </div>
        <Button asChild>
          <Link to="/projects/new">
            <Plus className="h-4 w-4 mr-2" />
            New Project
          </Link>
        </Button>
      </div>

      {data.status === "loading" && <DashboardSkeleton />}

      {data.status === "error" && (
        <Card className="border-destructive/40">
          <CardContent className="p-6 text-sm text-destructive">
            Couldn&apos;t load your dashboard: {data.error}
          </CardContent>
        </Card>
      )}

      {data.status === "empty" && (
        <Card>
          <CardContent className="p-10 text-center">
            <FolderKanban className="h-8 w-8 mx-auto text-muted-foreground mb-3" />
            <p className="font-medium">No projects yet</p>
            <p className="text-sm text-muted-foreground mt-1 mb-4">
              Create your first project to start turning a floor plan into a design proposal.
            </p>
            <Button asChild>
              <Link to="/projects/new">
                <Plus className="h-4 w-4 mr-2" />
                New Project
              </Link>
            </Button>
          </CardContent>
        </Card>
      )}

      {data.status === "success" && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <StatCard
              label="Total Projects"
              value={data.data.stats.total}
              icon={FolderKanban}
            />
            <StatCard label="Active" value={data.data.stats.active} icon={Clock3} />
            <StatCard
              label="Completed"
              value={data.data.stats.completed}
              icon={CheckCircle2}
            />
          </div>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">Recent Projects</CardTitle>
              <Link to="/projects" className="text-sm text-muted-foreground hover:underline">
                View all
              </Link>
            </CardHeader>
            <CardContent className="p-0">
              <ul className="divide-y">
                {data.data.recentProjects.map((project) => (
                  <li key={project.id}>
                    <Link
                      to={`/projects/${project.id}`}
                      className="flex items-center justify-between px-6 py-4 hover:bg-muted/50"
                    >
                      <div>
                        <p className="font-medium">{project.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {project.client_name ?? "No client"}
                          {project.bhk ? ` · ${project.bhk}` : ""}
                        </p>
                      </div>
                      <Badge>{PROJECT_STATUS_LABELS[project.status]}</Badge>
                    </Link>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: number;
  icon: typeof FolderKanban;
}) {
  return (
    <Card>
      <CardContent className="p-6 flex items-center justify-between">
        <div>
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className="text-3xl font-semibold mt-1">{value}</p>
        </div>
        <Icon className="h-8 w-8 text-muted-foreground/50" />
      </CardContent>
    </Card>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[0, 1, 2].map((i) => (
          <Card key={i}>
            <CardContent className="p-6">
              <Skeleton className="h-4 w-24 mb-3" />
              <Skeleton className="h-8 w-16" />
            </CardContent>
          </Card>
        ))}
      </div>
      <Card>
        <CardContent className="p-6 space-y-3">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
        </CardContent>
      </Card>
    </div>
  );
}
