using System.Text.Json;
using DogTrials.Api.Dtos;
using DogTrials.Api.Entities;
using QuestPDF.Fluent;
using QuestPDF.Helpers;
using QuestPDF.Infrastructure;

namespace DogTrials.Api.Services;

public sealed class PdfStampingService : IPdfStampingService
{
    private static readonly JsonSerializerOptions SerializerOptions = new() { PropertyNameCaseInsensitive = true };
    private static readonly string[] UpperRows = ["Sheep", "Cattle", "Ducks", "Mixed"];
    private static readonly string[] UpperCols =
    [
        "STD", "OPN", "ADV", "FTD_OPN", "FTD_ADV",
        "DATE1_TRIAL1", "DATE1_TRIAL2", "DATE2_TRIAL1", "DATE2_TRIAL2",
        "DATE3_TRIAL1", "DATE3_TRIAL2", "DATE4_TRIAL1", "DATE4_TRIAL2"
    ];
    private static readonly string[] LowerRows = ["Sheep", "Cattle", "Ducks"];
    private static readonly string[] LowerCols =
    [
        "NOV", "WRK_JR_HNDLR", "FEO", "POST_ADV", "RTD",
        "DATE1_TRIAL1", "DATE1_TRIAL2", "DATE2_TRIAL1", "DATE2_TRIAL2",
        "DATE3_TRIAL1", "DATE3_TRIAL2", "DATE4_TRIAL1", "DATE4_TRIAL2"
    ];

    private readonly IPdfTemplateProvider _templateProvider;
    private readonly ILogger<PdfStampingService> _logger;

    public PdfStampingService(IPdfTemplateProvider templateProvider, ILogger<PdfStampingService> logger)
    {
        _templateProvider = templateProvider;
        _logger = logger;
        QuestPDF.Settings.License = LicenseType.Community;
    }

    public async Task<byte[]> GeneratePdfAsync(Entry entry, CancellationToken cancellationToken)
    {
        var templateBytes = await _templateProvider.LoadTemplateAsync(cancellationToken);
        if (templateBytes.Length == 0)
        {
            throw new InvalidOperationException("PDF template was empty.");
        }

        var selections = DeserializeSelections(entry.SelectionsJson);
        var selectionMap = new PdfSelectionMap(selections);
        var registrationNumber = string.IsNullOrWhiteSpace(entry.RegistrationOrTrackingNumber)
            ? "Pending"
            : entry.RegistrationOrTrackingNumber;

        var document = Document.Create(container =>
        {
            container.Page(page =>
            {
                page.Size(PageSizes.Letter);
                page.Margin(20);
                page.DefaultTextStyle(x => x.FontSize(10));

                page.Content().Column(column =>
                {
                    column.Spacing(6);
                    column.Item().Text($"Registration #: {registrationNumber}").Bold();
                    column.Item().Text($"Trial: {entry.Trial?.Name ?? "Unknown"}");
                    column.Item().Text($"Handler Email: {entry.ContactEmail ?? ""}");

                    column.Item().Text("Dog Information").Bold();
                    column.Item().Text($"Breed: {entry.DogBreed ?? ""}");
                    column.Item().Text($"Registered Name: {entry.DogRegisteredName ?? ""}");
                    column.Item().Text($"Call Name: {entry.DogCallName ?? ""}");
                    column.Item().Text($"DOB: {entry.DogDob?.ToString("yyyy-MM-dd") ?? ""}");
                    column.Item().Text($"Color: {entry.DogColor ?? ""}");
                    column.Item().Text($"Sex: {entry.DogSex ?? ""}");
                    column.Item().Text($"Sire: {entry.DogSire ?? ""}");
                    column.Item().Text($"Dam: {entry.DogDam ?? ""}");
                    column.Item().Text($"Breeders: {entry.DogBreeders ?? ""}");

                    column.Item().Text("Contact Information").Bold();
                    column.Item().Text($"Owners: {entry.ContactOwners ?? ""}");
                    column.Item().Text($"Address: {entry.ContactStreet ?? ""} {entry.ContactCity ?? ""} {entry.ContactState ?? ""} {entry.ContactZip ?? ""}");
                    column.Item().Text($"Email: {entry.ContactEmail ?? ""}");
                    column.Item().Text($"Phone: {entry.ContactPhone ?? ""}");
                    column.Item().Text($"Handler: {entry.ContactHandler ?? ""}");
                    column.Item().Text($"Membership #: {entry.ContactMembershipNumber ?? ""}");
                    column.Item().Text($"Junior DOB: {entry.JuniorDob?.ToString("yyyy-MM-dd") ?? ""}");
                    column.Item().Text($"Junior Member: {entry.JuniorMemberId ?? ""}");

                    column.Item().Text("Emergency Contact").Bold();
                    column.Item().Text($"Name: {entry.EmergencyName ?? ""}");
                    column.Item().Text($"Phone: {entry.EmergencyPhone ?? ""}");

                    column.Item().Text("Fees").Bold();
                    column.Item().Text($"Total Fees: {entry.TotalEntryFees?.ToString("0.00") ?? ""} {entry.FeesCurrency ?? "USD"}");

                    column.Item().Text("Upper Grid Selections").Bold();
                    column.Item().Element(container => RenderGrid(container, UpperRows, UpperCols, selectionMap));

                    column.Item().Text("Lower Grid Selections").Bold();
                    column.Item().Element(container => RenderGrid(container, LowerRows, LowerCols, selectionMap));
                });
            });
        });

        using var stream = new MemoryStream();
        document.GeneratePdf(stream);
        _logger.LogInformation("Generated PDF for entry {EntryId} using template {TemplatePath}", entry.EntryId, _templateProvider.TemplatePath);
        return stream.ToArray();
    }

