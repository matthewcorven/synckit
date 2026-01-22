using System.Diagnostics;

namespace DogTrials.Api.Middleware;

public sealed class CorrelationMiddleware(RequestDelegate next)
{
    public async Task InvokeAsync(HttpContext context)
    {
        var traceId = Activity.Current?.TraceId.ToString() ?? context.TraceIdentifier;
        context.Response.Headers["x-support-id"] = traceId;

        await next(context);
    }
}
