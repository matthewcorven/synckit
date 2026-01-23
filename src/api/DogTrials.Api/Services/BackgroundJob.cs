using DogTrials.Api.Entities;

namespace DogTrials.Api.Services;

public abstract record BackgroundJob(Guid JobId, Guid EntryId);

public sealed record PdfGenerationJob(Guid JobId, Guid EntryId) : BackgroundJob(JobId, EntryId);

public sealed record EmailNotificationJob(Guid JobId, Guid EntryId, RecipientType RecipientType)
    : BackgroundJob(JobId, EntryId);
