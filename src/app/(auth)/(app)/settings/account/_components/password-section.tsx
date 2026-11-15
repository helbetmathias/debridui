"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { SectionDivider } from "@/components/layout/section-divider";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { setPassword } from "@/features/auth/actions/user";
import { authClient } from "@/lib/auth-client";

export const AUTH_ACCOUNTS_KEY = ["auth-accounts"];

const passwordChangeSchema = z
    .object({
        currentPassword: z.string().min(1, "Current password is required"),
        newPassword: z.string().min(8, "Password must be at least 8 characters"),
        confirmPassword: z.string().min(1, "Please confirm your password"),
    })
    .refine((data) => data.newPassword === data.confirmPassword, {
        message: "Passwords do not match",
        path: ["confirmPassword"],
    });

const passwordSetSchema = z
    .object({
        newPassword: z.string().min(8, "Password must be at least 8 characters"),
        confirmPassword: z.string().min(1, "Please confirm your password"),
    })
    .refine((data) => data.newPassword === data.confirmPassword, {
        message: "Passwords do not match",
        path: ["confirmPassword"],
    });

// Password Section
export function PasswordSection() {
    const queryClient = useQueryClient();

    const { data: accounts = [], isLoading } = useQuery({
        queryKey: AUTH_ACCOUNTS_KEY,
        queryFn: async () => {
            const response = await authClient.listAccounts();
            if (response.error) throw new Error(response.error.message || "Failed to fetch accounts");
            return response.data || [];
        },
        staleTime: 5 * 60 * 1000,
    });

    const hasPassword = accounts.some((account) => account.providerId === "credential");

    const changeForm = useForm<z.infer<typeof passwordChangeSchema>>({
        resolver: zodResolver(passwordChangeSchema),
        defaultValues: { currentPassword: "", newPassword: "", confirmPassword: "" },
    });

    const setForm = useForm<z.infer<typeof passwordSetSchema>>({
        resolver: zodResolver(passwordSetSchema),
        defaultValues: { newPassword: "", confirmPassword: "" },
    });

    const handleChangePassword = async (values: z.infer<typeof passwordChangeSchema>) => {
        const toastId = toast.loading("Changing password...");
        const { error } = await authClient.changePassword({
            currentPassword: values.currentPassword,
            newPassword: values.newPassword,
            revokeOtherSessions: true,
        });
        if (error) {
            toast.error(`Failed to change password: ${error.message}`, { id: toastId });
        } else {
            toast.success("Password changed successfully", { id: toastId });
            changeForm.reset();
        }
    };

    const handleSetPassword = async (values: z.infer<typeof passwordSetSchema>) => {
        const toastId = toast.loading("Setting password...");
        const result = await setPassword(values.newPassword);
        if (!result.success) {
            toast.error(`Failed to set password: ${result.error}`, { id: toastId });
        } else {
            toast.success("Password set successfully", { id: toastId });
            setForm.reset();
            queryClient.invalidateQueries({ queryKey: AUTH_ACCOUNTS_KEY });
        }
    };

    if (isLoading) {
        return (
            <section className="space-y-4">
                <SectionDivider label="Password" />
                <div className="space-y-4 max-w-md">
                    <Skeleton className="h-3 w-48" />
                    <div className="space-y-2">
                        <Skeleton className="h-3 w-24" />
                        <Skeleton className="h-9 w-full" />
                    </div>
                    <div className="space-y-2">
                        <Skeleton className="h-3 w-20" />
                        <Skeleton className="h-9 w-full" />
                    </div>
                    <Skeleton className="h-9 w-32" />
                </div>
            </section>
        );
    }

    return (
        <section className="space-y-4">
            <SectionDivider label="Password" />
            <p className="text-xs text-muted-foreground">
                {hasPassword ? "Change your account password" : "Set a password for your account"}
            </p>

            {hasPassword ? (
                <Form {...changeForm}>
                    <form onSubmit={changeForm.handleSubmit(handleChangePassword)} className="space-y-4 max-w-md">
                        <FormField
                            control={changeForm.control}
                            name="currentPassword"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel className="text-xs text-muted-foreground">Current Password</FormLabel>
                                    <FormControl>
                                        <Input
                                            type="password"
                                            placeholder="Enter current password"
                                            {...field}
                                            disabled={changeForm.formState.isSubmitting}
                                        />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={changeForm.control}
                            name="newPassword"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel className="text-xs text-muted-foreground">New Password</FormLabel>
                                    <FormControl>
                                        <Input
                                            type="password"
                                            placeholder="Enter new password"
                                            {...field}
                                            disabled={changeForm.formState.isSubmitting}
                                        />
                                    </FormControl>
                                    <FormDescription className="text-xs">
                                        Must be at least 8 characters long
                                    </FormDescription>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={changeForm.control}
                            name="confirmPassword"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel className="text-xs text-muted-foreground">
                                        Confirm New Password
                                    </FormLabel>
                                    <FormControl>
                                        <Input
                                            type="password"
                                            placeholder="Confirm new password"
                                            {...field}
                                            disabled={changeForm.formState.isSubmitting}
                                        />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <Button type="submit" disabled={changeForm.formState.isSubmitting}>
                            {changeForm.formState.isSubmitting ? "Changing..." : "Change Password"}
                        </Button>
                    </form>
                </Form>
            ) : (
                <Form {...setForm}>
                    <form onSubmit={setForm.handleSubmit(handleSetPassword)} className="space-y-4 max-w-md">
                        <FormField
                            control={setForm.control}
                            name="newPassword"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel className="text-xs text-muted-foreground">New Password</FormLabel>
                                    <FormControl>
                                        <Input
                                            type="password"
                                            placeholder="Enter password"
                                            {...field}
                                            disabled={setForm.formState.isSubmitting}
                                        />
                                    </FormControl>
                                    <FormDescription className="text-xs">
                                        Must be at least 8 characters long
                                    </FormDescription>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={setForm.control}
                            name="confirmPassword"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel className="text-xs text-muted-foreground">Confirm Password</FormLabel>
                                    <FormControl>
                                        <Input
                                            type="password"
                                            placeholder="Confirm password"
                                            {...field}
                                            disabled={setForm.formState.isSubmitting}
                                        />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <Button type="submit" disabled={setForm.formState.isSubmitting}>
                            {setForm.formState.isSubmitting ? "Setting..." : "Set Password"}
                        </Button>
                    </form>
                </Form>
            )}
        </section>
    );
}
