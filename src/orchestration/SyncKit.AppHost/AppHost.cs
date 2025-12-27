// SyncKit Aspire AppHost - Orchestrates the full SyncKit development environment
// Supports: In-memory or real PostgreSQL/Redis, TypeScript or C# backend, frontend examples

using Aspire.Hosting;

var builder = DistributedApplication.CreateBuilder(args);

// ============================================================================
// Configuration
// ============================================================================
// Backend selection: "typescript" | "csharp" | "both"
var backendMode = builder.Configuration["SyncKit:Backend"] ?? "typescript";

// Storage mode: "inmemory" | "postgres" (also enables Redis for pub/sub)
var storageMode = builder.Configuration["SyncKit:Storage"] ?? "inmemory";

// Frontend example to run: "react" | "vue" | "svelte" | "none"
var frontendMode = builder.Configuration["SyncKit:Frontend"] ?? "react";

// ============================================================================
// Infrastructure Resources (PostgreSQL + Redis)
// ============================================================================
IResourceBuilder<PostgresServerResource>? postgres = null;
IResourceBuilder<PostgresDatabaseResource>? syncKitDb = null;
IResourceBuilder<RedisResource>? redis = null;

if (storageMode == "postgres")
{
    // PostgreSQL for document storage, vector clocks, deltas, sessions
    postgres = builder.AddPostgres("postgres")
        .WithDataVolume("synckit-postgres-data")
        .WithLifetime(ContainerLifetime.Persistent);
    
    syncKitDb = postgres.AddDatabase("synckit");
    
    // Redis for pub/sub coordination in multi-server deployments
    redis = builder.AddRedis("redis")
        .WithDataVolume("synckit-redis-data")
        .WithLifetime(ContainerLifetime.Persistent);
}

// ============================================================================
// Backend Services
// ============================================================================

// TypeScript Backend (Bun + Hono)
if (backendMode is "typescript" or "both")
{
    var tsServerPath = Path.GetFullPath(
        Path.Combine(builder.AppHostDirectory, "..", "..", "..", "server", "typescript"));
    
    var tsBackend = builder.AddExecutable("synckit-ts-server", "bun", tsServerPath, "run", "dev")
        .WithHttpEndpoint(port: 3000, name: "http", env: "PORT")
        .WithEnvironment("NODE_ENV", "development")
        .WithEnvironment("STORAGE_MODE", storageMode);
    
    if (storageMode == "postgres" && syncKitDb is not null && redis is not null)
    {
        tsBackend
            .WithReference(syncKitDb)
            .WithReference(redis)
            .WaitFor(syncKitDb)
            .WaitFor(redis);
    }
}

// C# Backend (ASP.NET Core)
if (backendMode is "csharp" or "both")
{
    var csharpBackend = builder.AddProject<Projects.SyncKit_Server>("synckit-csharp-server")
        .WithHttpEndpoint(port: 5000, name: "http")
        .WithEnvironment("STORAGE_MODE", storageMode);
    
    if (storageMode == "postgres" && syncKitDb is not null && redis is not null)
    {
        csharpBackend
            .WithReference(syncKitDb)
            .WithReference(redis)
            .WaitFor(syncKitDb)
            .WaitFor(redis);
    }
}

// ============================================================================
// Frontend Examples
// ============================================================================
if (frontendMode != "none")
{
    var examplesPath = Path.GetFullPath(
        Path.Combine(builder.AppHostDirectory, "..", "..", "..", "examples"));
    
    // Determine which backend URL to use for the frontend
    var backendUrl = backendMode == "csharp" 
        ? "http://localhost:5000" 
        : "http://localhost:3000";
    
    switch (frontendMode)
    {
        case "react":
            var reactPath = Path.Combine(examplesPath, "react-example");
            // AddNodeApp with package.json auto-detects npm, then use WithRunScript for "dev"
            builder.AddNodeApp("synckit-react-frontend", reactPath, "node_modules/.bin/vite")
                .WithRunScript("dev")
                .WithHttpEndpoint(port: 5173, name: "http", env: "PORT")
                .WithEnvironment("VITE_SYNCKIT_SERVER_URL", backendUrl)
                .WithExternalHttpEndpoints();
            break;
            
        case "vue":
            var vuePath = Path.Combine(examplesPath, "vue-collaborative-editor");
            builder.AddNodeApp("synckit-vue-frontend", vuePath, "node_modules/.bin/vite")
                .WithRunScript("dev")
                .WithHttpEndpoint(port: 5174, name: "http", env: "PORT")
                .WithEnvironment("VITE_SYNCKIT_SERVER_URL", backendUrl)
                .WithExternalHttpEndpoints();
            break;
            
        case "svelte":
            var sveltePath = Path.Combine(examplesPath, "svelte-collaborative-editor");
            builder.AddNodeApp("synckit-svelte-frontend", sveltePath, "node_modules/.bin/vite")
                .WithRunScript("dev")
                .WithHttpEndpoint(port: 5175, name: "http", env: "PORT")
                .WithEnvironment("VITE_SYNCKIT_SERVER_URL", backendUrl)
                .WithExternalHttpEndpoints();
            break;
    }
}

builder.Build().Run();
