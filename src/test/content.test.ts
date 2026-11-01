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
    expect(UI.externalParticipation).toBe("المشاركة خارج الموقع عبر الباركود.");
    expect(UI.studentName).toBe("اسم الطالبة");
    expect(UI.ideaTitle).toBe("عنوان الفكرة");
    expect(UI.ideaDetails).toBe("تفاصيل الفكرة");
    expect(UI.externalPrompt).toBe("البرومبت");
    expect(UI.copy).toBe("نسخ البرومبت");
    expect(NAV.map((item) => item.label)).toEqual(["آلية المشاركة", "الأهداف"]);
    const visible = Object.values(UI).join(" ");
    expect(visible).not.toMatch(/رفع المشاركة|مشاركات الفعالية|إعلان الفائزات|ترقية الفكرة/);
  });

  it("lists the four platform problems and the two challenge-two assistants", () => {
    expect(CHALLENGE_ONE.problems.map((problem) => problem.title)).toEqual([
      "اكتشاف المحتوى المشكوك فيه مبكرًا",
      "رصد ومتابعة انتشار الشائعات على منصة X",
      "تسريع وصول التوضيحات الرسمية للجمهور",
      "مساعدة المستخدم للتحقق من صحة المحتوى المنشور",
    ]);
    expect(CHALLENGE_TWO.title).toBe("طور تطبيق أو مساعد ذكي يرصد للهيئة العامة للتنظيم الإعلامي.");
    expect(CHALLENGE_TWO.text).toBe(
      "المطلوب ابتكار حل رقمي يساعد على رصد الحسابات التي تستغل الأحداث لنشر معلومات مضللة",
    );
    expect(
      CHALLENGE_TWO.cards.map((card) => [card.number, card.name, card.summary, card.note]),
    ).toEqual([
      [
        1,
        "راصد",
        "توليد فكرة تطبيق لدعم التنظيم الإعلامي.",
        "شارك فكرتك أنت، مع الحفاظ على استقلاليتها وملكيتك لها.",
      ],
      [
        2,
        "كاشف",
        "مساعد ذكي لرصد التضليل الإعلامي داخل منصات التواصل الإجتماعي.",
        "طوّر فكرتك أنت، مع الحفاظ على استقلاليتها وملكيتك لها.",
      ],
    ]);
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
