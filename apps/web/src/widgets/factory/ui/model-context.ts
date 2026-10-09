import { createContext, useContext } from "solid-js";
import type { FactoryModel } from "../model/factory.ts";

const FactoryModelContext = createContext<FactoryModel>();

/**
 * Gives the factory model to the components inside it: there is one per factory, and it does not
 * change.
 */
export const FactoryModelProvider = FactoryModelContext.Provider;

/**
 * The model of the factory the component stands in.
 * @returns {FactoryModel} Factory model.
 * @throws {Error} If the component stands outside a factory.
 */
export function useFactoryModel(): FactoryModel {
  const model = useContext(FactoryModelContext);

  if (model === undefined) throw new Error("компонент цеха стоит вне FactoryModelProvider");

  return model;
}
