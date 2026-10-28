using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;

namespace NextStep.Api;

/// <summary>Display/form metadata only; canonical StudentProfile remains the AI/analysis authority.</summary>
public static class ProfileEditorValidation
{
    public static void Validate(JsonObject editor)
    {
        Input.Require(editor is not null && Encoding.UTF8.GetByteCount(editor.ToJsonString()) <= 600000, "Profile details are too large.");
        var strings = new HashSet<string> { "displayName", "educationStatus", "fieldOfStudy", "studyLevel", "residence", "goalChoice", "goalDescription", "preferredFormat", "experience", "entrantType", "targetDate", "learningBudget", "currency", "learningLanguage", "constraints", "savedAt" };
        foreach (var (key, value) in editor) {
            if (strings.Contains(key)) Input.Require(value is JsonValue text && text.TryGetValue<string>(out var content) && content.Length <= (key is "experience" or "goalDescription" or "constraints" ? 12000 : 1000), "Invalid profile text.");
            else if (key is "version" or "weeklyHours" or "teamSize" or "maxBudget") Input.Require(value is null || value is JsonValue numeric && numeric.TryGetValue<double>(out var number) && double.IsFinite(number) && number >= 0 && number <= (key == "maxBudget" ? 10000000 : int.MaxValue), "Invalid profile number.");
            else if (key is "interests" or "skills" or "goals") Input.Require(value is JsonArray tags && tags.Count <= 50 && tags.All(tag => tag is JsonValue v && v.TryGetValue<string>(out var label) && label.Length <= 4000), "Invalid profile list.");
            else if (key == "avatarDataUrl") Input.Require(value is JsonValue photo && photo.TryGetValue<string>(out var url) && url.Length <= 560000 && System.Text.RegularExpressions.Regex.IsMatch(url, "^data:image/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$"), "Choose a PNG, JPEG or WebP photo.");
            else if (key == "skillNotes") Input.Require(value is JsonObject notes && notes.Count <= 50 && notes.All(note => note.Key.Length <= 100 && note.Value is JsonValue v && v.TryGetValue<string>(out var text) && text.Length <= 4000), "Invalid skill notes.");
            else if (key == "projects") {
                Input.Require(value is JsonArray projects && projects.Count <= 20, "Too many projects.");
                foreach (var project in (JsonArray)value!) {
                    Input.Require(project is JsonObject fields && fields.All(field => new[] { "id", "title", "description", "contribution", "technologies", "url" }.Contains(field.Key)), "Invalid project details.");
                    foreach (var (field, content) in (JsonObject)project!) {
                        if (field == "technologies") Input.Require(content is JsonArray tech && tech.Count <= 50 && tech.All(tag => tag is JsonValue v && v.TryGetValue<string>(out var s) && s.Length <= 100));
                        else Input.Require(content is JsonValue v && v.TryGetValue<string>(out var s) && s.Length <= 4000 && (field != "url" || s.Length == 0 || Input.Url(s)), "Invalid project field or URL.");
                    }
                }
            } else throw new ApiFault("invalid_input", "An unsupported profile field was supplied.");
        }
    }
}
