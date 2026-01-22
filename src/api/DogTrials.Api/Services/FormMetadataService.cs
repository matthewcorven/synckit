using System.Text.Json;
using DogTrials.Api.Data;
using DogTrials.Api.Dtos;
using Microsoft.EntityFrameworkCore;

namespace DogTrials.Api.Services;

public sealed class FormMetadataService : IFormMetadataService
{
    private readonly DogTrialsDbContext _context;

    public FormMetadataService(DogTrialsDbContext context)
    {
        _context = context;
    }

    public async Task<FormMetadataDto?> GetFormMetadataAsync(FormTemplateKeyDto template)
    {
        var ft = await _context.FormTemplates
            .AsNoTracking()
            .Where(f => f.OrganizationCode == template.OrganizationCode
                     && f.SportCode == template.SportCode
                     && f.FormCode == template.FormCode
                     && f.Version == template.Version)
            .FirstOrDefaultAsync();

        if (ft is null) return null;

        var grids = JsonSerializer.Deserialize<List<GridMetadataDto>>(ft.GridConfigJson);
        return new FormMetadataDto(template, grids ?? new List<GridMetadataDto>());
    }
}
