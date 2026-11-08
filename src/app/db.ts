import Dexie, { type Table } from 'dexie';
import type { Case, StoredBlob } from '../types';

export interface SettingsRow {
  key: string;
  value: unknown;
}

export class AppDB extends Dexie {
  cases!: Table<Case, string>;
  blobs!: Table<StoredBlob, string>;
  settings!: Table<SettingsRow, string>;

  constructor() {
    super('umai-hanashi-check');
    this.version(1).stores({
      cases: 'id, updatedAt, createdAt',
      blobs: 'id, caseId, itemId',
      settings: 'key',
    });
  }
}

export const db = new AppDB();
