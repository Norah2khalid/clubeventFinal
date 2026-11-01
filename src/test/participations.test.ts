import { describe, expect, it } from "vitest";
import {
  cleanStudentName,
  formatParticipationDate,
  participationTitle,
  sectionLabel,
  validStudentName,
} from "@/lib/participations";

describe("participation title", () => {
  it("requires a real student name and keeps it short", () => {
    expect(validStudentName("  نورة  ")).toBe(true);
    expect(cleanStudentName("  نورة   خالد ")).toBe("نورة خالد");
    expect(validStudentName(" ")).toBe(false);
    expect(validStudentName("ن")).toBe(false);
  });

  it("uses the first non-empty line and keeps the rest out of the title", () => {
    expect(participationTitle("  فكرتي   الخاصة  \nتفاصيل الحل")).toBe("فكرتي الخاصة");
    expect(participationTitle("\n\nالسطر الثاني")).toBe("السطر الثاني");
    expect(participationTitle("   \n")).toBe("");
    expect(participationTitle("أ".repeat(120))).toHaveLength(80);
  });

  it("labels a section from the challenge helper and formats Riyadh time", () => {
    expect(sectionLabel("problem_2")).toBe("رصد ومتابعة انتشار الشائعات على منصة X");
    const instant = "2026-10-31T21:00:00.000Z";
    const zoned = new Intl.DateTimeFormat("ar-SA", {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: "Asia/Riyadh",
    }).format(new Date(instant));
    const local = new Intl.DateTimeFormat("ar-SA", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(instant));
    expect(zoned).not.toBe(local);
    expect(formatParticipationDate(instant)).toBe(zoned);
    expect(formatParticipationDate("not-a-date")).toBe("");
  });
});
