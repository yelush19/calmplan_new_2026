// Standalone mode - no Base44 dependency
// Using localStorage-based data layer (can be swapped with Supabase later)
import { entities, auth } from './localDB';

export const base44 = {
  entities,
  auth,
  functions: {},
  integrations: { Core: {} }
};
