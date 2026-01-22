using DogTrials.Api.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace DogTrials.Api.Data.Configurations;

public sealed class NotificationConfiguration : IEntityTypeConfiguration<Notification>
{
    public void Configure(EntityTypeBuilder<Notification> builder)
    {
        builder.ToTable("Notifications");

        builder.HasKey(n => n.NotificationId);

        builder.Property(n => n.RecipientType)
            .HasConversion<string>()
            .HasMaxLength(16)
            .IsRequired();

        builder.Property(n => n.Status)
            .HasConversion<string>()
            .HasMaxLength(16)
            .HasDefaultValue(NotificationStatus.Queued)
            .IsRequired();

        builder.Property(n => n.AttemptCount)
            .HasDefaultValue(0);

        builder.Property(n => n.LastErrorCode)
            .HasMaxLength(64);

        builder.Property(n => n.CreatedAtUtc)
            .HasDefaultValueSql("SYSUTCDATETIME()")
            .IsRequired();

        builder.HasIndex(n => new { n.EntryId, n.RecipientType })
            .IsUnique()
            .HasDatabaseName("UX_Notifications_EntryId_RecipientType");

        builder.HasIndex(n => new { n.Status, n.NextAttemptAtUtc })
            .HasDatabaseName("IX_Notifications_Status_NextAttemptAtUtc");

        builder.HasOne(n => n.Entry)
            .WithMany(e => e.Notifications)
            .HasForeignKey(n => n.EntryId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}
