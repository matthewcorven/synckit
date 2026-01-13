using Microsoft.AspNetCore.Mvc;
using SyncKit.Server.Storage;

namespace SyncKit.Server.Controllers;

[ApiController]
[Route("tests")]
public class TestsController : ControllerBase
{
    private readonly IStorageAdapter _storage;
    private readonly IWebHostEnvironment _env;
    private readonly ILogger<TestsController> _logger;

    public TestsController(IStorageAdapter storage, IWebHostEnvironment env, ILogger<TestsController> logger)
    {
        _storage = storage;
        _env = env;
        _logger = logger;
    }

    [HttpPost("clear")]
    public async Task<IActionResult> ClearAll(CancellationToken ct)
    {
        // Only allow in development or when explicitly enabled via env var
        var allow = Environment.GetEnvironmentVariable("ALLOW_TEST_ENDPOINTS") == "true" || _env.IsDevelopment();
        if (!allow)
        {
            _logger.LogWarning("Attempt to call /tests/clear when tests endpoints are disabled");
            return Forbid();
        }

        try
        {
            await _storage.ClearAllAsync(ct);
            _logger.LogInformation("/tests/clear invoked: storage reset");
            return Ok(new { status = "ok" });
        }
        catch (NotSupportedException)
        {
            _logger.LogWarning("Storage adapter does not support ClearAllAsync - attempting CleanupAsync as fallback");
            await _storage.CleanupAsync(ct: ct);
            return Ok(new { status = "ok" });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to clear storage via /tests/clear");
            return StatusCode(500, new { status = "error", message = ex.Message });
        }
    }
}
