"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { SectionDivider } from "@/components/layout/section-divider";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { authClient } from "@/lib/auth-client";

// Schemas
const profileSchema = z.object({
    name: z.string().min(1, "Name is required"),
    image: z.string().url("Must be a valid URL").optional().or(z.literal("")),
});

// Types
type Session = typeof authClient.$Infer.Session;

// Profile Section
export function ProfileSection({ session }: { session: Session | null }) {
    const userInitials =
        session?.user?.name
            ?.split(" ")
            .map((n) => n[0])
            .join("")
            .toUpperCase()
            .slice(0, 2) || "U";

    const avatarUrl = session?.user?.image || undefined;

    const form = useForm<z.infer<typeof profileSchema>>({
        resolver: zodResolver(profileSchema),
        values: {
            name: session?.user?.name || "",
            image: session?.user?.image || "",
        },
    });

    const mutation = useMutation({
        mutationFn: async (values: z.infer<typeof profileSchema>) => {
            const { error } = await authClient.updateUser({
                name: values.name,
                image: values.image || null,
            });
            if (error) throw new Error(error.message || "Failed to update profile");
        },
        onSuccess: () => toast.success("Profile updated successfully"),
        onError: (error: Error) => toast.error(`Failed to update profile: ${error.message}`),
    });

    return (
        <section className="space-y-4">
            <SectionDivider label="Profile" />
            <Form {...form}>
                <form onSubmit={form.handleSubmit((v) => mutation.mutateAsync(v))} className="space-y-6">
                    <div className="flex items-center gap-4">
                        <Avatar className="h-16 w-16 rounded-sm border border-border/50">
                            <AvatarImage src={avatarUrl} alt={session?.user?.name || "User"} />
                            <AvatarFallback className="text-2xl">{userInitials}</AvatarFallback>
                        </Avatar>
                        <div>
                            <p className="font-light text-lg">{session?.user?.name || "User"}</p>
                            <p className="text-xs text-muted-foreground">{session?.user?.email || ""}</p>
                        </div>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                        <FormField
                            control={form.control}
                            name="name"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel className="text-xs text-muted-foreground">Name</FormLabel>
                                    <FormControl>
                                        <Input placeholder="Your name" {...field} disabled={mutation.isPending} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="image"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel className="text-xs text-muted-foreground">Profile Image URL</FormLabel>
                                    <FormControl>
                                        <Input
                                            type="url"
                                            placeholder="https://example.com/avatar.jpg"
                                            {...field}
                                            disabled={mutation.isPending}
                                        />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                    </div>

                    <Button type="submit" disabled={mutation.isPending}>
                        {mutation.isPending ? "Updating..." : "Update Profile"}
                    </Button>
                </form>
            </Form>
        </section>
    );
}
