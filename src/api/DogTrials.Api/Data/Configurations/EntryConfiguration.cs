using DogTrials.Api.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace DogTrials.Api.Data.Configurations;

public sealed class EntryConfiguration : IEntityTypeConfiguration<Entry>
{
    public void Configure(EntityTypeBuilder<Entry> builder)
    {
        builder.ToTable("Entries", table =>
        {
            table.HasCheckConstraint(
                "CK_Entries_SequenceNumber_Positive",
                "[SequenceNumber] IS NULL OR [SequenceNumber] >= 1");
        });

        builder.HasKey(e => e.EntryId);

        builder.Property(e => e.Status)
            .HasConversion<string>()
            .HasMaxLength(16)
            .HasDefaultValue(EntryStatus.Draft)
            .IsRequired();

        builder.Property(e => e.PdfStatus)
            .HasConversion<string>()
            .HasMaxLength(16)
            .HasDefaultValue(PdfStatus.Queued)
            .IsRequired();

        builder.Property(e => e.RegistrationOrTrackingNumber)
            .HasMaxLength(128);

        builder.Property(e => e.DogBreed)
            .HasMaxLength(100);

        builder.Property(e => e.DogRegisteredName)
            .HasMaxLength(200);

        builder.Property(e => e.DogCallName)
            .HasMaxLength(100);

        builder.Property(e => e.DogDob)
            .HasColumnType("date");

        builder.Property(e => e.DogColor)
            .HasMaxLength(50);

        builder.Property(e => e.DogSex)
            .HasMaxLength(16);

        builder.Property(e => e.DogSire)
            .HasMaxLength(200);

        builder.Property(e => e.DogDam)
            .HasMaxLength(200);

        builder.Property(e => e.DogBreeders)
            .HasMaxLength(200);

        builder.Property(e => e.ContactOwners)
            .HasMaxLength(200);

        builder.Property(e => e.ContactStreet)
            .HasMaxLength(200);

        builder.Property(e => e.ContactCity)
            .HasMaxLength(100);

        builder.Property(e => e.ContactState)
            .HasMaxLength(32);

        builder.Property(e => e.ContactZip)
            .HasMaxLength(20);

        builder.Property(e => e.ContactEmail)
            .HasMaxLength(320);

        builder.Property(e => e.ContactPhone)
            .HasMaxLength(32);

        builder.Property(e => e.ContactHandler)
            .HasMaxLength(200);

        builder.Property(e => e.ContactMembershipNumber)
            .HasMaxLength(64);

        builder.Property(e => e.JuniorDob)
            .HasColumnType("date");

        builder.Property(e => e.JuniorMemberId)
            .HasMaxLength(64);

        builder.Property(e => e.EmergencyName)
            .HasMaxLength(200);

        builder.Property(e => e.EmergencyPhone)
            .HasMaxLength(32);

        builder.Property(e => e.TotalEntryFees)
            .HasColumnType("decimal(10,2)");

        builder.Property(e => e.FeesCurrency)
            .HasMaxLength(3);

        builder.Property(e => e.TermsVersion)
            .HasMaxLength(32);

        builder.Property(e => e.GeneratedPdfBlobUri)
            .HasMaxLength(2048);

        builder.Property(e => e.PdfAttemptCount)
            .HasDefaultValue(0);

        builder.Property(e => e.PdfLastErrorCode)
            .HasMaxLength(64);

        builder.Property(e => e.CreatedAtUtc)
            .HasDefaultValueSql("SYSUTCDATETIME()")
            .IsRequired();

        builder.Property(e => e.RowVersion)
            .IsRowVersion();

        builder.HasIndex(e => new { e.TrialId, e.SequenceNumber })
            .IsUnique()
            .HasFilter("[SequenceNumber] IS NOT NULL")
            .HasDatabaseName("UX_Entries_TrialId_SequenceNumber");

        builder.HasIndex(e => e.RegistrationOrTrackingNumber)
            .IsUnique()
            .HasFilter("[RegistrationOrTrackingNumber] IS NOT NULL")
            .HasDatabaseName("UX_Entries_RegistrationOrTrackingNumber");

        builder.HasIndex(e => new { e.TrialId, e.CreatedByUserId })
            .IsUnique()
            .HasFilter("[Status] = 'Draft'")
            .HasDatabaseName("UX_Entries_TrialId_CreatedByUserId_Draft");

        builder.HasIndex(e => new { e.Status, e.PdfStatus, e.PdfNextAttemptAtUtc })
            .HasDatabaseName("IX_Entries_Status_PdfStatus_PdfNextAttemptAtUtc");

        builder.HasOne(e => e.Trial)
            .WithMany(t => t.Entries)
            .HasForeignKey(e => e.TrialId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasOne(e => e.CreatedByUser)
            .WithMany(u => u.Entries)
            .HasForeignKey(e => e.CreatedByUserId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}