    private static EntrySelectionsDto DeserializeSelections(string? json)
    {
        if (string.IsNullOrWhiteSpace(json))
        {
            return new EntrySelectionsDto(new List<EntrySelectionCellDto>(), new List<EntrySelectionCellDto>());
        }

        try
        {
            var selections = JsonSerializer.Deserialize<EntrySelectionsDto>(json, SerializerOptions);
            return selections ?? new EntrySelectionsDto(new List<EntrySelectionCellDto>(), new List<EntrySelectionCellDto>());
        }
        catch (JsonException)
        {
            return new EntrySelectionsDto(new List<EntrySelectionCellDto>(), new List<EntrySelectionCellDto>());
        }
    }

    private static void RenderGrid(IContainer container, IReadOnlyList<string> rows, IReadOnlyList<string> cols, PdfSelectionMap selectionMap)
    {
        container.Table(table =>
        {
            table.ColumnsDefinition(columns =>
            {
                columns.ConstantColumn(70);
                foreach (var _ in cols)
                {
                    columns.RelativeColumn();
                }
            });

            table.Header(header =>
            {
                header.Cell().Element(CellHeaderStyle).Text("Class");
                foreach (var col in cols)
                {
                    header.Cell().Element(CellHeaderStyle).Text(col);
                }
            });

            foreach (var row in rows)
            {
                table.Cell().Element(CellBodyStyle).Text(row);

                foreach (var col in cols)
                {
                    var value = selectionMap.IsSelected(row, col) ? "X" : string.Empty;

                    table.Cell().Element(CellBodyStyle).Text(value);
                }
            }
        });
    }

    private static IContainer CellHeaderStyle(IContainer container)
    {
        return container
            .Border(1)
            .Background(Colors.Grey.Lighten2)
            .AlignCenter()
            .AlignMiddle()
            .Padding(2)
            .DefaultTextStyle(x => x.FontSize(6).SemiBold());
    }

    private static IContainer CellBodyStyle(IContainer container)
    {
        return container
            .Border(1)
            .AlignCenter()
            .AlignMiddle()
            .Padding(2)
            .DefaultTextStyle(x => x.FontSize(6));
    }
}
