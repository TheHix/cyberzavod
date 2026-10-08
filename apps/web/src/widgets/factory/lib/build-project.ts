/**
 * Проект сборки в HUD: название и адрес, если есть куда вести, — страница проекта (`ProjectLink`)
 * или галерея автора записи; у записи из закрытой галереи адреса нет.
 */
export interface BuildProject {
  readonly name: string;
  readonly url: string | undefined;
}
