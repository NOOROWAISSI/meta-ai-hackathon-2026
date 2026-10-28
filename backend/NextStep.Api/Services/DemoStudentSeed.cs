using System.Security.Cryptography;
using System.Text.Json;
using System.Text.Json.Nodes;
using Microsoft.AspNetCore.Identity;
using MySqlConnector;

namespace NextStep.Api;

public sealed record DemoStudent(string Email, string Name, string Background, string[] Interests, string[] Skills, double? WeeklyHours);
public sealed record SeedResult(int Created, int Skipped);

/// <summary>Explicit development-only seed. Never resets passwords or overwrites existing students.</summary>
public sealed class DemoStudentSeed(MySqlStateStore store, IWebHostEnvironment environment)
{
    public const string Password = "NextStep-Demo-2026!";
    public static readonly DemoStudent[] Students = [
        new("noor.student@example.invalid", "نور أحمد", "ملف طالب تجريبي: هندسة حاسوب، مهتمة بتطوير الويب والذكاء الاصطناعي.", ["AI", "Web development"], ["React", "TypeScript"], 6),
        new("omar.student@example.invalid", "عمر خالد", "ملف طالب تجريبي: علوم حاسوب، مهتم بالأمن السيبراني؛ لا وقت للتحضير حاليًا.", ["Cybersecurity", "Data"], ["Python"], 0),
        new("lina.student@example.invalid", "لينا حسن", "ملف طالبة تجريبي غير مكتمل؛ لم تُحدّد ساعات التحضير بعد.", ["Design", "AI"], [], null)
    ];
    public async Task<SeedResult> Run(IReadOnlyList<DemoStudent> students, CancellationToken ct)
    {
        if (!environment.IsDevelopment() && !environment.IsEnvironment("Testing")) throw new ApiFault("invalid_input", "Demo accounts can only be seeded in Development or Testing.");
        var created = 0; var skipped = 0;
        foreach (var student in students) {
            Input.Require(student.Email.EndsWith("@example.invalid", StringComparison.Ordinal) && student.WeeklyHours is null or >= 0 and <= 168);
            await using var db = await store.Open(ct); await using var tx = await db.BeginTransactionAsync(ct);
            var normalized = student.Email.ToUpperInvariant();
            await using var exists = new MySqlCommand("SELECT COUNT(*) FROM accounts WHERE normalized_email=@email", db, tx); exists.Parameters.AddWithValue("@email", normalized);
            if (Convert.ToInt32(await exists.ExecuteScalarAsync(ct)) > 0) { skipped++; await tx.CommitAsync(ct); continue; }
            var owner = Guid.NewGuid().ToString("N"); var id = Guid.NewGuid().ToString("N");
            var profile = Input.Blank("profile-" + owner) with {
                Version = 1, Background = student.Background, Interests = student.Interests,
                Skills = student.Skills.Select((label, index) => new Skill("demo-skill-" + index, label, "reported_has")).ToArray(),
                AvailableHoursPerWeek = student.WeeklyHours is { } hours ? new JsonObject { ["state"] = "known", ["value"] = hours, ["reportedAt"] = DateTimeOffset.UtcNow.ToString("O") } : new JsonObject { ["state"] = "unknown" },
                PreferredFormats = ["online"], PreferredLanguage = "ar"
            };
            Input.Profile(profile);
            async Task Execute(string sql, params (string Key, object Value)[] values) {
                await using var command = new MySqlCommand(sql, db, tx); foreach (var (key, value) in values) command.Parameters.AddWithValue(key, value); await command.ExecuteNonQueryAsync(ct);
            }
            try {
                await Execute("INSERT INTO anonymous_sessions(owner_id,token_hash,expires_at) VALUES(@owner,@token,@expiry)", ("@owner", owner), ("@token", MySqlStateStore.Hash(Convert.ToHexString(RandomNumberGenerator.GetBytes(32)))), ("@expiry", DateTime.UtcNow.AddDays(30)));
                await Execute("INSERT INTO user_state(owner_id,schema_version,payload) VALUES(@owner,1,@payload)", ("@owner", owner), ("@payload", JsonSerializer.Serialize(new UserState { Profile = profile }, Wire.Json)));
                await Execute("INSERT INTO accounts(id,owner_id,email,normalized_email,password_hash,display_name) VALUES(@id,@owner,@email,@normalized,@hash,@name)", ("@id", id), ("@owner", owner), ("@email", student.Email), ("@normalized", normalized), ("@hash", new PasswordHasher<string>().HashPassword(id, Password)), ("@name", student.Name));
                await tx.CommitAsync(ct); created++;
            } catch (MySqlException error) when (error.Number == 1062) { await tx.RollbackAsync(ct); skipped++; }
        }
        return new(created, skipped);
    }
}
