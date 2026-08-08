"use client";

import { AlertTriangle, CheckCircle2, Info, Target } from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export default function IndicesGuide() {
  return (
    <Accordion type="single" collapsible className="w-full bg-white border rounded-xl overflow-hidden shadow-sm">
      <AccordionItem value="guide" className="border-none">
        <AccordionTrigger className="px-6 hover:no-underline hover:bg-slate-50">
          <div className="flex items-center gap-2 text-slate-700">
            <Info className="h-4 w-4 text-blue-500" />
            <span className="font-semibold text-sm">How to Interpret Item Facility &amp; Discrimination Indices</span>
          </div>
        </AccordionTrigger>
        <AccordionContent className="px-6 pb-6 border-t pt-4">
          <div className="mb-5 p-3 bg-blue-50 border border-blue-200 rounded-lg text-blue-800 text-xs space-y-1">
            <p>The uploaded dataset contains only incorrect and partially correct responses (grade below 1).</p>
            <p>For item analysis, missing student-question records are reconstructed as fully correct responses (grade 1). The saved total cohort also adds students who have no error rows at all.</p>
          </div>

          <div className="grid md:grid-cols-2 gap-8 mb-6">
            <div className="space-y-2">
              <h4 className="font-bold flex items-center gap-2">
                <Target className="h-4 w-4 text-blue-600" /> Item Facility Index (reported as Difficulty Index)
              </h4>
              <p className="text-sm text-slate-600">
                Mean reconstructed question score divided by the maximum score. Because STACK grades use a 0-1 scale, this is the mean score across the complete cohort.
              </p>
              <p className="text-xs font-mono bg-slate-50 border rounded px-2 py-1.5">P = sum of reconstructed item scores / total cohort</p>
              <ul className="text-xs space-y-1 text-slate-500">
                <li>• <b>{"< 0.30"}</b>: difficult; low average item score</li>
                <li>• <b>0.30-0.70</b>: moderate facility</li>
                <li>• <b>{"> 0.70"}</b>: easier; high average item score</li>
              </ul>
              <p className="text-xs text-slate-500">A value of 0.58 means a mean score of 0.58 out of 1, not necessarily that 58% answered fully correctly.</p>
            </div>

            <div className="space-y-2">
              <h4 className="font-bold flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-600" /> Discrimination Index (DiscI)
              </h4>
              <p className="text-sm text-slate-600">
                Difference between the selected question&apos;s mean score in the upper and lower 27% groups.
              </p>
              <p className="text-xs font-mono bg-slate-50 border rounded px-2 py-1.5">DiscI = upper-group item mean - lower-group item mean</p>
              <p className="text-xs text-slate-500">
                For each question, students are ranked using their reconstructed mean on all other questions. Excluding the analysed question avoids part-whole inflation.
              </p>
            </div>
          </div>

          <div className="rounded-md border">
            <Table>
              <TableHeader className="bg-slate-50">
                <TableRow>
                  <TableHead className="text-xs">Discrimination Index</TableHead>
                  <TableHead className="text-xs">Interpretation</TableHead>
                  <TableHead className="text-xs">Suggested review</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody className="text-xs">
                <TableRow>
                  <TableCell className="font-medium">≥ 0.40</TableCell>
                  <TableCell>Strong positive discrimination</TableCell>
                  <TableCell className="text-emerald-600">Generally functioning well; review with other evidence</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="font-medium">0.30-0.39</TableCell>
                  <TableCell>Good positive discrimination</TableCell>
                  <TableCell className="text-emerald-700">Usually acceptable</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="font-medium">0.20-0.29</TableCell>
                  <TableCell>Fair discrimination</TableCell>
                  <TableCell className="text-amber-600">Inspect wording, scoring, and seed patterns</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="font-medium">0.00-0.19</TableCell>
                  <TableCell>Weak discrimination</TableCell>
                  <TableCell className="text-red-600">Review the item and scoring evidence</TableCell>
                </TableRow>
                <TableRow className="bg-red-50/50">
                  <TableCell className="font-medium text-red-700">{"< 0.00"}</TableCell>
                  <TableCell className="text-red-700 font-semibold">Negative discrimination</TableCell>
                  <TableCell className="text-red-700">Investigate scoring, wording, content, and seed variants</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>

          <div className="mt-4 flex items-start gap-2 p-3 bg-blue-50 rounded-lg text-blue-800 text-xs">
            <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
            <span>Interpret both indices with cohort size, item content, sample size, partial-credit scoring, and other validity evidence. The thresholds are review guidelines, not automatic decisions to retain or remove a question.</span>
          </div>
          <div className="mt-4 text-[11px] leading-relaxed text-slate-500">
            <span className="font-semibold text-slate-600">Methodological sources: </span>
            partial-credit facility follows{" "}
            <a className="underline hover:text-blue-600" href="https://nces.ed.gov/nationsreportcard/tdw/analysis/initial_classical_poly.aspx" target="_blank" rel="noreferrer">
              NAEP classical item-analysis guidance
            </a>
            ; upper/lower 27% grouping follows{" "}
            <a className="underline hover:text-blue-600" href="https://doi.org/10.1037/h0057123" target="_blank" rel="noreferrer">
              Kelley (1939)
            </a>
            ; discrimination interpretation guidelines are adapted from{" "}
            <a className="underline hover:text-blue-600" href="https://doi.org/10.1177/001316445401400215" target="_blank" rel="noreferrer">
              Ebel (1954)
            </a>
            {" "}and Ebel and Frisbie (1991). Thresholds are heuristic and should be interpreted in context.
          </div>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}
