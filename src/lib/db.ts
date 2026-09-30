import { Project, DEFAULT_STYLES } from "../types";
import { sanitizePhrases } from "./captionUtils";
import { currentUserId } from "./supabase";
import { deleteCloudProject, downloadCloudVideo, fetchCloudProjects, upsertCloudProject, uploadCloudVideo } from "./cloud";

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

async function getLocal(id: string): Promise<any> {
  return run("readonly", (store) => store.get(id));
}

async function putLocal(project: Project): Promise<void> {
  await run("readwrite", (store) => store.put(project));
}

/* ------------------------------ cloud sync ------------------------------ */

const syncTimers = new Map<string, number>();
const uploading = new Set<string>();
const uploadFailed = new Set<string>(); // don't retry a failed (e.g. too large) upload on every edit

function scheduleCloudSync(project: Project, userId: string) {
  window.clearTimeout(syncTimers.get(project.id));
  syncTimers.set(
    project.id,
    window.setTimeout(() => {
      syncTimers.delete(project.id);
      syncToCloud(project, userId).catch((err) => console.warn("[cloud] sync failed", err));
    }, 1500)
  );
}

async function syncToCloud(project: Project, userId: string): Promise<void> {
  await upsertCloudProject(project);
  if (project.videoPath || !project.videoBlob || uploading.has(project.id) || uploadFailed.has(project.id)) return;
  uploading.add(project.id);
  try {
    const videoPath = await uploadCloudVideo(userId, project);
    const latest = await getLocal(project.id);
    if (latest) await putLocal({ ...latest, videoPath });
  } catch (err) {
    uploadFailed.add(project.id);
    console.warn("[cloud] video upload failed; captions still sync, the video stays on this device", err);
  } finally {
    uploading.delete(project.id);
  }
}

/* ------------------------------ public API ------------------------------ */

export async function saveProject(project: Project): Promise<void> {
  const userId = await currentUserId();
  let record: Project = { ...project, updatedAt: Date.now() };
  // The editor keeps its own copy of the project; don't let it erase sync info set in the background.
  if (!record.videoPath || !record.ownerId) {
    const existing = await getLocal(project.id).catch(() => null);
    record = { ...record, videoPath: record.videoPath ?? existing?.videoPath, ownerId: record.ownerId ?? existing?.ownerId };
  }
  if (userId && !record.ownerId) record.ownerId = userId;
  const syncs = !!userId && record.ownerId === userId;
  try {
    await putLocal(record);
  } catch (err) {
    // Device storage full: when signed in the cloud copy still keeps the work safe.
    if (!syncs) throw err;
    console.warn("[cloud] could not save on this device; saving to the cloud only", err);
  }
  if (syncs) scheduleCloudSync(record, userId!);
}

/** This browser's projects for the current user, merged with their cloud projects when signed in. */
export async function getProjects(): Promise<Project[]> {
  const userId = await currentUserId();
  const raw = (await run("readonly", (store) => store.getAll())) as unknown[];
  const local = raw
    .map(repairProject)
    .filter((p): p is Project => p !== null)
    .filter((p) => !p.ownerId || p.ownerId === userId);

  let projects = local;
  if (userId) {
    try {
      const cloud = await fetchCloudProjects(userId);
      const byId = new Map(local.map((p) => [p.id, p]));
      for (const remote of cloud) {
        const mine = byId.get(remote.id);
        if (!mine) {
          byId.set(remote.id, repairCloudProject(remote));
        } else if ((remote.updatedAt || 0) > (mine.updatedAt || 0)) {
          // Edited on another device: take its captions, keep this device's video.
          const merged = repairCloudProject({ ...remote, videoBlob: mine.videoBlob });
          byId.set(remote.id, merged);
          await putLocal(merged);
        }
      }
      // Projects made while signed out (or not synced yet) are uploaded to this account.
      const cloudIds = new Set(cloud.map((p) => p.id));
      for (const p of local) {
        if (!cloudIds.has(p.id) || !p.ownerId) {
          const claimed = { ...p, ownerId: userId };
          await putLocal(claimed);
          byId.set(p.id, claimed);
          syncToCloud(claimed, userId).catch((err) => console.warn("[cloud] sync failed", err));
        }
      }
      projects = [...byId.values()];
    } catch (err) {
      console.warn("[cloud] could not load cloud projects; showing this device only", err);
    }
  }
  return projects.sort((a, b) => (b.updatedAt || b.createdAt) - (a.updatedAt || a.createdAt));
}

function repairCloudProject(p: Project): Project {
  return {
    ...p,
    phrases: sanitizePhrases(p.phrases),
    styles: { ...DEFAULT_STYLES, ...(p.styles && typeof p.styles === "object" ? p.styles : {}) },
  };
}

/** Makes sure the project's video is on this device, downloading it from the cloud if needed. */
export async function ensureVideo(project: Project): Promise<Project> {
  if (project.videoBlob instanceof Blob) return project;
  if (!project.videoPath) throw new Error("This video was never uploaded to the cloud, so it only exists on the device that created it.");
  const videoBlob = await downloadCloudVideo(project.videoPath);
  const full = { ...project, videoBlob };
  await putLocal(full);
  return full;
}

export async function deleteProject(project: Project): Promise<void> {
  window.clearTimeout(syncTimers.get(project.id));
  await run("readwrite", (store) => store.delete(project.id));
  if (project.ownerId && project.ownerId === (await currentUserId())) await deleteCloudProject(project);
}
