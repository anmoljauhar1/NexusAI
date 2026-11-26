"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { Bell, Command, Menu, PanelLeftClose, PanelLeftOpen, Search, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { Brand } from "@/components/brand";
import { icons } from "@/components/module-icons";
import { AccountMenu } from "@/components/profile";
import { ConnectionBadge } from "@/components/status";
import { ThemeControl } from "@/components/theme";
import { modules } from "@/lib/modules";
import { useWorkspaceSelection } from "@/lib/workspace-selection";

const groups = ["Workspace", "Research & Data", "Models", "Operations"] as const;

function WorkspaceSwitcher() {
  const { user, memberships, active, choose } = useWorkspaceSelection();
  if (!user || memberships.isError || !active) {
    return <Link href={user ? "/dashboard" : "/login"} className="workspace-selector">
      <span className="workspace-avatar">N</span><span>{user ? "Open workspaces" : "Sign in"}<small>Private workspaces</small></span>
    </Link>;
  }
  return <label className="workspace-selector"><span className="workspace-avatar">N</span>
    <span><small>Active workspace</small><select aria-label="Switch active workspace" value={active.id}
      onChange={(event) => choose(event.target.value)}>
      {memberships.data?.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
    </select></span>
  </label>;
}

function Navigation({ path, collapsed = false, close }: { path: string; collapsed?: boolean; close?: () => void }) {
  return <nav className="workspace-navigation" aria-label="Workspace navigation">
    {groups.map((group) => <section key={group} className="nav-group">
      <p className={collapsed ? "sr-only" : undefined}>{group}</p>
      {modules.filter((module) => module.group === group).map((module) => {
        const Icon = icons[module.id];
        const href = `/${module.id}`;
        const active = path === href;
        return <Link key={module.id} href={href} onClick={close} title={collapsed ? module.name : undefined}
          aria-current={active ? "page" : undefined} className={active ? "nav-item active" : "nav-item"}>
          <Icon size={17} aria-hidden="true" /><span className={collapsed ? "sr-only" : undefined}>{module.name}</span>
        </Link>;
      })}
    </section>)}
  </nav>;
}

function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen((previous) => !previous);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);
  const matches = modules.filter((module) => `${module.name} ${module.group}`.toLowerCase().includes(search.trim().toLowerCase()));
  function changeOpen(next: boolean) { setOpen(next); if (!next) setSearch(""); }
  return <Dialog.Root open={open} onOpenChange={changeOpen}>
    <Dialog.Trigger asChild><button className="search-button" type="button" aria-label="Search workspace modules"><Search size={16} /><span>Search anything</span><kbd><Command size={12} /> K</kbd></button></Dialog.Trigger>
    <Dialog.Portal>
      <Dialog.Overlay className="dialog-overlay" />
      <Dialog.Content className="command-dialog">
        <Dialog.Title>Search workspace modules</Dialog.Title>
        <Dialog.Description>Find a page by its name or section.</Dialog.Description>
        <input className="command-input" aria-label="Filter modules" placeholder="Type a page name…" value={search} onChange={(event) => setSearch(event.target.value)} />
        <ul className="command-results">
          {matches.map((module) => <li key={module.id}><Link href={`/${module.id}`} onClick={() => changeOpen(false)}>{module.name}<small>{module.group}</small></Link></li>)}
        </ul>
        {matches.length === 0 && <p className="metadata" role="status">No matching modules.</p>}
        <Dialog.Close className="icon-button dialog-close" aria-label="Close search"><X size={17} /></Dialog.Close>
      </Dialog.Content>
    </Dialog.Portal>
  </Dialog.Root>;
}

export function WorkspaceShell({ children }: { children: ReactNode }) {
  const path = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const current = modules.find((module) => path === `/${module.id}`);
  return <div className={collapsed ? "workspace shell-collapsed" : "workspace"}>
    <a href="#workspace-main" className="skip-link">Skip to content</a>
    <aside className="sidebar">
      <div className="sidebar-head"><Brand /><button className="icon-button collapse-button" type="button" onClick={() => setCollapsed(!collapsed)} aria-label={collapsed ? "Expand navigation" : "Collapse navigation"} title={collapsed ? "Expand navigation" : "Collapse navigation"}>{collapsed ? <PanelLeftOpen size={17} /> : <PanelLeftClose size={17} />}</button></div>
      {!collapsed && <WorkspaceSwitcher />}
      <Navigation path={path} collapsed={collapsed} />
    </aside>
    <div className="workspace-content">
      <header className="topbar">
        <Dialog.Root open={mobileOpen} onOpenChange={setMobileOpen}>
          <Dialog.Trigger asChild><button className="icon-button mobile-menu" aria-label="Open navigation"><Menu size={20} /></button></Dialog.Trigger>
          <Dialog.Portal><Dialog.Overlay className="dialog-overlay" /><Dialog.Content className="mobile-drawer">
            <Dialog.Title className="sr-only">Workspace navigation</Dialog.Title>
            <Dialog.Description className="sr-only">Navigate to a NexusAI module.</Dialog.Description>
            <div className="sidebar-head"><Brand /><Dialog.Close className="icon-button" aria-label="Close navigation"><X size={18} /></Dialog.Close></div>
            <Navigation path={path} close={() => setMobileOpen(false)} />
          </Dialog.Content></Dialog.Portal>
        </Dialog.Root>
        <nav className="breadcrumbs" aria-label="Breadcrumb"><Link href="/dashboard">Workspace</Link><span aria-hidden="true">/</span><span aria-current="page">{path === "/profile" ? "My profile" : current?.name ?? "Overview"}</span></nav>
        <div className="topbar-actions">
          <CommandPalette />
          <div className="connection-indicator"><ConnectionBadge /></div>
          <ThemeControl />
          <details className="notifications">
            <summary className="icon-button" aria-label="Notifications" title="Notifications"><Bell size={17} /></summary>
            <div className="notification-panel"><strong>Notifications</strong><p>Event notifications require a backend feed.</p><Link href="/monitoring">View service status</Link></div>
          </details>
          <AccountMenu key={path} />
        </div>
      </header>
      <main id="workspace-main" className="workspace-main" tabIndex={-1}>{children}</main>
    </div>
  </div>;
}
