/*
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import type { z } from "zod";

/**
 * Builds a ParamsValidator from a Zod schema for OpenWhisk raw HTTP params.
 * Use with ToOpenWhiskAction for schema-based validation; throws on invalid params.
 *
 * @example
 * import { z } from "zod";
 * import { ToOpenWhiskAction, zodValidator } from "hono-openwhisk-adapter";
 * const schema = z.object({ __ow_path: z.string().optional(), userId: z.string() });
 * export const main = ToOpenWhiskAction(app, zodValidator(schema));
 */
export function zodOwParamsValidator(schema: z.ZodSchema) {
  return (params: unknown): void => {
    const result = schema.safeParse(params);
    if (!result.success) {
      throw new Error(result.error.message);
    }
  };
}
