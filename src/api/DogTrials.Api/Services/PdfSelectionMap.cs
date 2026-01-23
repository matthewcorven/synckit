using DogTrials.Api.Dtos;

namespace DogTrials.Api.Services;

public sealed class PdfSelectionMap
{
    private readonly HashSet<string> _selected;

    public PdfSelectionMap(EntrySelectionsDto selections)
    {
        _selected = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        AddSelections(selections.Upper);
        AddSelections(selections.Lower);
    }

    public bool IsSelected(string row, string col)
    {
        return _selected.Contains(BuildCellKey(row, col));
    }

    private void AddSelections(IEnumerable<EntrySelectionCellDto> items)
    {
        foreach (var item in items)
        {
            if (string.IsNullOrWhiteSpace(item.Row) || string.IsNullOrWhiteSpace(item.Col))
            {
                continue;
            }

            if (string.IsNullOrWhiteSpace(item.Value))
            {
                continue;
            }

            _selected.Add(BuildCellKey(item.Row, item.Col));
        }
    }

    private static string BuildCellKey(string row, string col)
    {
        return $"{row.Trim().ToUpperInvariant()}::{col.Trim().ToUpperInvariant()}";
    }
}
