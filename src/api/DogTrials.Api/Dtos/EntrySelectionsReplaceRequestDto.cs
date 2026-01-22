namespace DogTrials.Api.Dtos;

public sealed record EntrySelectionsReplaceRequestDto(
    string Grid,
    List<EntrySelectionCellDto> Items);
