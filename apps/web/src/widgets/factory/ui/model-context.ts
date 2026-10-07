import { createContext, useContext } from "solid-js";
import type { FactoryModel } from "../model/factory.ts";

const FactoryModelContext = createContext<FactoryModel>();

/** Отдаёт модель цеха компонентам внутри него: она одна на цех и не меняется. */
export const FactoryModelProvider = FactoryModelContext.Provider;

/**
 * Модель цеха, внутри которого стоит компонент.
 * @returns {FactoryModel} Модель цеха.
 * @throws {Error} Если компонент стоит вне цеха.
 */
export function useFactoryModel(): FactoryModel {
  const model = useContext(FactoryModelContext);

  if (model === undefined) throw new Error("компонент цеха стоит вне FactoryModelProvider");

  return model;
}
