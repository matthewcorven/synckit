namespace DogTrials.Api.Entities;

public sealed class FormTemplate
{
    public int FormTemplateId { get; set; }
    public string OrganizationCode { get; set; } = string.Empty;
    public string SportCode { get; set; } = string.Empty;
    public string FormCode { get; set; } = string.Empty;
    public string Version { get; set; } = string.Empty;
    public string GridConfigJson { get; set; } = string.Empty; // JSON payload per PRD
}
