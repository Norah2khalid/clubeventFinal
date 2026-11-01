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

const ORDINALS = [
  "الأولى",
  "الثانية",
  "الثالثة",
  "الرابعة",
  "الخامسة",
  "السادسة",
  "السابعة",
  "الثامنة",
  "التاسعة",
  "العاشرة",
  "الحادية عشرة",
  "الثانية عشرة",
  "الثالثة عشرة",
  "الرابعة عشرة",
  "الخامسة عشرة",
  "السادسة عشرة",
  "السابعة عشرة",
  "الثامنة عشرة",
  "التاسعة عشرة",
  "العشرون",
];

export function cleanShortText(value: string) {
  return value.replace(/\s+/g, " ").trim().slice(0, 80);
}

export function validShortText(value: string) {
  const text = cleanShortText(value);
  return text.length >= 2 && text.length <= 80;
}

export function cleanStudentName(value: string) {
  return cleanShortText(value);
}

export function validStudentName(value: string) {
  return validShortText(value);
}

const DELETE_CODE_ALPHABET = "abcdefghijkmnpqrstuvwxyz23456789";

export function normalizeDeleteCode(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

export function createDeleteCode() {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return [...bytes]
    .map((byte) => DELETE_CODE_ALPHABET[byte % DELETE_CODE_ALPHABET.length])
    .join("");
}

export function formatDeleteCode(code: string) {
  const normalized = normalizeDeleteCode(code);
  return normalized.match(/.{1,4}/g)?.join("-") ?? normalized;
}

export async function hashDeleteCode(code: string) {
  const normalized = normalizeDeleteCode(code);
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(normalized));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function participationLabel(index: number) {
  const word = ORDINALS[index];
  return word ? `المشاركة ${word}` : `المشاركة رقم ${index + 1}`;
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
