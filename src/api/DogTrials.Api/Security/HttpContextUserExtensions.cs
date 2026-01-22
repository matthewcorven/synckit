using DogTrials.Api.Entities;

namespace DogTrials.Api.Security;

public static class HttpContextUserExtensions
{
    public const string UserIdKey = "UserId";
    public const string UserRoleKey = "UserRole";

    public static Guid GetUserId(this HttpContext context)
    {
        if (context.Items.TryGetValue(UserIdKey, out var value) && value is Guid userId)
        {
            return userId;
        }

        throw new UnauthorizedAccessException("User not provisioned.");
    }

    public static UserRole GetUserRole(this HttpContext context)
    {
        if (context.Items.TryGetValue(UserRoleKey, out var value) && value is UserRole role)
        {
            return role;
        }

        throw new UnauthorizedAccessException("User not provisioned.");
    }
}
