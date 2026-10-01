/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as auth from "../auth.js";
import type * as crons from "../crons.js";
import type * as data from "../data.js";
import type * as eloCalculation from "../eloCalculation.js";
import type * as http from "../http.js";
import type * as live from "../live.js";
import type * as migration from "../migration.js";
import type * as passkeySecurity from "../passkeySecurity.js";
import type * as passkeyStore from "../passkeyStore.js";
import type * as passkeys from "../passkeys.js";
import type * as rehearsal from "../rehearsal.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  auth: typeof auth;
  crons: typeof crons;
  data: typeof data;
  eloCalculation: typeof eloCalculation;
  http: typeof http;
  live: typeof live;
  migration: typeof migration;
  passkeySecurity: typeof passkeySecurity;
  passkeyStore: typeof passkeyStore;
  passkeys: typeof passkeys;
  rehearsal: typeof rehearsal;
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
