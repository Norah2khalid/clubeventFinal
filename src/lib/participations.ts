import { HELPERS } from "@/lib/content";

export type Participation = {
  id: string;
  title: string;
  body: string;
  section: string;
  student_name: string;
  winner_rank: number | null;
  created_at: string;
};

export function cleanStudentName(value: string) {
  return value.replace(/\s+/g, " ").trim().slice(0, 80);
}

export function validStudentName(value: string) {
  const name = cleanStudentName(value);
  return name.length >= 2 && name.length <= 80;
}

export function participationTitle(body: string) {
  const line = body
    .replace(/\r/g, "")
    .trim()
    .split("\n")
    .map((part) => part.replace(/\s+/g, " ").trim())
    .find((part) => part.length > 0);
  return (line ?? "").slice(0, 80);
}

export function sectionLabel(section: string) {
  return HELPERS.find((helper) => helper.id === section)?.title ?? section;
}

export function formatParticipationDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("ar-SA", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Riyadh",
  }).format(date);
}
