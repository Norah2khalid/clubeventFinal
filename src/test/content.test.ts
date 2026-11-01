import { describe, expect, it } from "vitest";
import {
  CHALLENGE_ONE,
  CHALLENGE_TWO,
  GOALS,
  HELPERS,
  HERO,
  HERO_KICKER,
  IMPACT,
  MECHANISM,
  NAV,
  UI,
} from "@/lib/content";

describe("event copy", () => {
  it("keeps the hero, participation text, and the challenge call to action", () => {
    expect(HERO.title).toBe("ابتكار حلول رقمية لمواجهة التضليل الإعلامي");
    expect(HERO_KICKER).toBe("فعالية النادي التقني في يوم الدراية الإعلامية المعلوماتية");
    expect(HERO.description).toBe(
      "نحو بيئة إعلامية أكثر وعيًا ومصداقية، من خلال ابتكار حلول رقمية تسهم في مواجهة التضليل الإعلامي وتعزيز موثوقية المحتوى",
    );
    expect(MECHANISM.text).toBe(
      "اختر مشكلة واحدة من التحديات المطروحة، وابتكر لها حلًا يدعم جهود وزارة الإعلام في مواجهة التضليل الإعلامي. قدم فكرتك كموقع إلكتروني، أو تطبيق، أو حل رقمي مبتكر قابل للتطبيق",
    );
    expect(UI.explore).toBe("استكشف التحديات");
    expect(UI.openHelper).toBe("المشاركة");
    expect(UI.shareTitle).toBe("شارك فكرتك");
    expect(UI.submitParticipation).toBe("رفع المشاركة");
    expect(UI.copy).toBe("نسخ البرومبت");
    expect(NAV.map((item) => item.label)).toEqual(["آلية المشاركة", "الأهداف"]);
    expect(UI.participationsTitle).toBe("مشاركات الفعالية");
    expect(UI.winnerFirst).toBe("الفكرة الفائزة الأولى");
    expect(UI.winnerSecond).toBe("الفكرة الفائزة الثانية");
  });

  it("lists the four platform problems and the two challenge-two assistants", () => {
    expect(CHALLENGE_ONE.problems.map((problem) => problem.title)).toEqual([
      "اكتشاف المحتوى المشكوك فيه مبكرًا",
      "رصد ومتابعة انتشار الشائعات على منصة X",
      "تسريع وصول التوضيحات الرسمية للجمهور",
      "مساعدة المستخدم للتحقق من صحة المحتوى المنشور",
    ]);
    expect(CHALLENGE_TWO.title).toBe(
      "طوّر تطبيقًا أو مساعدًا ذكيًا يرصد للهيئة العامة لتنظيم الإعلام، الحسابات التي تستغل الأحداث لبث معلومات مضللة.",
    );
    expect(HELPERS.slice(4).map((helper) => helper.title)).toEqual([
      "مساعد تحسين وتطوير التطبيقات",
      "مساعد تحسين وتطوير المساعدات الذكية",
    ]);
  });

  it("keeps goals and impact and drops the faq and old submission form", () => {
    expect(GOALS).toHaveLength(5);
    expect(IMPACT.items).toHaveLength(5);
    const visible = [...NAV.map((item) => item.label), ...Object.values(UI)].join(" ");
    expect(visible).not.toMatch(/الأسئلة الشائعة|اسم المشروع|رابط المشروع|رابط العرض/);
  });
});
