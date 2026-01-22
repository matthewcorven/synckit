using System.Collections.Generic;

namespace DogTrials.Api.Dtos;

public sealed record DisabledCellDto(string Row, string Col);

public sealed record GridMetadataDto(
    string Grid,
    List<string> Rows,
    List<string> Cols,
    List<DisabledCellDto> DisabledCells);

public sealed record FormMetadataDto(
    FormTemplateKeyDto FormTemplate,
    List<GridMetadataDto> Grids);

public sealed record TrialRegistrationMetadataDto(
    Guid TrialId,
    FormTemplateKeyDto FormTemplate,
    FormMetadataDto? FormMetadata);
