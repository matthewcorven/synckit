namespace DogTrials.Api.Entities;

public sealed class TrialCounter
{
    public Guid TrialId { get; set; }
    public int NextSequenceNumber { get; set; } = 1;

    public Trial Trial { get; set; } = null!;
}
