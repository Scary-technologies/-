
import { FamilyMember } from "../types";

const DB_NAME = 'NiyakanDB';
const DB_VERSION = 1;
const STORE_NAME = 'familyTrees';

export const dbService = {
  openDB: (): Promise<IDBDatabase> => {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = (event) => reject("Database error: " + (event.target as IDBOpenDBRequest).error);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        }
      };

      request.onsuccess = (event) => {
        resolve((event.target as IDBOpenDBRequest).result);
      };
    });
  },

  saveTree: async (treeData: FamilyMember): Promise<void> => {
    const db = await dbService.openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      // Always save with a fixed ID for the main tree, or dynamic for multiple slots
      const request = store.put({ id: 'current_tree', data: treeData, updatedAt: new Date().toISOString() });

      request.onsuccess = () => resolve();
      request.onerror = () => reject("Error saving tree");
    });
  },

  loadTree: async (): Promise<FamilyMember | null> => {
    const db = await dbService.openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get('current_tree');

      request.onsuccess = () => {
        if (request.result) {
          resolve(request.result.data);
        } else {
          resolve(null);
        }
      };
      request.onerror = () => reject("Error loading tree");
    });
  }
};