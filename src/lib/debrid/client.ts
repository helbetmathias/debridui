import { AccountType } from "@/lib/schemas";
import type { Account } from "@/types";
import AllDebridClient from "./alldebrid";
import DebridLinkClient from "./debrid-link";
import PremiumizeClient from "./premiumize";
import RealDebridClient from "./realdebrid";
import TorBoxClient from "./torbox";

export type DebridClient =
    | InstanceType<typeof RealDebridClient>
    | InstanceType<typeof TorBoxClient>
    | InstanceType<typeof AllDebridClient>
    | InstanceType<typeof PremiumizeClient>
    | InstanceType<typeof DebridLinkClient>;

export function getClient({ type }: { type: AccountType | string }) {
    switch (type as AccountType) {
        case AccountType.REALDEBRID:
            return RealDebridClient;
        case AccountType.TORBOX:
            return TorBoxClient;
        case AccountType.ALLDEBRID:
            return AllDebridClient;
        case AccountType.PREMIUMIZE:
            return PremiumizeClient;
        case AccountType.DEBRIDLINK:
            return DebridLinkClient;
        default:
            throw new Error(`Unsupported account type: ${type}`);
    }
}

export function getClientInstance(account: Account) {
    const ClientClass = getClient({ type: account.type });
    return new ClientClass(account);
}
