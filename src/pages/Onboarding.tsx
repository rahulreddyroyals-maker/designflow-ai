import { useState } from "react";
import { useNavigate } from "react-router-dom";
import * as companyService from "@/services/companyService";
import { useAuthStore } from "@/store/authStore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

/**
 * Fallback for the edge case where a user is authenticated but has no
 * company yet (e.g. sign-up was interrupted after auth but before the
 * company RPC ran). ProtectedRoute redirects here automatically.
 */
export default function OnboardingPage() {
  const navigate = useNavigate();
  const refreshCompany = useAuthStore((s) => s.refreshCompany);
  const profile = useAuthStore((s) => s.profile);

  const [companyName, setCompanyName] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      await companyService.createCompanyWithOwner(companyName);
      await refreshCompany();
      navigate("/dashboard", { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create your company.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 px-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Set up your company</CardTitle>
          <CardDescription>
            {profile?.full_name ? `Hi ${profile.full_name}, ` : ""}one more step — name your
            design studio to finish setting up your account.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="companyName">Company / studio name</Label>
              <Input
                id="companyName"
                required
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
              />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? "Creating…" : "Continue"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
