import { describe, expect, it } from "vitest";
import {
  cleanStudentName,
  createDeleteCode,
  formatDeleteCode,
  formatParticipationDate,
  hashDeleteCode,
  normalizeDeleteCode,
  participationLabel,
  participationTitle,
  sectionLabel,
  validShortText,
  validStudentName,
} from "@/lib/participations";

describe("participation title", () => {
  it("requires a real student name and keeps it short", () => {
    expect(validStudentName("  نورة  ")).toBe(true);
    expect(cleanStudentName("  نورة   خالد ")).toBe("نورة خالد");
    expect(validStudentName(" ")).toBe(false);
    expect(validStudentName("ن")).toBe(false);
  });

  it("hashes a delete code without keeping the readable code", async () => {
    const code = createDeleteCode();
    expect(code).toMatch(/^[a-z2-9]{16}$/);
    expect(formatDeleteCode(code)).toBe(code.match(/.{1,4}/g)?.join("-"));
    const hash = await hashDeleteCode(` ${formatDeleteCode(code).toUpperCase()} `);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(hash).not.toContain(code);
    expect(normalizeDeleteCode(formatDeleteCode(code))).toBe(code);
  });

  it("numbers ideas with Arabic ordinals and checks a typed title", () => {
    expect(participationLabel(0)).toBe("المشاركة الأولى");
    expect(participationLabel(5)).toBe("المشاركة السادسة");
    expect(participationLabel(20)).toBe("المشاركة رقم 21");
    expect(validShortText("  عنوان الفكرة  ")).toBe(true);
    expect(validShortText("أ")).toBe(false);
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
