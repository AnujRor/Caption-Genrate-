import { Project } from "../types";
import { supabase } from "./supabase";

const BUCKET = "videos";

interface ProjectRow {
  id: string;
  name: string;
  phrases: any;
  styles: any;
  detected_language: string | null;
  engine: string | null;
  thumbnail: string | null;
  duration: number | null;
  video_path: string | null;
  created_at: number;
  updated_at: number;
}

function toRow(p: Project) {
  const row: Partial<ProjectRow> = {
    id: p.id,
    name: p.name,
    phrases: p.phrases,
    styles: p.styles,
    detected_language: p.detectedLanguage ?? null,
    engine: p.engine ?? null,
    thumbnail: p.thumbnail ?? null,
    duration: p.duration ?? null,
    created_at: p.createdAt,
    updated_at: p.updatedAt ?? Date.now(),
  };
  // Leave video_path untouched on the server until this device has uploaded the video.
  if (p.videoPath) row.video_path = p.videoPath;
  return row;
}

/** A cloud project whose video hasn't been downloaded to this device yet has no videoBlob. */
function fromRow(r: ProjectRow, userId: string): Project {
  return {
    id: r.id,
    name: r.name,
    phrases: Array.isArray(r.phrases) ? r.phrases : [],
    styles: r.styles ?? {},
    detectedLanguage: r.detected_language ?? undefined,
    engine: r.engine ?? undefined,
    thumbnail: r.thumbnail ?? undefined,
    duration: r.duration ?? undefined,
    videoPath: r.video_path ?? undefined,
    ownerId: userId,
    createdAt: Number(r.created_at),
    updatedAt: Number(r.updated_at),
  };
}

export async function fetchCloudProjects(userId: string): Promise<Project[]> {
  if (!supabase) return [];
  const { data, error } = await supabase.from("projects").select("*");
  if (error) throw error;
  return (data as ProjectRow[]).map((r) => fromRow(r, userId));
}

export async function upsertCloudProject(p: Project): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.from("projects").upsert(toRow(p));
  if (error) throw error;
}

// Supabase's free plan rejects files over 50MB, so bigger videos are stored as numbered parts.
// A split video's videoPath is "<base>#<part count>", with parts at "<base>.part<i>".
const PART_SIZE = 40 * 1024 * 1024;

function partPaths(videoPath: string): string[] {
  const m = videoPath.match(/^(.*)#(\d+)$/);
  if (!m) return [videoPath];
  return Array.from({ length: Number(m[2]) }, (_, i) => `${m[1]}.part${i}`);
}

/** Uploads the video and returns its storage path. */
export async function uploadCloudVideo(userId: string, p: Project): Promise<string> {
  if (!supabase || !p.videoBlob) throw new Error("Nothing to upload");
  const blob = p.videoBlob;
  const base = `${userId}/${p.id}`;
  const count = Math.max(1, Math.ceil(blob.size / PART_SIZE));
  const path = count === 1 ? base : `${base}#${count}`;
  const contentType = blob.type || "video/mp4";
  const paths = partPaths(path);
  for (let i = 0; i < paths.length; i++) {
    const part = count === 1 ? blob : blob.slice(i * PART_SIZE, (i + 1) * PART_SIZE, contentType);
    const { error } = await supabase.storage.from(BUCKET).upload(paths[i], part, { upsert: true, contentType });
    if (error) throw error;
  }
  const { error: rowError } = await supabase.from("projects").update({ video_path: path }).eq("id", p.id);
  if (rowError) throw rowError;
  return path;
}

export async function downloadCloudVideo(path: string): Promise<Blob> {
  if (!supabase) throw new Error("Cloud sync is not configured");
  const parts: Blob[] = [];
  for (const partPath of partPaths(path)) {
    const { data, error } = await supabase.storage.from(BUCKET).download(partPath);
    if (error) throw error;
    parts.push(data);
  }
  return parts.length === 1 ? parts[0] : new Blob(parts, { type: parts[0].type || "video/mp4" });
}

export async function deleteCloudProject(p: Pick<Project, "id" | "videoPath">): Promise<void> {
  if (!supabase) return;
  if (p.videoPath) await supabase.storage.from(BUCKET).remove(partPaths(p.videoPath));
  const { error } = await supabase.from("projects").delete().eq("id", p.id);
  if (error) throw error;
}
