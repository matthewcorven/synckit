using DogTrials.Api.Data;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;

namespace DogTrials.Api.Tests;

internal static class TestDatabase
{
    public static DbContextOptions<DogTrialsDbContext>? TryCreateSqlServerOptions()
    {
        var connectionString = TryCreateSqlServerConnectionString();
        if (string.IsNullOrWhiteSpace(connectionString))
        {
            return null;
        }

        return new DbContextOptionsBuilder<DogTrialsDbContext>()
            .UseSqlServer(connectionString)
            .Options;
    }

    public static string? TryCreateSqlServerConnectionString()
    {
        var baseConnectionString = Environment.GetEnvironmentVariable("DOGTRIALS_TEST_SQL");
        if (string.IsNullOrWhiteSpace(baseConnectionString))
        {
            return null;
        }

        var builder = new SqlConnectionStringBuilder(baseConnectionString);
        var baseCatalog = string.IsNullOrWhiteSpace(builder.InitialCatalog)
            ? "DogTrialsTests"
            : builder.InitialCatalog;

        builder.InitialCatalog = $"{baseCatalog}_{Guid.NewGuid():N}";

        return builder.ConnectionString;
    }
}
