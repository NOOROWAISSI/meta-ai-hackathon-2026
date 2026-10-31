namespace NextStep.Api;

public sealed record BriefingChoices(
    IReadOnlyDictionary<string, string> Opportunity,
    IReadOnlyDictionary<string, string> Profile,
    IReadOnlyDictionary<string, string> Priorities,
    IReadOnlyDictionary<string, string> Questions)
{
    public bool Accepts(BriefingText? result) => result is not null
        && result.Overview is not null && Opportunity.ContainsKey(result.Overview)
        && result.PersonalRelevance is not null && Profile.ContainsKey(result.PersonalRelevance)
        && result.PreparationPriorities is { Length: <= 8 } && result.QuestionsToClarify is { Length: <= 8 }
        && result.PreparationPriorities.All(id => id is not null && Priorities.ContainsKey(id))
        && result.QuestionsToClarify.All(id => id is not null && Questions.ContainsKey(id));
    public BriefingText Render(BriefingText result) => new(Opportunity[result.Overview], Profile[result.PersonalRelevance],
        result.PreparationPriorities.Select(id => Priorities[id]).ToArray(), result.QuestionsToClarify.Select(id => Questions[id]).ToArray());
}

public static class BriefingSelections
{
    public static BriefingChoices Create(ListingSummary listing, Opportunity? record, StudentProfile profile, string language)
    {
        var ar = language == "ar";
        var opportunity = new Dictionary<string, string> { ["event.details"] = ar ? "راجع تفاصيل الفرصة المنشورة والمصادر الأصلية." : "Review the published opportunity details and original sources." };
        var personal = new Dictionary<string, string> { ["profile.none"] = ar ? "راجع اهتماماتك وأهدافك مع تفاصيل الفرصة. هذا لا يثبت الأهلية." : "Compare your interests and goals with the opportunity details. This does not establish eligibility." };
        if (listing.Format == "online") opportunity["event.online"] = ar ? "تصف المعلومات المنشورة الفرصة بأنها عبر الإنترنت." : "The published listing describes this opportunity as online.";
        var vocabulary = new[] { ("ai", "AI", "الذكاء الاصطناعي"), ("data", "Data", "البيانات"), ("python", "Python", "بايثون"), ("design", "Design", "التصميم"), ("robotics", "Robotics", "الروبوتات"), ("web development", "Web development", "تطوير الويب") };
        var topics = new List<string>();
        foreach (var (key, en, arabic) in vocabulary)
        {
            var inSource = listing.Topics.Any(topic => string.Equals(topic.Trim(), key, StringComparison.OrdinalIgnoreCase));
            var inProfile = profile.Interests.Any(interest => string.Equals(interest.Trim(), key, StringComparison.OrdinalIgnoreCase));
            if (inSource) {
                opportunity["event.topic." + key.Replace(' ', '-')] = ar ? $"يذكر المصدر موضوع {arabic}." : $"The listing includes the topic {en}.";
                topics.Add(ar ? arabic : en);
            }
            if (inProfile)
                personal["profile.interest." + key.Replace(' ', '-')] = ar ? $"ذكرت اهتمامك بموضوع {arabic}. هذا لا يثبت الأهلية." : $"You reported an interest in {en}. This does not establish eligibility.";
            if (inSource && inProfile)
                personal["profile.match." + key.Replace(' ', '-')] = ar
                    ? $"ذكرت اهتمامك بموضوع {arabic}، وهو من مواضيع هذه الفرصة المنشورة. هذا ارتباط بالاهتمام، وليس تأكيداً للأهلية أو الخبرة."
                    : $"You reported an interest in {en}, which is one of this opportunity's published topics. This is an interest match, not confirmation of eligibility or experience.";
        }
        if (topics.Count > 0) {
            var format = listing.Format switch { "online" => ar ? "المشاركة منشورة على أنها عبر الإنترنت. " : "Participation is listed as online. ", "in_person" => ar ? "المشاركة منشورة على أنها حضورية. " : "Participation is listed as in person. ", "hybrid" => ar ? "المشاركة منشورة على أنها بنظام هجين. " : "Participation is listed as hybrid. ", _ => "" };
            opportunity["event.summary"] = ar
                ? $"{format}تشمل مواضيع هذه الفرصة المنشورة {string.Join("، ", topics.Take(3))}. راجع المصادر الأصلية لشروط المشاركة والتسليم الحالية."
                : $"{format}This opportunity's published topics include {string.Join(", ", topics.Take(3))}. Check the original sources for current participation and submission conditions.";
        }
        var priorities = new Dictionary<string, string>
        {
            ["priority.sources"] = ar ? "راجع المتطلبات المنشورة والمصادر الأصلية." : "Review the published requirements and original sources.",
            ["priority.skills"] = ar ? "حدد المهارات والموارد التي قد تحتاجها للتحضير." : "Identify skills and resources you may need for preparation."
        };
        var questions = new Dictionary<string, string>
        {
            ["question.source"] = ar ? "ما المعلومات التي لا تزال تحتاج إلى تأكيد من المنظم؟" : "Which details still need confirmation with the organizer?"
        };
        if (record is null || record.SourceCoverage.Participation.State != "complete")
            questions["question.participation"] = ar ? "ما شروط المشاركة غير المؤكدة؟" : "Which participation conditions remain unconfirmed?";
        if (record is null || record.SourceCoverage.Submission.State != "complete")
            questions["question.submission"] = ar ? "ما تعليمات التقديم التي لا تزال غير واضحة؟" : "Which submission instructions remain unclear?";
        return new(opportunity.OrderBy(pair => pair.Key == "event.summary" ? 0 : 1).ToDictionary(pair => pair.Key, pair => pair.Value),
            personal.OrderBy(pair => pair.Key.StartsWith("profile.match.", StringComparison.Ordinal) ? 0 : pair.Key == "profile.none" ? 2 : 1).ToDictionary(pair => pair.Key, pair => pair.Value), priorities, questions);
    }
}
