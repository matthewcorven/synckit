namespace DogTrials.Api.Dtos;

public sealed record PaginatedResponse<T>(
    List<T> Items,
    int Page,
    int PageSize,
    int Total);
