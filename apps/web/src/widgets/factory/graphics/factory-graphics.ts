import type { FactoryLayout, Point, Scene } from "@cyberzavod/core";

/** Точка в координатах контейнера цеха, CSS-пиксели от его левого верхнего угла. */
export interface ScreenPoint {
  readonly x: number;
  readonly y: number;
}

/** Прямоугольник в координатах контейнера: поле, свободное от меню и HUD, куда встаёт план. */
export interface Frame extends ScreenPoint {
  readonly width: number;
  readonly height: number;
}

/**
 * Графика цеха — как выглядят пол, станки, рабочие и деталь. Модель и интерфейс над цехом
 * знают только этот интерфейс, поэтому графику можно заменить целиком (пиксели, фигуры, 3D),
 * не трогая ядро, модель и компоненты.
 */
export interface FactoryGraphics {
  /** Встраивает холст в контейнер и рисует неподвижный план цеха. */
  mount(container: HTMLElement, layout: FactoryLayout): Promise<void>;
  /**
   * Заменяет неподвижный план — пол, станки, кабинет. Рабочие, мастер и деталь остаются.
   * Вписывает новый план в поле следующий `resize`: до него масштаб остаётся от прежнего плана.
   */
  setLayout(layout: FactoryLayout): void;
  /** Рисует кадр сцены. */
  render(scene: Scene): void;
  /**
   * Подстраивается под размер контейнера (CSS-пиксели): пол — на весь контейнер,
   * план — вписан в поле `frame`.
   */
  resize(width: number, height: number, frame: Frame): void;
  /** Переводит точку плана в координаты контейнера — для HTML поверх холста. */
  toScreen(point: Point): ScreenPoint;
  /** Освобождает холст и память видеокарты. */
  destroy(): void;
}

/**
 * Загружает графику цеха, которую показывает сайт. Её код приходит отдельным файлом и только
 * в браузере; чтобы сменить графику, достаточно вернуть здесь другую реализацию FactoryGraphics.
 * @returns {Promise<FactoryGraphics>} Графика, ещё не встроенная в страницу.
 */
export async function loadFactoryGraphics(): Promise<FactoryGraphics> {
  const { PixelGraphics } = await import("./pixel/pixel-graphics.ts");
  return new PixelGraphics();
}
