using DogTrials.Api.Entities;

namespace DogTrials.Api.Services;

public interface IEmailJobHandler
{
    Task<EmailJobResult> HandleAsync(Notification notification, CancellationToken cancellationToken);
}
