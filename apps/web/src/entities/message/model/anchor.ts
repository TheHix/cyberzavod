/**
 * Якорь реплики в журнале: по нему «подробнее» над цехом находит нужную запись.
 * @param {number} index Номер реплики в записи, с нуля.
 * @returns {string} id элемента журнала, например `message-1` для первой реплики.
 */
export function messageAnchor(index: number): string {
  return `message-${index + 1}`;
}
