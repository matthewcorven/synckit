namespace DogTrials.Api.Entities;

public sealed class User
{
    public Guid UserId { get; set; }
    public string ExternalSubject { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public UserRole Role { get; set; } = UserRole.Handler;
    public DateTime CreatedAtUtc { get; set; }
    public DateTime? LastLoginAtUtc { get; set; }

    public ICollection<Entry> Entries { get; set; } = new List<Entry>();
}

public enum UserRole
{
    Handler,
    Secretary
}
