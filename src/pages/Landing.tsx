import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

export default function LandingPage() {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="flex items-center justify-between px-6 py-4 border-b">
        <div className="flex items-center gap-2">
          <img src="/logo.png" alt="DesignFlow AI" className="h-8 w-8 object-contain" />
          <span className="font-semibold">DesignFlow AI</span>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="ghost" asChild>
            <Link to="/login">Log in</Link>
          </Button>
          <Button asChild>
            <Link to="/register">Get Started</Link>
          </Button>
        </div>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center text-center px-6">
        <h1 className="text-4xl md:text-5xl font-semibold tracking-tight max-w-2xl">
          From Floor Plan to Finished Interior
        </h1>
        <p className="text-muted-foreground mt-4 max-w-md">
          AI-powered interior design workflow for professional designers.
        </p>
        <Button size="lg" className="mt-8" asChild>
          <Link to="/register">Start Designing</Link>
        </Button>
      </main>
    </div>
  );
}
