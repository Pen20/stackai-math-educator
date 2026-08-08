"use client";

import { Info, Target, AlertTriangle, CheckCircle2 } from "lucide-react";
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
            <span className="font-semibold text-sm">How to Interpret Difficulty & Discrimination Indices</span>
          </div>
        </AccordionTrigger>
        <AccordionContent className="px-6 pb-6 border-t pt-4">
          <div className="mb-5 p-3 bg-blue-50 border border-blue-200 rounded-lg text-blue-800 text-xs">
            The uploaded dataset stores only grades below 1. For item analysis, every missing student-question record is reconstructed as a fully correct response (grade 1), according to the study dataset design.
          </div>
          <div className="grid md:grid-cols-2 gap-8 mb-6">
            <div className="space-y-2">
              <h4 className="font-bold flex items-center gap-2">
                <Target className="h-4 w-4 text-blue-600" /> Difficulty Index (DI)
              </h4>
              <p className="text-sm text-slate-600">
                Measures how easy or hard a question is based on student performance.
              </p>
              <ul className="text-xs space-y-1 text-slate-500">
                <li>• <b>{"< 0.30"}</b>: Highly difficult (few students succeed)</li>
                <li>• <b>0.30 – 0.70</b>: Moderate difficulty (balanced)</li>
                <li>• <b>{"> 0.70"}</b>: Easy (most students succeed)</li>
              </ul>
            </div>
            
            <div className="space-y-2">
              <h4 className="font-bold flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-600" /> Discrimination Index (DiscI)
              </h4>
              <p className="text-sm text-slate-600">
                Indicates how well a question separates high-performing students from low-performing students.
              </p>
            </div>
          </div>

          <div className="rounded-md border">
            <Table>
              <TableHeader className="bg-slate-50">
                <TableRow>
                  <TableHead className="text-xs">Discrimination Index</TableHead>
                  <TableHead className="text-xs">Interpretation</TableHead>
                  <TableHead className="text-xs">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody className="text-xs">
                <TableRow>
                  <TableCell className="font-medium">≥ 0.40</TableCell>
                  <TableCell>Excellent discrimination</TableCell>
                  <TableCell className="text-emerald-600">Keep; highly reliable</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="font-medium">0.20 – 0.39</TableCell>
                  <TableCell>Good to Fair</TableCell>
                  <TableCell className="text-amber-600">Acceptable; may need revision</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="font-medium">{"< 0.20"}</TableCell>
                  <TableCell>Poor discrimination</TableCell>
                  <TableCell className="text-red-600">Weak; needs redesign</TableCell>
                </TableRow>
                <TableRow className="bg-red-50/50">
                  <TableCell className="font-medium text-red-700">{"< 0.00"}</TableCell>
                  <TableCell className="text-red-700 font-semibold">Flawed Item</TableCell>
                  <TableCell className="text-red-700">Inverse relation; problematic</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>

          <div className="mt-4 flex items-center gap-2 p-3 bg-blue-50 rounded-lg text-blue-800 text-xs">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            <span><b>Tip:</b> Ideally, a good question has moderate difficulty (0.30–0.70) and strong discrimination (≥ 0.30).</span>
          </div>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}
