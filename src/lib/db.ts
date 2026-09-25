import { Project, DEFAULT_STYLES } from "../types";
import { sanitizePhrases } from "./captionUtils";

const DB_NAME = "AutoCaptionDB";
const STORE_NAME = "projects";
const DB_VERSION = 1;

let dbPromise: Promise<IDBDatabase> | null = null;

export function getDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("This browser does not support local storage for videos."));
      return;
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "id" });
      }
    };
    request.onsuccess = () => {
      const db = request.result;
      db.onversionchange = () => {
        db.close();
        dbPromise = null;
      };
      // Browsers (notably Safari) can drop the connection in the background; reopen on next use.
      db.onclose = () => {
        dbPromise = null;
      };
      resolve(db);
    };
    request.onerror = () => {
      dbPromise = null;
      reject(request.error);
    };
    request.onblocked = () => {
      dbPromise = null;
      reject(new Error("Storage is busy in another tab. Close other tabs of this app and try again."));
    };
  });
  return dbPromise;
}

function runOnce<T>(mode: IDBTransactionMode, op: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return getDB().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, mode);
        const request = op(tx.objectStore(STORE_NAME));
        tx.oncomplete = () => resolve(request.result);
        tx.onerror = () => reject(tx.error || request.error);
        tx.onabort = () => reject(tx.error || new Error("Storage transaction aborted"));
      })
  );
}

// Self-healing: if the connection went stale, drop it and retry once on a fresh one.
async function run<T>(mode: IDBTransactionMode, op: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  try {
    return await runOnce(mode, op);
  } catch (err) {
    if ((err as DOMException)?.name === "QuotaExceededError") throw err;
    dbPromise = null;
    return runOnce(mode, op);
  }
}

/** Fills in anything missing from records saved by older versions or interrupted writes. */
function repairProject(raw: any): Project | null {
  if (!raw || typeof raw.id !== "string" || !(raw.videoBlob instanceof Blob)) return null;
  return {
    ...raw,
    name: typeof raw.name === "string" && raw.name.trim() ? raw.name : "Untitled video",
    phrases: sanitizePhrases(raw.phrases),
    styles: { ...DEFAULT_STYLES, ...(raw.styles && typeof raw.styles === "object" ? raw.styles : {}) },
    createdAt: Number.isFinite(raw.createdAt) ? raw.createdAt : Date.now(),
  };
}

export async function saveProject(project: Project): Promise<void> {
  await run("readwrite", (store) => store.put({ ...project, updatedAt: Date.now() }));
}

export async function getProjects(): Promise<Project[]> {
  const raw = (await run("readonly", (store) => store.getAll())) as unknown[];
  const projects = raw.map(repairProject).filter((p): p is Project => p !== null);
  return projects.sort((a, b) => (b.updatedAt || b.createdAt) - (a.updatedAt || a.createdAt));
}

export async function deleteProject(id: string): Promise<void> {
  await run("readwrite", (store) => store.delete(id));
}
