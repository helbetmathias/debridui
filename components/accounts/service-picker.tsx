"use client";

import { ServiceIcon } from "@/components/accounts/service-icon";
import { AccountType } from "@/lib/schemas";
import { formatAccountType } from "@/lib/utils";

const SERVICES = Object.values(AccountType);

interface ServicePickerProps {
    value?: AccountType;
    onChange: (type: AccountType) => void;
    disabled?: boolean;
    /** Radio group name, unique per rendered picker. */
    name: string;
}

/**
 * Single-select service tiles. Native radios carry arrow-key navigation and form semantics; tiles
 * are uniform and wrap, so any number of services lays out without per-count adjustments.
 */
export function ServicePicker({ value, onChange, disabled, name }: ServicePickerProps) {
    return (
        <fieldset className="flex flex-wrap justify-center gap-2" disabled={disabled}>
            <legend className="sr-only">Debrid service</legend>
            {/* Exact column fractions: rows sit flush, and only an incomplete last row centres */}
            {SERVICES.map((type) => (
                <div key={type} className="w-[calc(50%-0.25rem)] sm:w-[calc(33.333%-0.334rem)]">
                    <input
                        type="radio"
                        id={`${name}-${type}`}
                        name={name}
                        value={type}
                        checked={value === type}
                        onChange={() => onChange(type)}
                        className="peer sr-only"
                    />
                    <label
                        htmlFor={`${name}-${type}`}
                        className="flex h-11 cursor-pointer items-center justify-center gap-2.5 rounded-sm border border-border/50 px-3 transition-colors duration-300 hover:bg-muted/50 peer-checked:border-primary peer-checked:bg-muted/30 peer-focus-visible:ring-3 peer-focus-visible:ring-ring/50 peer-disabled:cursor-not-allowed peer-disabled:opacity-50">
                        <ServiceIcon type={type} className="size-5 shrink-0 rounded-sm" />
                        <span className="truncate text-sm">{formatAccountType(type)}</span>
                    </label>
                </div>
            ))}
        </fieldset>
    );
}
