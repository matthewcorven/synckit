using DogTrials.Api.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace DogTrials.Api.Data.Configurations;

public sealed class TrialCounterConfiguration : IEntityTypeConfiguration<TrialCounter>
{
    public void Configure(EntityTypeBuilder<TrialCounter> builder)
    {
        builder.ToTable("TrialCounters", table =>
        {
            table.HasCheckConstraint(
                "CK_TrialCounters_NextSequenceNumber_Positive",
                "[NextSequenceNumber] >= 1");
        });

        builder.HasKey(tc => tc.TrialId);

        builder.Property(tc => tc.NextSequenceNumber)
            .IsRequired();

        builder.HasOne(tc => tc.Trial)
            .WithOne(t => t.Counter)
            .HasForeignKey<TrialCounter>(tc => tc.TrialId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
