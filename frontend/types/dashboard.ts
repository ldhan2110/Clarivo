import type { LucideIcon } from "lucide-react";

export type Stat = { label: string; value: number; icon: LucideIcon; tint: string };

export type RecentProject = { name: string; lastMeeting: string; requirements: number };

export type NextMeeting = { title: string; when: string; pills: string[] };

/** Flip DATA_STATE to exercise the empty / error branches until real data exists. */
export type DataState = "ready" | "empty" | "error";
