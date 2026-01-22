using DogTrials.Api.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace DogTrials.Api.Data.Configurations;

public sealed class FormTemplateConfiguration : IEntityTypeConfiguration<FormTemplate>
{
    public void Configure(EntityTypeBuilder<FormTemplate> builder)
    {
        builder.ToTable("FormTemplates");

        builder.HasKey(ft => ft.FormTemplateId);

        builder.Property(ft => ft.OrganizationCode).HasMaxLength(32).IsRequired();
        builder.Property(ft => ft.SportCode).HasMaxLength(32).IsRequired();
        builder.Property(ft => ft.FormCode).HasMaxLength(32).IsRequired();
        builder.Property(ft => ft.Version).HasMaxLength(32).IsRequired();
        builder.Property(ft => ft.GridConfigJson).IsRequired();

        builder.HasIndex(ft => new { ft.OrganizationCode, ft.SportCode, ft.FormCode, ft.Version })
            .IsUnique()
            .HasDatabaseName("UX_FormTemplates_Key");
    }
}
