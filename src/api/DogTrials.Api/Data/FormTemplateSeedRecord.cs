using System.Text.Json;

namespace DogTrials.Api.Data;

public sealed class FormTemplateSeedRecord
{
    public string OrganizationCode { get; set; } = string.Empty;
    public string SportCode { get; set; } = string.Empty;
    public string FormCode { get; set; } = string.Empty;
    public string Version { get; set; } = string.Empty;
    public JsonElement GridConfig { get; set; }
}
