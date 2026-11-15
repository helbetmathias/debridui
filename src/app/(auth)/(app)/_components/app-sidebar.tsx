"use client";

import { FolderOpen, HelpCircle, HomeIcon, Link2, Puzzle, SearchIcon, SettingsIcon, UsersIcon } from "lucide-react";
import type * as React from "react";
import { Sidebar, SidebarContent, SidebarFooter, SidebarHeader, SidebarRail } from "@/components/ui/sidebar";
import { useSearch } from "@/features/search/components/search-provider";
import { AccountSwitcher } from "./account-switcher";
import { NavMain } from "./nav-main";
import { NavUser } from "./nav-user";

const data = {
    navMain: [
        {
            title: "Dashboard",
            url: "/dashboard",
            icon: HomeIcon,
        },
        {
            title: "Search",
            url: "/search",
            icon: SearchIcon,
        },
        {
            title: "Files",
            url: "/files",
            icon: FolderOpen,
        },
        {
            title: "Links",
            url: "/links",
            icon: Link2,
        },
        {
            title: "Addons",
            url: "/addons",
            icon: Puzzle,
        },
        {
            title: "Accounts",
            url: "/accounts",
            icon: UsersIcon,
        },
        {
            title: "Settings",
            url: "/settings",
            icon: SettingsIcon,
        },
    ],
    navSecondary: [
        {
            title: "Help",
            url: "/help",
            icon: HelpCircle,
        },
    ],
};

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
    const { toggle: toggleSearch } = useSearch();

    const handleNavAction = (action?: string) => {
        if (action === "search") {
            toggleSearch();
        }
    };

    return (
        <Sidebar collapsible={"icon"} {...props}>
            <SidebarHeader className="border-b border-sidebar-border/50">
                <AccountSwitcher />
            </SidebarHeader>
            <SidebarContent>
                <NavMain items={data.navMain} onAction={handleNavAction} />
                <NavMain items={data.navSecondary} className="mt-auto" variant="subtle" />
            </SidebarContent>
            <SidebarFooter className="border-t border-sidebar-border/50">
                <NavUser />
            </SidebarFooter>
            <SidebarRail />
        </Sidebar>
    );
}
