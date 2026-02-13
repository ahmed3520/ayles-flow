/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as billing from "../billing.js";
import type * as billingMutations from "../billingMutations.js";
import type * as billingQueries from "../billingQueries.js";
import type * as chatMessages from "../chatMessages.js";
import type * as chats from "../chats.js";
import type * as crons from "../crons.js";
import type * as generations from "../generations.js";
import type * as http from "../http.js";
import type * as migrateChatMessages from "../migrateChatMessages.js";
import type * as models from "../models.js";
import type * as projects from "../projects.js";
import type * as testing from "../testing.js";
import type * as todos from "../todos.js";
import type * as uploads from "../uploads.js";
import type * as users from "../users.js";
import type * as versions from "../versions.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  billing: typeof billing;
  billingMutations: typeof billingMutations;
  billingQueries: typeof billingQueries;
  chatMessages: typeof chatMessages;
  chats: typeof chats;
  crons: typeof crons;
  generations: typeof generations;
  http: typeof http;
  migrateChatMessages: typeof migrateChatMessages;
  models: typeof models;
  projects: typeof projects;
  testing: typeof testing;
  todos: typeof todos;
  uploads: typeof uploads;
  users: typeof users;
  versions: typeof versions;
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
