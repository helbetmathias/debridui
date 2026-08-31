"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowUpRight } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import type { z } from "zod";
import { ServicePicker } from "@/components/accounts/service-picker";
import { Button } from "@/components/ui/button";
import { PasswordInput } from "@/components/ui/password-input";
import { Spinner } from "@/components/ui/spinner";
import { useAddUserAccount } from "@/hooks/use-user-accounts";
import { AllDebridClient } from "@/lib/clients";
import { ACCOUNT_KEY_SOURCES } from "@/lib/constants";
import { AccountType, accountSchema } from "@/lib/schemas";
import { formatAccountType } from "@/lib/utils";
import { handleError } from "@/lib/utils/error-handling";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "./ui/form";

/** AllDebrid is the only service that hands back a key without the user copying one. */
const AUTHORIZES_IN_PLACE = AccountType.ALLDEBRID;

export function AddAccountForm() {
    const addAccount = useAddUserAccount();
    const [isAuthorizing, setIsAuthorizing] = useState(false);

    const form = useForm<z.infer<typeof accountSchema>>({
        resolver: zodResolver(accountSchema),
        defaultValues: { apiKey: "", type: undefined },
    });

    const selected = form.watch("type");
    const source = selected ? ACCOUNT_KEY_SOURCES[selected] : undefined;
    const name = selected ? formatAccountType(selected) : "";
    const isBusy = addAccount.isPending || isAuthorizing;

    // AuthProvider handles the redirect to /dashboard once an account exists
    function onSubmit(values: z.infer<typeof accountSchema>) {
        addAccount.mutate(values, { onSuccess: () => form.reset() });
    }

    async function authorize() {
        setIsAuthorizing(true);
        try {
            const { pin, check, redirect_url } = await AllDebridClient.getAuthPin();
            window.open(redirect_url, "_blank", "noreferrer");

            const { success, apiKey } = await AllDebridClient.validateAuthPin(pin, check);
            if (!success || !apiKey) {
                toast.error("AllDebrid didn't confirm the PIN. Try again, or paste a key instead.");
                return;
            }

            addAccount.mutate({ type: AccountType.ALLDEBRID, apiKey }, { onSuccess: () => form.reset() });
        } catch (error) {
            handleError(error);
        } finally {
            setIsAuthorizing(false);
        }
    }

    return (
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-6">
                <FormField
                    control={form.control}
                    name="type"
                    render={({ field }) => (
                        <FormItem>
                            <FormControl>
                                <ServicePicker
                                    name="account-type"
                                    value={field.value}
                                    onChange={field.onChange}
                                    disabled={isBusy}
                                />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />

                {selected && source && (
                    <div
                        key={selected}
                        className="flex flex-col gap-3 animate-in fade-in-0 slide-in-from-bottom-2 duration-300">
                        <FormField
                            control={form.control}
                            name="apiKey"
                            render={({ field }) => (
                                <FormItem className="space-y-2">
                                    <div className="flex items-baseline justify-between gap-3">
                                        <FormLabel className="text-xs tracking-widest uppercase text-muted-foreground">
                                            API key
                                        </FormLabel>
                                        <a
                                            href={source.url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="inline-flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground">
                                            Get your {name} key
                                            <ArrowUpRight className="size-3 opacity-50" />
                                        </a>
                                    </div>
                                    <div className="flex gap-2">
                                        <FormControl>
                                            {/* PasswordInput renders its own wrapper, so the flex child is here */}
                                            <div className="flex-1">
                                                <PasswordInput
                                                    {...field}
                                                    placeholder="Paste it here"
                                                    autoComplete="off"
                                                    spellCheck={false}
                                                    className="font-mono"
                                                    disabled={isBusy}
                                                />
                                            </div>
                                        </FormControl>
                                        <Button type="submit" disabled={isBusy || !field.value.trim()}>
                                            {addAccount.isPending && <Spinner />}
                                            Connect
                                        </Button>
                                    </div>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <p className="text-xs text-muted-foreground">
                            {source.hint}
                            {selected === AUTHORIZES_IN_PLACE && (
                                <>
                                    {" Or "}
                                    <button
                                        type="button"
                                        onClick={authorize}
                                        disabled={isBusy}
                                        className="cursor-pointer underline underline-offset-4 transition-colors hover:text-foreground disabled:no-underline disabled:opacity-50">
                                        {isAuthorizing ? "waiting for approval…" : "authorize with a PIN instead"}
                                    </button>
                                    {isAuthorizing && <Spinner className="ml-1.5 inline size-3 align-[-2px]" />}
                                </>
                            )}
                        </p>
                    </div>
                )}
            </form>
        </Form>
    );
}
