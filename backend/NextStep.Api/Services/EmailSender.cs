using System.Net;
using System.Net.Mail;

namespace NextStep.Api;

public interface IEmailSender
{
    bool Configured { get; }
    Task SendPasswordCode(string address, string code, string language, CancellationToken ct);
}
public sealed class SmtpEmailSender(IConfiguration config) : IEmailSender
{
    public bool Configured => !string.IsNullOrWhiteSpace(config["Email:Host"]) && MailAddress.TryCreate(config["Email:From"], out _) && !string.IsNullOrWhiteSpace(config["Email:Username"]) && !string.IsNullOrWhiteSpace(config["Email:Password"]);
    public async Task SendPasswordCode(string address, string code, string language, CancellationToken ct)
    {
        if (!Configured) throw new ApiFault("provider_unavailable", "Password recovery email is not configured yet. Please try later.");
        using var message = new MailMessage(new MailAddress(config["Email:From"]!, "NextStep"), new MailAddress(address)) {
            Subject = language == "ar" ? "رمز استعادة كلمة المرور — NextStep" : "Your NextStep password reset code",
            Body = language == "ar" ? $"رمز التحقق: {code}\nصالح لمدة 10 دقائق ولمرة واحدة. لا تشاركه مع أي شخص.\nإذا لم تطلب استعادة كلمة المرور، تجاهل هذه الرسالة." : $"Your verification code: {code}\nValid for 10 minutes and one use. Do not share this code.\nIf you did not request a password reset, ignore this email.",
            IsBodyHtml = false
        };
        using var smtp = new SmtpClient(config["Email:Host"], config.GetValue("Email:Port", 587)) { EnableSsl = true, UseDefaultCredentials = false, Credentials = new NetworkCredential(config["Email:Username"], config["Email:Password"]) };
        using var timeout = CancellationTokenSource.CreateLinkedTokenSource(ct); timeout.CancelAfter(TimeSpan.FromSeconds(10));
        try { await smtp.SendMailAsync(message, timeout.Token); }
        catch (Exception error) when (error is SmtpException or OperationCanceledException) { throw new ApiFault("provider_unavailable", "The recovery email could not be sent. Please retry later.", true); }
    }
}
