using System.Text;
using System.Text.Json;
using DogTrials.Api.Dtos;
using DogTrials.Api.Entities;
using DogTrials.Api.Services;
using Microsoft.AspNetCore.Hosting;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.FileProviders;

namespace DogTrials.Api.Tests;

public sealed class PdfStampingServiceTests
{
    [Fact]
    public async Task TemplateProvider_LoadsPdfTemplate()
    {
        var contentRoot = GetApiContentRoot();
        var environment = new TestWebHostEnvironment(contentRoot);
        var provider = new PdfTemplateProvider(environment, NullLogger<PdfTemplateProvider>.Instance);

        var bytes = await provider.LoadTemplateAsync(CancellationToken.None);

        Assert.True(bytes.Length > 0);
        var header = Encoding.ASCII.GetString(bytes, 0, Math.Min(5, bytes.Length));
        Assert.StartsWith("%PDF-", header);
    }

    [Fact]
    public async Task PdfStampingService_GeneratesPdf()
    {
        var contentRoot = GetApiContentRoot();
        var environment = new TestWebHostEnvironment(contentRoot);
        var provider = new PdfTemplateProvider(environment, NullLogger<PdfTemplateProvider>.Instance);
        var service = new PdfStampingService(provider, NullLogger<PdfStampingService>.Instance);

        var selections = new EntrySelectionsDto(
            new List<EntrySelectionCellDto> { new("Sheep", "STD", "X") },
            new List<EntrySelectionCellDto>());

        var entry = new Entry
        {
            EntryId = Guid.NewGuid(),
            Trial = new Trial
            {
                Name = "Sample Trial",
                OrganizerSlug = "EXCLUB",
                EventSlug = "SPRING-2026-05-02",
                TrackingSlug = "EXCLUB-SPRING-2026-05-02"
            },
            RegistrationOrTrackingNumber = "EXCLUB-SPRING-2026-05-02-0001",
            DogBreed = "Australian Shepherd",
            DogRegisteredName = "Registered Name",
            DogCallName = "Ranger",
            DogDob = new DateOnly(2021, 4, 10),
            DogColor = "Blue Merle",
            DogSex = "Male",
            ContactOwners = "Owner One",
            ContactEmail = "handler@example.com",
            ContactPhone = "555-555-5555",
            EmergencyName = "Emergency Contact",
            EmergencyPhone = "555-111-2222",
            TotalEntryFees = 25m,
            FeesCurrency = "USD",
            SelectionsJson = JsonSerializer.Serialize(selections)
        };

        var bytes = await service.GeneratePdfAsync(entry, CancellationToken.None);

        Assert.True(bytes.Length > 100);
        var header = Encoding.ASCII.GetString(bytes, 0, Math.Min(5, bytes.Length));
        Assert.StartsWith("%PDF-", header);
    }

    [Fact]
    public void PdfSelectionMap_RecognizesSelections()
    {
        var selections = new EntrySelectionsDto(
            new List<EntrySelectionCellDto> { new("Sheep", "STD", "X") },
            new List<EntrySelectionCellDto> { new("Ducks", "NOV", "X") });

        var map = new PdfSelectionMap(selections);

        Assert.True(map.IsSelected("Sheep", "STD"));
        Assert.True(map.IsSelected("Ducks", "NOV"));
        Assert.False(map.IsSelected("Cattle", "STD"));
    }

    private static string GetApiContentRoot()
    {
        var directory = new DirectoryInfo(AppContext.BaseDirectory);
        while (directory is not null)
        {
            var candidate = Path.Combine(directory.FullName, "src", "api", "DogTrials.Api");
            if (Directory.Exists(candidate))
            {
                return candidate;
            }

            directory = directory.Parent;
        }

        throw new DirectoryNotFoundException("Unable to locate DogTrials.Api content root.");
    }

    private sealed class TestWebHostEnvironment : IWebHostEnvironment
    {
        public TestWebHostEnvironment(string contentRootPath)
        {
            ContentRootPath = contentRootPath;
            ApplicationName = "DogTrials.Api";
            EnvironmentName = "Development";
            WebRootPath = Path.Combine(contentRootPath, "wwwroot");
            ContentRootFileProvider = null!;
            WebRootFileProvider = null!;
        }

        public string ApplicationName { get; set; }
        public IFileProvider WebRootFileProvider { get; set; }
        public string WebRootPath { get; set; }
        public string EnvironmentName { get; set; }
        public string ContentRootPath { get; set; }
        public IFileProvider ContentRootFileProvider { get; set; }
    }
}
