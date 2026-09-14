import { NavLink } from "react-router-dom";
import {
  LayoutDashboard,
  FolderKanban,
  Users,
  Palette,
  UsersRound,
  Settings as SettingsIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/projects", label: "Projects", icon: FolderKanban },
  { to: "/clients", label: "Clients", icon: Users },
  { to: "/materials", label: "Materials", icon: Palette },
  { to: "/team", label: "Team", icon: UsersRound },
  { to: "/settings", label: "Settings", icon: SettingsIcon },
];

export default function Sidebar() {
  return (
    <aside className="hidden md:flex h-screen w-60 shrink-0 flex-col border-r bg-card">
      <div className="flex items-center gap-2 px-5 py-5">
        <img src="/logo.png" alt="DesignFlow AI" className="h-7 w-7 object-contain" />
        <span className="font-semibold tracking-tight">DesignFlow AI</span>
      </div>

      <nav className="flex-1 space-y-1 px-3">
        {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "bg-primary text-primary-foreground"
                  : "text-foreground/80 hover:bg-muted"
              )
            }
          >
            <Icon className="h-4 w-4" />
            {label}
          </NavLink>
        ))}
      </nav>

      <div className="px-5 py-4 text-xs text-muted-foreground">
        From Floor Plan to Finished Interior.
      </div>
    </aside>
  );
}
