/**
 * The API responded with an error: the code from the `{"error": "<code>", "message": "<text>"}`
 * body and the HTTP status.
 */
export class ApiRequestError extends Error {
  /** HTTP response status. */
  readonly status: number;
  /** Error code from the response body, for example `not_found`. */
  readonly code: string;

  /**
   * Creates an error from an API response.
   * @param {number} status HTTP response status.
   * @param {string} code Error code from the response body.
   * @param {string} message Error text for the developer.
   */
  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

/** An API response off the contract: a field is missing or of the wrong type, or the record is broken. */
export class ApiResponseError extends Error {}
