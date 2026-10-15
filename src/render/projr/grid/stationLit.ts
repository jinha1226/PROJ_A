import type { MetaState } from '../sim';
import type { StationId } from '../sim';
export function stationLit(m: MetaState, id: StationId): boolean {
  if (id === 'pod' || id === 'records' || id === 'hatch') return true;
  return m.repairs.includes(id === 'armory' ? 'workbench' : id);
}
