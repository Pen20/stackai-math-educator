/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as analysis from "../analysis.js";
import type * as chat from "../chat.js";
import type * as documents from "../documents.js";
import type * as feedback from "../feedback.js";
import type * as llm from "../llm.js";
import type * as rag_lib_textSplitter from "../rag/lib/textSplitter.js";
import type * as rag_simple from "../rag/simple.js";
import type * as rag_simpleActions from "../rag/simpleActions.js";
import type * as studentErrors from "../studentErrors.js";
import type * as threads from "../threads.js";
import type * as users from "../users.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  analysis: typeof analysis;
  chat: typeof chat;
  documents: typeof documents;
  feedback: typeof feedback;
  llm: typeof llm;
  "rag/lib/textSplitter": typeof rag_lib_textSplitter;
  "rag/simple": typeof rag_simple;
  "rag/simpleActions": typeof rag_simpleActions;
  studentErrors: typeof studentErrors;
  threads: typeof threads;
  users: typeof users;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
