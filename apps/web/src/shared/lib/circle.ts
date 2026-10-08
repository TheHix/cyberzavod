/**
 * Номер следующего элемента списка, который идёт по кругу: после последнего — снова первый. Так
 * цех проигрывает серию сборок, а журнал заранее грузит ту, что пойдёт следующей.
 * @param {number} index Номер текущего элемента, с нуля.
 * @param {number} count Сколько элементов в списке; больше нуля.
 * @returns {number} Номер следующего элемента, с нуля.
 */
export function nextIndexInCircle(index: number, count: number): number {
  return (index + 1) % count;
}
