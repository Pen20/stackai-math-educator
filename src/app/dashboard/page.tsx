"use client";

import React, { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { useUser } from "@clerk/nextjs";
import { api } from "../../../convex/_generated/api";
import { 
  LayoutDashboard, Target, FolderOpen, TrendingUp, 
  PieChart as PieChartIcon, Info, Search, FileUp,
  BookText, BrainCircuit, RefreshCw, Settings, PenTool,
  BarChart3, AlertCircle
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion";
import Link from "next/link";

import GradeDistribution from "@/components/dashboard/GradeDistribution";
import NEAPieChart from "@/components/dashboard/NEAPieChart";
import IndicesChart from "@/components/dashboard/IndicesChart";
import { CSVUploader } from "@/components/dashboard/CSVUploader";
import IndicesGuide from "@/components/dashboard/IndicesGuide";

export default function Dashboard() {
  const [showGradeDist, setShowGradeDist] = useState(false);
  const [showPieChart, setShowPieChart] = useState(false);
  const [showIndices, setShowIndices] = useState(false);
  // No longer needed: const [showSimpleRAG, setShowSimpleRAG] = useState(false);
  const [selectedQuestion, setSelectedQuestion] = useState<string>("");
  const [filterGradeByQuestion, setFilterGradeByQuestion] = useState(false);

  const { isLoaded, isSignedIn } = useUser();

  // Adapted to match existing API structure: api.studentErrors.getVisibleErrors
  const analysisData = useQuery(api.studentErrors.getVisibleErrors) || [];
  // Adapted to match existing API structure: api.users.updateUserActivity
  const trackVisit = useMutation(api.users.updateUserActivity);

  React.useEffect(() => {
    if (isLoaded && isSignedIn) {
       trackVisit({ resource: "Dashboard" });
    }
  }, [isLoaded, isSignedIn, trackVisit]);

  const questions = Array.from(new Set(analysisData
    .map((d: any) => d.question)
    .filter((q: string) => q && q.trim() !== "")
  ));

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 bg-slate-50/30 min-h-screen">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-600 rounded-lg">
            <LayoutDashboard className="text-white h-6 w-6" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Educational Feedback Analysis
          </h1>
        </div>
        <CSVUploader />
      </header>

      {/* Purpose & Instructions Section */}
      <div className="grid md:grid-cols-3 gap-4">
        <Card className="bg-white shadow-sm border-slate-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2 text-slate-600">
              <Target className="h-4 w-4 text-blue-500" /> Core Objectives
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-slate-500">
            Analyze distributions and evaluate question difficulty/discrimination indices.
          </CardContent>
        </Card>
        <Card className="bg-white shadow-sm border-slate-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2 text-slate-600">
              <FolderOpen className="h-4 w-4 text-amber-500" /> Dataset Access
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-slate-500">
            Currently using <code>predicting_students_errors.csv</code> for demonstration.
          </CardContent>
        </Card>
        <Card className="bg-white shadow-sm border-slate-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2 text-slate-600">
              <Search className="h-4 w-4 text-emerald-500" /> Insight Logic
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-slate-500">
            Identify patterns using Newman’s Error Analysis (NEA) categories.
          </CardContent>
        </Card>
      </div>

      {/* Visualization Controls */}
      <div className="flex flex-wrap items-center gap-4 bg-white p-4 rounded-xl border border-slate-200">
        <Button 
          variant={showGradeDist ? "default" : "secondary"}
          onClick={() => setShowGradeDist(!showGradeDist)}
          className="gap-2"
        >
          <TrendingUp className="h-4 w-4" /> Grade Distribution
        </Button>
        
        <Select onValueChange={setSelectedQuestion} value={selectedQuestion}>
          <SelectTrigger className="w-[280px]">
            <SelectValue placeholder="Select a question..." />
          </SelectTrigger>
          <SelectContent>
            {questions.map((q) => <SelectItem key={q as string} value={q as string}>{q as string}</SelectItem>)}
          </SelectContent>
        </Select>

        <Button 
          variant={showPieChart ? "default" : "secondary"}
          onClick={() => setShowPieChart(!showPieChart)}
          className="gap-2"
          disabled={!selectedQuestion}
        >
          <PieChartIcon className="h-4 w-4" /> NEA Pie Chart
        </Button>

        <Button 
          variant={showIndices ? "default" : "secondary"}
          onClick={() => setShowIndices(!showIndices)}
          className="gap-2"
        >
          <BarChart3 className="h-4 w-4" /> Question Indices
        </Button>

        <Link href="/chatbot">
          <Button 
            variant="secondary"
            className="gap-2 border-indigo-200 hover:border-indigo-400 hover:bg-indigo-50"
          >
            <BrainCircuit className="h-4 w-4 text-indigo-500" /> Go to AI Chatbot
          </Button>
        </Link>
      </div>

      {/* Main Content Area */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {showGradeDist && (
          <Card className="shadow-md">
            <CardHeader className="border-b pb-4 flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-blue-600" /> 
                Performance Spread {filterGradeByQuestion && selectedQuestion ? `for ${selectedQuestion}` : "(All Questions)"}
              </CardTitle>
              {selectedQuestion && (
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => setFilterGradeByQuestion(!filterGradeByQuestion)}
                  className="text-xs h-8"
                >
                  {filterGradeByQuestion ? "Show Global" : "Filter by Question"}
                </Button>
              )}
            </CardHeader>
            <CardContent className="h-[350px] pt-6">
              <GradeDistribution 
                data={analysisData} 
                question={filterGradeByQuestion ? selectedQuestion : undefined} 
              />
            </CardContent>
          </Card>
        )}

        {showPieChart && selectedQuestion && (
          <Card className="shadow-md">
            <CardHeader className="border-b pb-4">
              <CardTitle className="flex items-center gap-2">
                <PieChartIcon className="h-5 w-5 text-emerald-600" /> Error Type Breakdown
              </CardTitle>
            </CardHeader>
            <CardContent className="h-[350px] pt-6">
              <NEAPieChart data={analysisData} question={selectedQuestion} />
            </CardContent>
          </Card>
        )}

        {showIndices && (
          <Card className="shadow-md col-span-1 lg:col-span-2">
            <CardHeader className="border-b pb-4">
              <CardTitle className="flex items-center gap-2">
                <Target className="h-5 w-5 text-indigo-600" /> Question Analysis (Ranked)
              </CardTitle>
            </CardHeader>
            <CardContent className="h-[400px] pt-6">
              <IndicesChart />
            </CardContent>
          </Card>
        )}
        
        {showIndices && (
          <div className="col-span-1 lg:col-span-2">
            <IndicesGuide />
          </div>
        )}
      </div>

      {/* Interpretation Guide (Replaces Emojis with Lucide Icons) */}
      <Accordion type="single" collapsible className="w-full bg-white border rounded-xl overflow-hidden">
        <AccordionItem value="nea-interpretation" className="border-none">
          <AccordionTrigger className="px-6 hover:no-underline hover:bg-slate-50">
            <div className="flex items-center gap-2 text-slate-700">
              <Info className="h-4 w-4 text-blue-500" />
              <span>NEA Error Category Interpretation Guide</span>
            </div>
          </AccordionTrigger>
          <AccordionContent className="px-6 pb-6 border-t pt-4">
            <div className="grid md:grid-cols-3 gap-6">
              <div className="space-y-2">
                <h4 className="font-semibold flex items-center gap-2 text-slate-900">
                  <BookText className="h-4 w-4 text-orange-500" /> Reading Error
                </h4>
                <p className="text-sm text-slate-500 leading-relaxed">
                  Misreading or misinterpreting text/symbols. Identifying components correctly.
                </p>
              </div>
              <div className="space-y-2">
                <h4 className="font-semibold flex items-center gap-2 text-slate-900">
                  <BrainCircuit className="h-4 w-4 text-purple-500" /> Comprehension Error
                </h4>
                <p className="text-sm text-slate-500 leading-relaxed">
                  Reads correctly but fails to grasp the meaning or underlying logic.
                </p>
              </div>
              <div className="space-y-2">
                <h4 className="font-semibold flex items-center gap-2 text-slate-900">
                  <RefreshCw className="h-4 w-4 text-indigo-500" /> Transformation Error
                </h4>
                <p className="text-sm text-slate-500 leading-relaxed">
                  Failure to convert the understood problem into a mathematical representation.
                </p>
              </div>
              <div className="space-y-2">
                <h4 className="font-semibold flex items-center gap-2 text-slate-900">
                  <Settings className="h-4 w-4 text-slate-600" /> Process Skills Error
                </h4>
                <p className="text-sm text-slate-500 leading-relaxed">
                  Calculation or procedural mistakes despite correct setup.
                </p>
              </div>
              <div className="space-y-2">
                <h4 className="font-semibold flex items-center gap-2 text-slate-900">
                  <PenTool className="h-4 w-4 text-emerald-600" /> Encoding Error
                </h4>
                <p className="text-sm text-slate-500 leading-relaxed">
                  Correct solution reached but expressed incorrectly (units, notation).
                </p>
              </div>
              <div className="flex items-center p-4 bg-blue-50 rounded-lg gap-3">
                <AlertCircle className="h-8 w-8 text-blue-600 shrink-0" />
                <p className="text-xs text-blue-800 font-medium">
                  Use these insights to target specific teaching interventions rather than just scoring.
                </p>
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  );
}
