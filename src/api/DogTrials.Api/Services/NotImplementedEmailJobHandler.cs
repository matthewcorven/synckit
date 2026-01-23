using DogTrials.Api.Entities;

namespace DogTrials.Api.Services;

public sealed class NotImplementedEmailJobHandler : IEmailJobHandler
{
    public Task<EmailJobResult> HandleAsync(Notification notification, CancellationToken cancellationToken)
    {
        return Task.FromResult(EmailJobResult.Fail("EMAIL_NOT_IMPLEMENTED"));
    }
}
