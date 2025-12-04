
import { FamilyMember } from "../types";

const DB_NAME = 'NiyakanDB';
const DB_VERSION = 1;
const STORE_NAME = 'familyTrees';

// Configuration Keys
const STORAGE_KEY_MODE = 'niyakan_db_mode'; // 'local' or 'remote'
const STORAGE_KEY_URL = 'niyakan_api_url';

export type DbMode = 'local' | 'remote';

export const dbService = {
  // --- CONFIGURATION METHODS ---
  getMode: (): DbMode => {
    return (localStorage.getItem(STORAGE_KEY_MODE) as DbMode) || 'local';
  },

  setMode: (mode: DbMode) => {
    localStorage.setItem(STORAGE_KEY_MODE, mode);
  },

  getApiUrl: (): string => {
    return localStorage.getItem(STORAGE_KEY_URL) || 'http://localhost:5000/api/tree';
  },

  setApiUrl: (url: string) => {
    localStorage.setItem(STORAGE_KEY_URL, url);
  },

  // --- INDEXED DB (LOCAL) ---
  openLocalDB: (): Promise<IDBDatabase> => {
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

  saveToLocal: async (treeData: FamilyMember): Promise<void> => {
    const db = await dbService.openLocalDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.put({ id: 'current_tree', data: treeData, updatedAt: new Date().toISOString() });
      request.onsuccess = () => resolve();
      request.onerror = () => reject("Error saving locally");
    });
  },

  loadFromLocal: async (): Promise<FamilyMember | null> => {
    const db = await dbService.openLocalDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get('current_tree');
      request.onsuccess = () => {
        resolve(request.result ? request.result.data : null);
      };
      request.onerror = () => reject("Error loading locally");
    });
  },

  // --- REMOTE API (MONGODB VIA BACKEND) ---
  saveToRemote: async (treeData: FamilyMember): Promise<void> => {
    const url = dbService.getApiUrl();
    try {
        const response = await fetch(url, {
            method: 'POST', // or PUT depending on backend
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                id: 'current_tree', // Or a user ID
                data: treeData
            })
        });

        if (!response.ok) {
            throw new Error(`Server error: ${response.status}`);
        }
    } catch (error) {
        console.error("Remote Save Failed:", error);
        throw error;
    }
  },

  loadFromRemote: async (): Promise<FamilyMember | null> => {
      const url = dbService.getApiUrl();
      try {
          const response = await fetch(url);
          if (!response.ok) {
              // If 404, implies no tree exists yet, return null
              if(response.status === 404) return null;
              throw new Error(`Server error: ${response.status}`);
          }
          const json = await response.json();
          // Assuming backend returns { data: FamilyMember, ... } or just FamilyMember
          return json.data || json; 
      } catch (error) {
          console.error("Remote Load Failed:", error);
          throw error;
      }
  },

  // --- UNIFIED INTERFACE ---
  saveTree: async (treeData: FamilyMember): Promise<void> => {
    const mode = dbService.getMode();
    if (mode === 'remote') {
        return dbService.saveToRemote(treeData);
    } else {
        return dbService.saveToLocal(treeData);
    }
  },

  loadTree: async (): Promise<FamilyMember | null> => {
    const mode = dbService.getMode();
    if (mode === 'remote') {
        return dbService.loadFromRemote();
    } else {
        return dbService.loadFromLocal();
    }
  },

  testConnection: async (url: string): Promise<boolean> => {
      try {
          // Attempt a HEAD request or a simple GET to see if server is alive
          const response = await fetch(url, { method: 'GET', headers: { 'Accept': 'application/json'} });
          return response.status !== 500 && response.status !== 503; // Basic availability check
      } catch (e) {
          return false;
      }
  }
};
