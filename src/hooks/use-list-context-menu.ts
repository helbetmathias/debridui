import { useRef, useState } from "react";

/**
 * One Radix ContextMenu for a whole list: rows mark themselves with `attr`, the trigger wraps the list.
 * The open row gets `data-menu-open` set directly on its element so the list doesn't re-render.
 */
export function useListContextMenu(attr: string) {
    const [targetId, setTargetId] = useState<string | null>(null);
    const pointerRow = useRef<Element | null>(null);
    const openRow = useRef<Element | null>(null);

    const rowOf = (e: React.SyntheticEvent) => (e.target as Element).closest(`[${attr}]`);

    // Runs for right-click and touch long-press (Radix opens on pointerdown + 700ms)
    const capture = (e: React.SyntheticEvent) => {
        pointerRow.current = rowOf(e);
        setTargetId(pointerRow.current?.getAttribute(attr) ?? null);
    };

    return {
        targetId,
        onOpenChange: (open: boolean) => {
            openRow.current?.removeAttribute("data-menu-open");
            openRow.current = open ? pointerRow.current : null;
            openRow.current?.setAttribute("data-menu-open", "");
        },
        triggerProps: {
            // Outside a row, stop before Radix's handler so the browser's own menu shows
            onContextMenuCapture: (e: React.MouseEvent) => {
                if (!rowOf(e)) e.stopPropagation();
            },
            onContextMenu: capture,
            onPointerDown: capture,
        },
    };
}
