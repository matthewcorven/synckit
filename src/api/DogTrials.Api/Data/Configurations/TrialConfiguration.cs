using DogTrials.Api.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace DogTrials.Api.Data.Configurations;

public sealed class TrialConfiguration : IEntityTypeConfiguration<Trial>
{
    public void Configure(EntityTypeBuilder<Trial> builder)
    {
        builder.ToTable("Trials");
        builder.HasKey(t => t.TrialId);

        builder.Property(t => t.Name)
            .HasMaxLength(200)
            .IsRequired();

        builder.Property(t => t.OrganizationCode)
            .HasMaxLength(32)
            .IsRequired();

        builder.Property(t => t.SportCode)
            .HasMaxLength(32)
            .IsRequired();

        builder.Property(t => t.FormCode)
            .HasMaxLength(32)
            .IsRequired();

        builder.Property(t => t.FormVersion)
            .HasMaxLength(32)
            .IsRequired();

        builder.Property(t => t.OrganizerSlug)
            .HasMaxLength(32)
            .IsRequired();

        builder.Property(t => t.EventSlug)
            .HasMaxLength(64)
            .IsRequired();

        builder.Property(t => t.TrackingSlug)
            .HasMaxLength(100)
            .HasComputedColumnSql("[OrganizerSlug] + '-' + [EventSlug]", stored: true);

        builder.Property(t => t.HostClub)
            .HasMaxLength(200)
            .IsRequired();

        builder.Property(t => t.StartDate)
            .HasColumnType("date")
            .IsRequired();

        builder.Property(t => t.EndDate)
            .HasColumnType("date")
            .IsRequired();

        builder.Property(t => t.Location)
            .HasMaxLength(200);

        builder.Property(t => t.SecretaryEmail)
            .HasMaxLength(320)
            .IsRequired();

        builder.Property(t => t.IsActive)
            .IsRequired();

        builder.Property(t => t.CreatedAtUtc)
            .HasDefaultValueSql("SYSUTCDATETIME()")
            .IsRequired();

        builder.Property(t => t.UpdatedAtUtc);

        builder.HasIndex(t => new { t.OrganizerSlug, t.EventSlug })
            .IsUnique()
            .HasDatabaseName("UX_Trials_OrganizerSlug_EventSlug");
    }
}
