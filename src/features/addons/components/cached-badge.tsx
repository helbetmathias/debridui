import { Zap } from "lucide-react";

export function CachedBadge() {
    return (
        <span className="inline-flex items-center gap-1 text-xs tracking-wider uppercase text-green-600 dark:text-green-500">
            <Zap className="size-3 fill-current -translate-y-px" />
            <span>Cached</span>
        </span>
    );
}
