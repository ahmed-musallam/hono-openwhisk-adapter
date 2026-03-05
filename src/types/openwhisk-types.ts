/**
 * OpenWhisk raw HTTP invocation params (when raw-http: true).
 * @see https://github.com/apache/openwhisk/blob/master/docs/actions.md#raw-http-handling
 */
export interface OWRawHttpParams {
  __ow_path?: string;
  __ow_method?: string;
  __ow_query?: string;
  __ow_headers?: Record<string, string>;
  __ow_body?: string;
}

/**
 * OpenWhisk action response shape (for raw-http web actions).
 */
export interface ActionResponse {
  statusCode: number;
  headers?: Record<string, string>;
  body: string;
}

/**
 * Env type with OpenWhisk params in Bindings.
 * Use a generic to make params type-safe: `OpenWhiskParamsEnv<MyParams>` so `c.env.params` is `MyParams`.
 * @default OpenWhiskActionParams - OWRawHttpParams plus any extra keys
 */
export interface OpenWhiskParamsEnv<TParams extends OWRawHttpParams> {
  Variables: {
    params: TParams;
  };
}

export interface AioLoggerLike {
  /*
   * @param {...(object|string)} [data] data to be logged. Prints to the logger with newline. Multiple arguments can be passed, with the first used as the primary message and all additional used as substitution values similar to printf(3) (the arguments are all passed to util.format()).
   */
  error(...data: (object | string)[]): void;
  /** log warn message.
   *
   * @param {...(object|string)} [data] data to be logged. Prints to the logger with newline. Multiple arguments can be passed, with the first used as the primary message and all additional used as substitution values similar to printf(3) (the arguments are all passed to util.format()).
   */
  warn(...data: (object | string)[]): void;
  /** log info message.
   *
   * @param {...(object|string)} [data] data to be logged. Prints to the logger with newline. Multiple arguments can be passed, with the first used as the primary message and all additional used as substitution values similar to printf(3) (the arguments are all passed to util.format()).
   */
  info(...data: (object | string)[]): void;
  /**
   * log message (equivalent to info)
   * @param {...(object|string)} [data] data to be logged. Prints to the logger with newline. Multiple arguments can be passed, with the first used as the primary message and all additional used as substitution values similar to printf(3) (the arguments are all passed to util.format()).
   */
  log(...data: (object | string)[]): void;
  /** log verbose message.
   *
   * @param {...(object|string)} [data] data to be logged. Prints to the logger with newline. Multiple arguments can be passed, with the first used as the primary message and all additional used as substitution values similar to printf(3) (the arguments are all passed to util.format()).
   */
  verbose(...data: (object | string)[]): void;
  /** log debug message.
   *
   * @param {...(object|string)} [data] data to be logged. Prints to the logger with newline. Multiple arguments can be passed, with the first used as the primary message and all additional used as substitution values similar to printf(3) (the arguments are all passed to util.format()).
   */
  debug(...data: (object | string)[]): void;
  /** log silly message.
   *
   * @param {...(object|string)} [data] data to be logged. Prints to the logger with newline. Multiple arguments can be passed, with the first used as the primary message and all additional used as substitution values similar to printf(3) (the arguments are all passed to util.format()).
   */
  silly(...data: (object | string)[]): void;
}
