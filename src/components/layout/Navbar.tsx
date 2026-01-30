"use client";

import { SignInButton, SignOutButton, UserButton, useUser, SignedIn, SignedOut } from "@clerk/nextjs";
import { Calculator, LogOut, LogIn, LayoutDashboard, MessageSquare, Home } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function Navbar() {
  const { user } = useUser();

  return (
    <nav className="sticky top-0 z-50 w-full border-b bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/60">
      <div className="container flex h-16 items-center justify-between px-8">
        
        {/* Left Side: Brand Logo */}
        <Link href="/" className="flex items-center gap-2 transition-opacity hover:opacity-80">
          <div className="bg-blue-600 p-1.5 rounded-md">
            <Calculator className="h-6 w-6 text-white" />
          </div>
          <span className="text-xl font-bold tracking-tighter text-slate-900">
            STACKAI MATH EDUCATOR
          </span>
        </Link>

        {/* Center: Main Navigation (Only visible when signed in) */}
        <SignedIn>
          <div className="hidden md:flex items-center gap-6">
            <Link href="/" className="text-sm font-medium text-slate-600 hover:text-blue-600 flex items-center gap-1.5">
              <Home className="h-4 w-4" /> Home
            </Link>
            <Link href="/dashboard" className="text-sm font-medium text-slate-600 hover:text-blue-600 flex items-center gap-1.5">
              <LayoutDashboard className="h-4 w-4" /> Dashboard
            </Link>
            <Link href="/chatbot" className="text-sm font-medium text-slate-600 hover:text-blue-600 flex items-center gap-1.5">
              <MessageSquare className="h-4 w-4" /> Chatbot
            </Link>
          </div>
        </SignedIn>

        {/* Right Side: Auth Actions */}
        <div className="flex items-center gap-4">
          <SignedOut>
            {/* When user is NOT logged in */}
            <SignInButton mode="modal">
              <Button variant="ghost" className="gap-2 font-semibold">
                <LogIn className="h-4 w-4" /> Sign In
              </Button>
            </SignInButton>
            {/* Note: /sign-up route handles by Clerk usually, or redirect to sign-in with mode */}
            {/* Simplified to just use same modal or redirect to /dashboard if clicked */}
          </SignedOut>

          <SignedIn>
            {/* When user IS logged in */}
            <div className="flex items-center gap-4 border-l pl-4">
              <span className="hidden lg:inline text-sm text-slate-500">
                Welcome, {user?.firstName}
              </span>
              {/* Clerk's UserButton handles Profile, Sign Out, and Security settings automatically */}
              <UserButton afterSignOutUrl="/" />
            </div>
          </SignedIn>
        </div>
      </div>
    </nav>
  );
}
