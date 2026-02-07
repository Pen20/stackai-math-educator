"use client";

import { useAuth, SignInButton } from "@clerk/nextjs";
import Link from "next/link";
import { FeedbackForm } from "@/components/home/FeedbackForm";
import { Button } from "@/components/ui/button";
import { 
  BarChart3, 
  MessageSquare, 
  SearchCheck, 
  ArrowRight, 
  Sparkles,
  ShieldCheck
} from "lucide-react";

export default function Home() {
  const { isSignedIn } = useAuth();

  return (
    <main className="flex min-h-screen flex-col bg-white">
      {/* Hero Section */}
      <section className="relative flex flex-col items-center justify-center px-6 py-24 text-center md:py-32 overflow-hidden">
        {/* Subtle background decoration */}
        <div className="absolute top-0 -z-10 h-full w-full bg-white">
          <div className="absolute bottom-auto left-auto right-0 top-0 h-[500px] w-[500px] -translate-x-[30%] translate-y-[20%] rounded-full bg-blue-50 opacity-50 blur-[80px]"></div>
        </div>

        <div className="flex items-center gap-2 px-3 py-1 mb-6 text-sm font-medium text-blue-700 bg-blue-50 rounded-full ring-1 ring-inset ring-blue-700/10">
          <Sparkles className="h-4 w-4" />
          <span>Next-Gen Educational Diagnostics</span>
        </div>

        <h1 className="max-w-4xl text-5xl font-extrabold tracking-tight text-slate-900 md:text-7xl">
          Identify Misconceptions with <span className="text-blue-600">Precision.</span>
        </h1>
        
        <p className="max-w-2xl mt-6 text-lg leading-8 text-slate-600">
          STACKAI MATH EDUCATOR transforms student data into actionable insights using 
          Newman’s Error Analysis. Bridge the gap between teaching and understanding 
          with automated diagnostics.
        </p>

        <div className="flex flex-col gap-4 mt-10 sm:flex-row">
          {isSignedIn ? (
            <>
              <Link href="/dashboard">
                <Button size="lg" className="bg-blue-600 hover:bg-blue-700 gap-2 px-8">
                  <BarChart3 className="h-5 w-5" /> View Dashboard
                </Button>
              </Link>
              <Link href="/chatbot">
                <Button size="lg" variant="outline" className="border-blue-600 text-blue-600 hover:bg-blue-50 gap-2 px-8">
                  <MessageSquare className="h-5 w-5" /> Chatbot
                </Button>
              </Link>
            </>
          ) : (
            <SignInButton mode="modal">
              <Button size="lg" className="bg-blue-600 hover:bg-blue-700 gap-2 px-8">
                Get Started Today <ArrowRight className="h-4 w-4" />
              </Button>
            </SignInButton>
          )}
        </div>
      </section>

      {/* Feature Grid */}
      <section className="container mx-auto px-6 py-16 border-t border-slate-100">
        <div className="grid gap-12 md:grid-cols-3">
          <div className="flex flex-col items-start gap-4">
            <div className="p-3 bg-blue-50 rounded-xl text-blue-600">
              <SearchCheck className="h-6 w-6" />
            </div>
            <h3 className="text-xl font-bold text-slate-900">NEA Diagnostics</h3>
            <p className="text-slate-600">
              Automatically categorize errors into Reading, Comprehension, Transformation, 
              Process, and Encoding stages.
            </p>
          </div>

          <div className="flex flex-col items-start gap-4">
            <div className="p-3 bg-emerald-50 rounded-xl text-emerald-600">
              <BarChart3 className="h-6 w-6" />
            </div>
            <h3 className="text-xl font-bold text-slate-900">Performance Tracking</h3>
            <p className="text-slate-600">
              Visualize grade distributions and monitor question difficulty indices 
              in real-time as you upload data.
            </p>
          </div>

          <div className="flex flex-col items-start gap-4">
            <div className="p-3 bg-purple-50 rounded-xl text-purple-600">
              <ShieldCheck className="h-6 w-6" />
            </div>
            <h3 className="text-xl font-bold text-slate-900">Secure & Reliable</h3>
            <p className="text-slate-600">
              Enterprise-grade authentication and cloud-hosted data management 
              powered by Clerk and Convex.
            </p>
          </div>
        </div>
      </section>

      {/* Contact & Feedback Section */}
      <section className="py-16 px-4 bg-slate-50">
        <div className="container mx-auto max-w-4xl">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-slate-900 mb-4">Get in Touch</h2>
            <p className="text-slate-600 max-w-2xl mx-auto">
              Have a question, feedback, or found a bug? We'd love to hear from you. 
              Your input helps us make the STACKAI MATH EDUCATOR better for everyone.
            </p>
          </div>
          <FeedbackForm />
        </div>
      </section>
    </main>
  );
}
