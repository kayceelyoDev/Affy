import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  CalendarDays,
  PlayCircle,
  Video,
  FolderTree,
  Film,
  Sparkles,
  Music,
  HardDrive,
  UploadCloud,
  ShoppingBag,
  BarChart3,
  Clock,
  Settings as SettingsIcon,
  Palette,
  ChevronLeft,
  ChevronRight,
  Sun,
  Moon,
  Search,
  LogOut,
} from 'lucide-react';
import { cn, Button } from '../ui';
import { useAuth } from '../../context/AuthContext';

interface NavItem {
  name: string;
  href: string;
  icon: React.ElementType;
}

const NAV_ITEMS: NavItem[] = [
  { name: "Dashboard", href: "/", icon: LayoutDashboard },
  { name: "Today's Plan", href: "/planner", icon: CalendarDays },
  { name: "Pipeline & Runs", href: "/runs", icon: PlayCircle },
  { name: "Videos", href: "/videos", icon: Video },
  { name: "Products", href: "/products", icon: FolderTree },
  { name: "Clip Library", href: "/clips", icon: Film },
  { name: "Style Studio", href: "/styles", icon: Sparkles },
  { name: "Music Library", href: "/music", icon: Music },
  { name: "Storage", href: "/storage", icon: HardDrive },
  { name: "Data Upload", href: "/upload", icon: UploadCloud },
  { name: "Orders", href: "/orders", icon: ShoppingBag },
  { name: "Analytics", href: "/analytics", icon: BarChart3 },
  { name: "Schedules", href: "/schedules", icon: Clock },
  { name: "Settings", href: "/settings", icon: SettingsIcon },
  { name: "Design System", href: "/design", icon: Palette },
];

export const Shell: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [collapsed, setCollapsed] = useState(false);
  const [dark, setDark] = useState(true);
  const [cmdOpen, setCmdOpen] = useState(false);
  const location = useLocation();
  const { user, logout, setLoginModalOpen } = useAuth();

  useEffect(() => {
    const root = document.documentElement;
    if (dark) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [dark]);

  // Keyboard shortcut Ctrl+K / Cmd+K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setCmdOpen((prev) => !prev);
      }
      if (e.key === 'Escape') {
        setCmdOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const currentNav = NAV_ITEMS.find((n) => n.href === location.pathname) || { name: 'Overview' };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-white text-[#0A0A0A] dark:bg-black dark:text-[#F5F5F5]">
      {/* Sidebar */}
      <aside
        className={cn(
          'flex flex-col hairline-r bg-[#FAFAFA] dark:bg-[#0A0A0A] transition-standard z-20',
          collapsed ? 'w-16' : 'w-64'
        )}
      >
        {/* Brand Header */}
        <div className="flex h-14 items-center justify-between px-4 hairline-b">
          {!collapsed && (
            <div className="flex items-center gap-2 font-semibold tracking-tight text-sm">
              <span className="w-2.5 h-2.5 rounded-sm bg-black dark:bg-white" />
              <span>Autopilot</span>
            </div>
          )}
          <Button
            variant="ghost"
            size="sm"
            className="p-1 h-7 w-7"
            onClick={() => setCollapsed(!collapsed)}
            aria-label="Toggle sidebar"
          >
            {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
          </Button>
        </div>

        {/* Quick Search Button */}
        <div className="p-3">
          <button
            onClick={() => setCmdOpen(true)}
            className={cn(
              'w-full flex items-center justify-between h-8 px-2.5 text-xs rounded-control hairline-border bg-white dark:bg-[#141414] text-neutral-500 hover:text-neutral-900 dark:hover:text-white transition-standard',
              collapsed && 'justify-center px-0'
            )}
          >
            <div className="flex items-center gap-2">
              <Search size={14} />
              {!collapsed && <span>Search...</span>}
            </div>
            {!collapsed && (
              <kbd className="text-[10px] bg-black/5 dark:bg-white/10 px-1.5 py-0.5 rounded font-mono">
                ⌘K
              </kbd>
            )}
          </button>
        </div>

        {/* Navigation List */}
        <nav className="flex-1 overflow-y-auto px-2 space-y-0.5 py-1">
          {NAV_ITEMS.map((item) => {
            const active = location.pathname === item.href;
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                to={item.href}
                className={cn(
                  'flex items-center gap-2.5 px-3 py-2 text-xs font-medium rounded-control transition-standard group',
                  active
                    ? 'bg-black text-white dark:bg-white dark:text-black font-semibold'
                    : 'text-neutral-600 dark:text-neutral-400 hover:bg-black/5 dark:hover:bg-white/5 hover:text-black dark:hover:text-white',
                  collapsed && 'justify-center px-0'
                )}
                title={collapsed ? item.name : undefined}
              >
                <Icon size={16} className={cn(active ? 'opacity-100' : 'opacity-70 group-hover:opacity-100')} />
                {!collapsed && <span>{item.name}</span>}
              </Link>
            );
          })}
        </nav>

        {/* Footer controls */}
        <div className="p-3 hairline-t flex items-center justify-between">
          {!collapsed && (
            <div className="text-[11px] text-neutral-400 font-mono">
              v0.1.0 • LAN
            </div>
          )}
          <Button
            variant="ghost"
            size="sm"
            className="p-1 h-7 w-7"
            onClick={() => setDark(!dark)}
            aria-label="Toggle theme"
          >
            {dark ? <Sun size={15} /> : <Moon size={15} />}
          </Button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top Navbar & Breadcrumbs */}
        <header className="flex h-14 items-center justify-between px-6 hairline-b bg-white/80 dark:bg-black/80 glass-chrome z-10">
          <div className="flex items-center gap-2 text-xs text-neutral-400">
            <span>Autopilot</span>
            <span>/</span>
            <span className="text-black dark:text-white font-medium">{currentNav.name}</span>
          </div>

          <div className="flex items-center gap-3">
            {user?.authenticated ? (
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  {user.username}
                </span>
                <button
                  onClick={logout}
                  className="text-xs text-neutral-400 hover:text-black dark:hover:text-white p-1 rounded"
                  title="Sign out"
                >
                  <LogOut size={14} />
                </button>
              </div>
            ) : (
              <Button
                variant="primary"
                size="sm"
                onClick={() => setLoginModalOpen(true)}
                className="text-xs py-1 px-2.5"
              >
                Sign In
              </Button>
            )}
          </div>
        </header>

        {/* Main Body */}
        <main className="flex-1 overflow-y-auto p-6 bg-white dark:bg-black">
          {children}
        </main>
      </div>

      {/* Command Palette Modal */}
      {cmdOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-24 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-card hairline-border bg-white dark:bg-[#141414] shadow-2xl p-4 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center gap-2 hairline-b pb-3 mb-2">
              <Search size={16} className="text-neutral-400" />
              <input
                autoFocus
                placeholder="Type a command or jump to page..."
                className="w-full text-sm bg-transparent border-none outline-none text-current"
              />
              <kbd className="text-[10px] bg-black/5 dark:bg-white/10 px-1.5 py-0.5 rounded font-mono">
                ESC
              </kbd>
            </div>
            <div className="max-h-72 overflow-y-auto space-y-1">
              {NAV_ITEMS.map((item) => (
                <Link
                  key={item.href}
                  to={item.href}
                  onClick={() => setCmdOpen(false)}
                  className="flex items-center gap-3 px-3 py-2 text-xs rounded-control hover:bg-black/5 dark:hover:bg-white/5 transition-standard"
                >
                  <item.icon size={15} className="opacity-70" />
                  <span>Jump to {item.name}</span>
                </Link>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
