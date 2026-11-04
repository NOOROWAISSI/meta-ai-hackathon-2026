using System.Text.Json.Nodes;

namespace NextStep.Api;

public sealed record StartingPointOption(string Value, string Label);
public sealed record ReportedBriefingEvidence(string Kind, string Label, string Text);
public sealed record BriefingStartingPoint(string QuestionId, string Challenge, string Question, string? Answer,
    string Label, string Explanation, string NextAction, StartingPointOption[] Options, ReportedBriefingEvidence[] Evidence);

// A task-specific, explicitly confirmed self-report. Never a proficiency or eligibility score.
public static class BriefingStartingPoints
{
    public static string QuestionId(string opportunityId, string sourceRevision) => "preparation-start:" + MySqlStateStore.Hash(opportunityId + "\n" + sourceRevision)[..20];
    public static string? Answer(StudentProfile profile, string questionId) {
        var answer = profile.ClarificationAnswers.LastOrDefault(item => item.QuestionId == questionId)?.Answer;
        return answer is "not_yet" or "guided" or "independent" or "not_sure" ? answer : null;
    }

    public static string? PlanningNote(Opportunity opportunity, StudentProfile profile)
    {
        var answer = Answer(profile, QuestionId(opportunity.Id, opportunity.SourceRevision));
        return answer switch {
            "independent" => "For this selected opportunity's challenge, the student explicitly reports having built similar work independently. Build on that work; do not automatically repeat introductory tutorials. This is self-report, not verified competence.",
            "guided" => "For this selected opportunity's challenge, the student explicitly reports having followed a guided example, but has not confirmed independent implementation. Prioritize an independent small variation rather than assume zero knowledge or mastery.",
            "not_yet" => "The student explicitly reports not yet trying a project similar to this selected challenge. This does not mean no programming knowledge; clarify unfamiliar parts and propose a small first experiment.",
            _ => null
        };
    }

    public static BriefingStartingPoint Create(ListingSummary listing, Opportunity? record, StudentProfile profile, string language, JsonObject? skillNotes = null)
    {
        var ar = language == "ar";
        string T(string en, string arabic) => ar ? arabic : en;
        static string Bound(string value, int max) => value.Length <= max ? value : value[..max];
        var id = QuestionId(listing.Id, record?.SourceRevision ?? listing.Summary);
        var answer = Answer(profile, id);
        var label = answer switch {
            "independent" => T("Build on your existing work", "ابنِ على شغلك السابق"),
            "guided" => T("Move from a tutorial to your own variation", "من تطبيق مشروح لتجربة بإيدك"),
            "not_yet" => T("Try one small part first", "جرّب جزء صغير أولًا"),
            _ => T("Your starting point is still unknown", "نقطة بدايتك لسه مش معروفة")
        };
        var explanation = answer switch {
            "independent" => T("You confirmed building similar work yourself. Start from that experience instead of automatically repeating the basics; this is not independently verified competence.", "أكدت إنك بنيت شغل مشابه بنفسك. البداية من تجربتك، مش إعادة الأساسيات تلقائيًا؛ هاد وصفك لتجربتك، مش تقييم مستقل لمهارتك."),
            "guided" => T("You confirmed following a guided example. The next useful test is changing one part yourself; following a tutorial does not establish independent mastery.", "أكدت إنك طبّقت مثالًا مشروحًا. الخطوة المفيدة إنك تغيّر جزء بنفسك؛ اتباع شرح لحاله ما بيثبت التمكّن المستقل."),
            "not_yet" => T("You said you have not tried similar work yet. That does not mean you know nothing; identify the unfamiliar part of this challenge first.", "قلت إنك لسه ما جرّبت شغل مشابه. هاد مش معناه إنك ما بتعرف إشي؛ نحدد أولًا الجزء الجديد عليك بهاي الفرصة."),
            _ => T("An AI interest or a skill tag cannot tell us what you can already build. Your goal and project descriptions are context; confirm your hands-on experience before choosing introductory or advanced preparation.", "اهتمام AI أو اسم مهارة ما بحكيلنا شو بتقدر تبني. هدفك ووصف مشاريعك بيعطوا سياق؛ لازم نعرف تجربتك العملية قبل ما نقترح بداية تأسيسية أو متقدمة.")
        };
        var action = answer switch {
            "independent" => T("Take one project you built yourself and list what must change to meet this event's deliverable. Prototype only the new or uncertain part.", "خذ مشروعًا بنيته بنفسك وحدد شو لازم يتغير عشان مخرج هاي الفرصة. جرّب الجزء الجديد أو غير المؤكد بس."),
            "guided" => T("Choose one feature from a guided project and rebuild a small variation without following its steps. Record exactly where you need help.", "اختار ميزة من مشروع طبّقته مع شرح، وابنِ تغييرًا صغيرًا بدون اتباع الخطوات. سجّل وين احتجت مساعدة بالضبط."),
            "not_yet" => T("Break the published challenge into input, processing and output. Choose one unfamiliar part for a tiny experiment using tools you actually know.", "قسّم التحدي المنشور لمدخلات ومعالجة ومخرجات. اختار جزءًا جديدًا عليك لتجربة صغيرة بأدوات بتعرفها فعلًا."),
            _ => T("Confirm whether you built similar work independently, followed a guide, or have not tried it. We will not assign you a level from an interest tag.", "حدد إذا بنيت شغل مشابه بنفسك، أو طبّقت مع شرح، أو لسه ما جرّبت. ما رح نعطيك مستوى من وسم اهتمام.")
        };
        var evidence = new List<ReportedBriefingEvidence>();
        evidence.AddRange(profile.Goals.Take(2).Select(item => new ReportedBriefingEvidence("goal", T("Your stated goal", "هدفك المكتوب"), Bound(item.Statement, 700))));
        evidence.AddRange(profile.ProjectExperience.Take(3).Select(item => new ReportedBriefingEvidence("project", T("Project you described", "مشروع وصفته"), Bound(item.Description, 1200))));
        if (!string.IsNullOrWhiteSpace(profile.Background)) evidence.Add(new("background", T("Your experience note", "وصفك لتجربتك"), Bound(profile.Background, 1000)));
        foreach (var skill in profile.Skills.Where(item => item.State == "reported_has").Take(8)) {
            var note = skillNotes?[skill.Label] is JsonValue value && value.TryGetValue<string>(out var text) ? text : null;
            evidence.Add(new("skill", T("Reported skill", "مهارة ذكرتها"), Bound(skill.Label + (string.IsNullOrWhiteSpace(note) ? "" : ": " + note), 700)));
        }
        return new(id, record?.Theme ?? listing.Summary,
            T("Have you personally built something similar to this published challenge?", "هل بنيت بإيدك شغل مشابه للتحدي المنشور؟"),
            answer, label, explanation, action,
            [new("not_yet", T("I have not tried similar work", "لسه ما جرّبت شغل مشابه")), new("guided", T("I followed a guide or tutorial", "طبّقت مع شرح أو دورة")), new("independent", T("I built similar work myself", "بنيت شغل مشابه بنفسي")), new("not_sure", T("Not sure how my work compares", "مش متأكد كيف أقارن تجربتي"))], evidence.ToArray());
    }
}
