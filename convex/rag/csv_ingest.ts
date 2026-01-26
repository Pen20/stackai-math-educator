"use node";

import { action } from "../_generated/server";
import { internal } from "../_generated/api";
import { RAG } from "@convex-dev/rag";
import { textEmbeddingModel } from "../modelsForDemo";
import { components } from "../_generated/api";
import * as fs from "fs";
import * as path from "path";
// We might need a CSV parser. Since 'questions.csv' was parsed in other files maybe, 
// but here we'll do a simple split or use a library if available. 
// The package.json showed "papaparse" dependency.
import Papa from "papaparse";

const rag = new RAG(components.rag, {
  textEmbeddingModel,
  embeddingDimension: 1536,
});

export const ingestCsv = action({
  // Action to ingest data/predicting_students_errors.csv
  handler: async (ctx) => {
    // Note: In a deployed Convex environment, accessing files outside 'convex/' is limited.
    // However, if the user runs this locally or if the file is bundled, it works.
    // We'll attempt to read from the project root 'data' folder.
    // __dirname in compiled convex is different, so we might need likely locations.
    
    const possiblePaths = [
      path.join(process.cwd(), "data", "predicting_students_errors.csv"),
      path.join(__dirname, "..", "..", "data", "predicting_students_errors.csv"), // If deep in _generated
    ];

    let csvContent = "";
    for (const p of possiblePaths) {
      if (fs.existsSync(p)) {
        csvContent = fs.readFileSync(p, "utf-8");
        break;
      }
    }

    if (!csvContent) {
      throw new Error("Could not find predicting_students_errors.csv in " + possiblePaths.join(", "));
    }

    const parsed = Papa.parse(csvContent, { header: true, skipEmptyLines: true });
    const rows: any[] = parsed.data;

    let count = 0;
    // Chunk processing to avoid timeouts if too large
    // For now, we process the first 500 rows or all if small.
    // The dataset might be large, so we limit or warn.
    const LIMIT = 200; 

    for (const row of rows.slice(0, LIMIT)) {
      if (!row.question || !row.response) continue;

      // Construct a rich text representation for RAG
      const text = \`
Question: \${row.question}
Student Response: \${row.response}
Right Answer: \${row.right_answer}
Error Summary: \${row.error_summary}
Error Category: \${row.error_category}
LLM Analysis: \${row.llm_response}
\`.trim();

      await rag.add(ctx, {
        namespace: "student-misconceptions-csv",
        text: text,
        metadata: {
          studentId: row.student_id,
          grade: parseFloat(row.grade) || 0,
          errorCategory: row.error_category,
        },
      });
      count++;
    }

    return \`Ingested \${count} rows from CSV.\`;
  },
});
