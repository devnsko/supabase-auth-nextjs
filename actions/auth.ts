"use server";

import { createClient } from "@/utils/supabase/server";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

export async function getUserSession() {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.getUser();
    if (error) {
        return {
            status: error.message,
            user: null,
        };
    }
    return {
        status: "success",
        user: data?.user,
    };
}

export async function signUp(formData: FormData) {
    const supabase = await createClient();
    
    const credentials = {
        username: formData.get("username") as string,
        email: formData.get("email") as string,
        password: formData.get("password") as string,
    };

    const { error, data } = await supabase.auth.signUp({
        email: credentials.email,
        password: credentials.password,
        options: {
            data: {
                username: credentials.username,
            },
        },
    });

    if (error) {
        return {
            status: error.message,
            user: null,
        };
    }
    else if (data?.user?.identities?.length === 0) {
        return {
            status: "User with this email already exists, please login",
            user: null,            
        };
    }

    revalidatePath("/", "layout");
    return {
        status: "success",
        user: data.user,
    };
}

export async function signIn(formData: FormData) {
    const supabase = await createClient();

    const credentials = {
        email: formData.get("email") as string,
        password: formData.get("password") as string,
    };

    const { error, data } = await supabase.auth.signInWithPassword({
        email: credentials.email,
        password: credentials.password,
    });

    if (error) {
        return {
            status: error.message,
            user: null,
        };
    }

    
    const { data: existingUser } = await supabase
        .from("user_profiles")
        .select("*")
        .eq("email", credentials?.email)
        .limit(1)
        .single();

    if (!existingUser) {
        const { error: insertError } = await supabase.from("user_profiles").insert({
            email: data?.user?.email,
            username: data?.user?.user_metadata?.username
        });
        if (insertError) {
            return {
                status: insertError?.message,
                user: null,
            };
        }
    }

    revalidatePath("/", "layout");
    return {
        status: "success",
        user: data.user,
    };
}

export async function signOut() {
    const supabase = await createClient();

    const { error } = await supabase.auth.signOut();

    if (error) {
        redirect("/error");
    }

    revalidatePath("/", "layout");
    redirect("/login");
}

export async function signInWithGoogle() {
    const origin = (await headers()).get("origin");
    const supabase = await createClient();

    const { data, error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
            redirectTo: `${origin}/auth/callback`,
        },
    });

    if (error) {
        redirect("/error");
    } else if (data?.url) {
        redirect(data.url);
    }

    revalidatePath("/", "layout");
}

export async function forgotPassword(formData: FormData) {
    const supabase = await createClient();
    const origin = (await headers()).get("origin");
    if (!origin) {
        return {
            status: "Origin header is missing"
        };
    }

    const email = formData.get("email") as string;

    const { error } = await supabase.auth.resetPasswordForEmail(email, 
        {
        redirectTo: `${origin}/reset-password`,
        }
    );

    if (error) {
        return {
            status: error?.message
        };
    }

    return {
        status: "success"
    };
}

export async function resetPassword(formData: FormData, code: string) {
    const supabase = await createClient();
    const { error: CodeError } = await supabase.auth.exchangeCodeForSession(code);

    if (CodeError) {
        return {
            status: CodeError?.message
        };
    }

    const { error } = await supabase.auth.updateUser({
        password: formData.get("password") as string,
    });

    if (error) {
        return {
            status: error?.message
        };
    }

    return {
        status: "success"
    };
}