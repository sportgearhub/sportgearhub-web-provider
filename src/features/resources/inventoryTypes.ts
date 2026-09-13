import type { ResourceUnit } from '../../types';

export type UnitForm = {
  unitId?: string;
  inventoryCode: string;
  notes: string;
  status: string;
  conditionStatus: string;
  externalReferenceCode: string;
};

export function emptyUnitForm(): UnitForm {
  return {
    inventoryCode: '',
    notes: '',
    status: 'available',
    conditionStatus: 'ready',
    externalReferenceCode: '',
  };
}

export function unitToForm(unit: ResourceUnit): UnitForm {
  return {
    unitId: unit.unitId,
    inventoryCode: unit.inventoryCode ?? '',
    notes: unit.notes ?? '',
    status: unit.status || 'available',
    conditionStatus: unit.conditionStatus || 'ready',
    externalReferenceCode: unit.externalReferenceCode ?? '',
  };
}
