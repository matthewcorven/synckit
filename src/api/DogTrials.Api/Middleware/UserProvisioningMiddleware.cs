using DogTrials.Api.Security;

namespace DogTrials.Api.Middleware;

public sealed class UserProvisioningMiddleware
{
    private readonly RequestDelegate _next;
    private readonly ILogger<UserProvisioningMiddleware> _logger;

    public UserProvisioningMiddleware(RequestDelegate next, ILogger<UserProvisioningMiddleware> logger)
    {
        _next = next;
        _logger = logger;
    }

    public async Task InvokeAsync(HttpContext context, IUserProvisioningService provisioningService)
    {
        if (context.Request.Path.StartsWithSegments("/api/testauth", StringComparison.OrdinalIgnoreCase))
        {
            await _next(context);
            return;
        }

        if (context.User.Identity?.IsAuthenticated == true)
        {
            var result = await provisioningService.ProvisionAsync(context.User, context.RequestAborted);
            if (result is not null)
            {
                context.Items[HttpContextUserExtensions.UserIdKey] = result.UserId;
                context.Items[HttpContextUserExtensions.UserRoleKey] = result.Role;
            }
            else
            {
                _logger.LogWarning("User provisioning did not complete for authenticated request.");
            }
        }

        await _next(context);
    }
}
