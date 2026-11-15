"use client";

import { Loader2, type LucideIcon, X } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface SelectionBarProps {
    /** First part is emphasized; e.g. [{ count: 3, unit: "link" }, { count: 1, unit: "file" }] */
    summary: { count: number; unit: string }[];
    onClear: () => void;
    /** Leading actions, after the summary */
    children?: ReactNode;
    /** Trailing actions, pushed to the end before Clear */
    end?: ReactNode;
}

/** Floating multi-select action bar, shown while `summary` has a non-zero count. */
export function SelectionBar({ summary, onClear, children, end }: SelectionBarProps) {
    const parts = summary.filter((p) => p.count > 0);
    const visible = parts.length > 0;
    const summaryAria = `${parts.map((p) => `${p.count} ${p.unit}${p.count === 1 ? "" : "s"}`).join(" and ")} selected`;

    return (
        <>
            {/* Spacer keeps page content from sitting under the floating bar */}
            <div aria-hidden className={cn("transition-[height] duration-300 ease-in-out", visible ? "h-20" : "h-0")} />

            <TooltipProvider delayDuration={250}>
                {/* biome-ignore lint/a11y/useSemanticElements: needs to remain a div for transform/positioning composition */}
                <div
                    role="region"
                    aria-label="Selection actions"
                    inert={!visible}
                    className={cn(
                        "fixed left-1/2 z-40",
                        // Float above the mobile tab bar; small inset on desktop
                        "bottom-[calc(56px+env(safe-area-inset-bottom)+0.75rem)] md:bottom-6",
                        // Width: full-bleed minus padding on mobile, hug content with a min width on desktop
                        "w-[calc(100vw-1.5rem)] md:w-auto md:min-w-[24rem]",
                        "transition-[opacity,transform] duration-300 ease-out",
                        // Center against the SidebarInset on desktop by offsetting by half the sidebar width
                        "-translate-x-1/2",
                        "md:translate-x-[calc(-50%+var(--sidebar-width)/2)]",
                        "md:group-has-data-[state=collapsed]/sidebar-wrapper:translate-x-[calc(-50%+var(--sidebar-width-icon)/2)]",
                        visible ? "translate-y-0 opacity-100" : "translate-y-3 opacity-0 pointer-events-none"
                    )}>
                    <div
                        className={cn(
                            "flex items-center h-12 gap-1 px-1.5",
                            "bg-background/95 backdrop-blur-md backdrop-saturate-150",
                            "border border-border/60 rounded-sm shadow-lg",
                            "supports-backdrop-filter:bg-background/80"
                        )}>
                        <p className="sr-only" aria-live="polite">
                            {summaryAria}
                        </p>
                        <div
                            title={summaryAria}
                            className="flex items-center gap-1.5 pl-2.5 pr-2 sm:gap-2 sm:pr-3 min-w-0 whitespace-nowrap">
                            {parts.map((part, i) => (
                                <span key={part.unit} className="flex items-center gap-1.5">
                                    {i > 0 && (
                                        <span className="text-border" aria-hidden>
                                            ·
                                        </span>
                                    )}
                                    <span
                                        className={cn(
                                            "tabular-nums text-sm font-medium",
                                            i === 0 ? "text-foreground" : "text-muted-foreground sm:text-foreground"
                                        )}>
                                        {part.count}
                                    </span>
                                    <span className="hidden sm:inline text-[11px] tracking-widest uppercase text-muted-foreground font-light">
                                        {part.unit}
                                        {part.count === 1 ? "" : "s"}
                                    </span>
                                </span>
                            ))}
                        </div>

                        <div className="h-5 w-px bg-border/60 shrink-0" />

                        {children && (
                            <div className="flex items-center gap-0.5 min-w-0 overflow-x-auto scrollbar-none">
                                {children}
                            </div>
                        )}

                        <div className="flex items-center gap-0.5 ml-auto shrink-0">
                            {children && end && <div className="h-5 w-px bg-border/40 mx-1 shrink-0" />}
                            {end}
                            <div className="pl-1 border-l border-border/60">
                                <SelectionBarAction
                                    label="Clear selection"
                                    icon={X}
                                    onClick={onClear}
                                    className="text-muted-foreground hover:text-foreground"
                                />
                            </div>
                        </div>
                    </div>
                </div>
            </TooltipProvider>
        </>
    );
}

interface SelectionBarActionProps {
    label: string;
    icon: LucideIcon;
    isPending?: boolean;
    disabled?: boolean;
    onClick: () => void;
    destructive?: boolean;
    className?: string;
}

export function SelectionBarAction({
    label,
    icon: Icon,
    isPending,
    disabled,
    onClick,
    destructive,
    className,
}: SelectionBarActionProps) {
    return (
        <Tooltip>
            <TooltipTrigger asChild>
                <Button
                    variant="ghost"
                    size="icon"
                    aria-label={label}
                    disabled={isPending || disabled}
                    onClick={onClick}
                    className={cn(
                        "size-9 shrink-0",
                        destructive && "text-destructive hover:bg-destructive/10 hover:text-destructive",
                        className
                    )}>
                    {isPending ? <Loader2 className="size-4 animate-spin" /> : <Icon className="size-4" />}
                </Button>
            </TooltipTrigger>
            <TooltipContent side="top" className="text-xs">
                {label}
            </TooltipContent>
        </Tooltip>
    );
}
