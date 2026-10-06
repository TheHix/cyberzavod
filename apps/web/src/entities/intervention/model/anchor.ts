/**
 * Якорь вмешательства в журнале: по нему «подробнее» над цехом находит нужную запись.
 * @param {number} index Номер вмешательства в записи, с нуля.
 * @returns {string} id элемента журнала, например `intervention-1` для первого вмешательства.
 */
export function interventionAnchor(index: number): string {
  return `intervention-${index + 1}`;
}
