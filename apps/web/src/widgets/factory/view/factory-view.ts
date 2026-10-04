import type { FactoryLayout, Point, Scene } from "@cyberzavod/core";

/** Точка в координатах контейнера цеха, CSS-пиксели от его левого верхнего угла. */
export interface ScreenPoint {
  readonly x: number;
  readonly y: number;
}

/**
 * Представление цеха — как выглядят пол, станки, рабочие и деталь. Проигрыватель знает
 * только этот интерфейс, поэтому графику можно заменить целиком (фигуры, спрайты, 3D),
 * не трогая ядро, проигрывание и интерфейс над цехом.
 */
export interface FactoryView {
  /** Встраивает холст в контейнер и рисует неподвижный план цеха. */
  mount(container: HTMLElement, layout: FactoryLayout): Promise<void>;
  /** Рисует кадр сцены. */
  render(scene: Scene): void;
  /** Подстраивается под новый размер контейнера, CSS-пиксели. */
  resize(width: number, height: number): void;
  /** Переводит точку плана в координаты контейнера — для HTML поверх холста. */
  toScreen(point: Point): ScreenPoint;
  /** Освобождает холст и память видеокарты. */
  destroy(): void;
}

/**
 * Загружает представление цеха, которое показывает сайт. Код графики приходит отдельным
 * файлом и только в браузере; чтобы сменить графику, достаточно вернуть здесь другую
 * реализацию FactoryView.
 * @returns {Promise<FactoryView>} Представление, ещё не встроенное в страницу.
 */
export async function loadFactoryView(): Promise<FactoryView> {
  const { ShapesView } = await import("./shapes/shapes-view.ts");
  return new ShapesView();
}
