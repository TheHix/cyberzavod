/** API ответил ошибкой: код из тела `{"error": "<код>", "message": "<текст>"}` и статус HTTP. */
export class ApiRequestError extends Error {
  /** Статус ответа HTTP. */
  readonly status: number;
  /** Код ошибки из тела ответа, например `not_found`. */
  readonly code: string;

  /**
   * Создаёт ошибку по ответу API.
   * @param {number} status Статус ответа HTTP.
   * @param {string} code Код ошибки из тела ответа.
   * @param {string} message Текст ошибки для разработчика.
   */
  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

/** Ответ API не того вида, что описан в контракте: поле пропало, не того типа или запись битая. */
export class ApiResponseError extends Error {}
