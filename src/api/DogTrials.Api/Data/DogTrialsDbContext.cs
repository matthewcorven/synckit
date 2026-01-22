using DogTrials.Api.Entities;
using Microsoft.EntityFrameworkCore;

namespace DogTrials.Api.Data;

public sealed class DogTrialsDbContext(DbContextOptions<DogTrialsDbContext> options) : DbContext(options)
{
    public DbSet<Trial> Trials => Set<Trial>();
    public DbSet<TrialCounter> TrialCounters => Set<TrialCounter>();
    public DbSet<Entry> Entries => Set<Entry>();
    public DbSet<Notification> Notifications => Set<Notification>();
    public DbSet<User> Users => Set<User>();
    public DbSet<FormTemplate> FormTemplates => Set<FormTemplate>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.ApplyConfigurationsFromAssembly(typeof(DogTrialsDbContext).Assembly);
    }
}
