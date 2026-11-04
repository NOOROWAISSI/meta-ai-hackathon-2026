namespace NextStep.Api;

public sealed record BriefingVocabulary(string[] Overview, string[] Relevance, string[] Priorities, string[] Questions);

public static class BriefingSafety
{
    public static BriefingVocabulary Vocabulary(string language) => language switch
    {
        "en" => new(
            ["Review the published opportunity details and original sources."],
            ["Compare the published theme with your interests and goals. This does not establish eligibility."],
            ["Review the published requirements and prepare a small demonstration.", "Identify the skills and resources you may need for preparation."],
            ["Which participation conditions need confirmation with the organizer?", "Which submission instructions remain unclear?"]),
        "ar" => new(
            ["راجع تفاصيل الفرصة المنشورة والمصادر الأصلية."],
            ["قارن موضوع الفرصة المنشور باهتماماتك وأهدافك. هذا لا يثبت الأهلية."],
            ["راجع المتطلبات المنشورة وأعد عرضاً توضيحياً صغيراً.", "حدد المهارات والموارد التي قد تحتاجها للتحضير."],
            ["ما شروط المشاركة التي تحتاج إلى تأكيد من المنظم؟", "ما تعليمات التقديم التي لا تزال غير واضحة؟"]),
        _ => throw new ArgumentException("Unsupported briefing language.")
    };

    public static bool Accepts(BriefingText? text, string language)
    {
        var allowed = Vocabulary(language);
        return text is not null && allowed.Overview.Contains(text.Overview, StringComparer.Ordinal)
            && allowed.Relevance.Contains(text.PersonalRelevance, StringComparer.Ordinal)
            && text.PreparationPriorities is { Length: <= 8 }
            && text.QuestionsToClarify is { Length: <= 8 }
            && text.PreparationPriorities.All(item => allowed.Priorities.Contains(item, StringComparer.Ordinal))
            && text.QuestionsToClarify.All(item => allowed.Questions.Contains(item, StringComparer.Ordinal));
    }
}
