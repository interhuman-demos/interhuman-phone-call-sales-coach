/** Static catalog first, then the shared custom-scenario store. Never throws — falls back to Dana. */
import { PERSONAS, getPersona, type Persona } from "../../src/personas.js";
import { findCustomPersona } from "./customStore.js";

export async function resolvePersona(id?: string): Promise<Persona> {
  if (!id) return getPersona();
  const stock = PERSONAS.find((p) => p.id === id);
  if (stock) return stock;
  const custom = await findCustomPersona(id);
  return custom ?? getPersona();
}
