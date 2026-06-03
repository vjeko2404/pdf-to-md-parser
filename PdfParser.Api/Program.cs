using PdfParser.Api.Clients;
using PdfParser.Api.Config;
using PdfParser.Api.Data;
using PdfParser.Api.Endpoints;
using PdfParser.Api.Hubs;
using PdfParser.Api.Pipeline;
using PdfParser.Api.Services;
using Scalar.AspNetCore;

var builder = WebApplication.CreateBuilder(args);

builder.Services.Configure<AppOptions>(builder.Configuration.GetSection("App"));

// Serialize enums as strings ("Failed", not 3) for the dashboard's benefit.
builder.Services.ConfigureHttpJsonOptions(o =>
    o.SerializerOptions.Converters.Add(new System.Text.Json.Serialization.JsonStringEnumConverter())
);

builder.Services.AddSingleton<Database>();
builder.Services.AddSingleton<DocumentRepository>();
builder.Services.AddSingleton<CategoryRepository>();
builder.Services.AddSingleton<SettingsService>();
builder.Services.AddSingleton<SecretsService>();
builder.Services.AddSingleton<ProcessingQueue>();
builder.Services.AddTransient<EnrichmentService>();
builder.Services.AddTransient<CategorizationService>();
builder.Services.AddTransient<LlmService>();

// Conversion can be slow on CPU; give marker a generous ceiling.
builder.Services.AddHttpClient<MarkerClient>(c => c.Timeout = TimeSpan.FromMinutes(30));

// Enrichment is best-effort and must never stall the queue — cap it tight so a
// slow/broken Ollama degrades gracefully instead of hanging each doc for minutes.
builder.Services.AddHttpClient<OllamaClient>(c => c.Timeout = TimeSpan.FromSeconds(90));
builder.Services.AddHttpClient<OllamaAdmin>(c => c.Timeout = TimeSpan.FromSeconds(30));

// OpenAI-compatible provider (OpenRouter/Gemini/OpenAI/…) — slightly longer ceiling
// for remote latency. Best-effort like Ollama; never blocks the queue.
builder.Services.AddHttpClient<OpenAiClient>(c => c.Timeout = TimeSpan.FromSeconds(120));

builder.Services.AddHostedService<DownloadWatcher>();
builder.Services.AddHostedService<PipelineWorker>();

builder.Services.AddSignalR();
builder.Services.AddOpenApi();

// Permissive CORS for the React dashboard (dev) + SignalR.
builder.Services.AddCors(o =>
    o.AddDefaultPolicy(p =>
        p.SetIsOriginAllowed(_ => true).AllowAnyHeader().AllowAnyMethod().AllowCredentials()
    )
);

var app = builder.Build();

// Build the schema (incl. FTS5), then load settings (seeding env defaults on first run).
app.Services.GetRequiredService<Database>().Initialize();
var settingsService = app.Services.GetRequiredService<SettingsService>();
settingsService.Load();

// Seed a starter set of categories once (guarded by a flag so user deletions stick).
if (settingsService.Get("categoriesSeeded", "false") != "true")
{
    await app.Services.GetRequiredService<CategoryRepository>().SeedDefaultsAsync();
    settingsService.Update(new Dictionary<string, string> { ["categoriesSeeded"] = "true" });
}

app.UseCors();
app.MapOpenApi();
app.MapScalarApiReference(); // interactive API explorer at /scalar

app.MapDocumentsEndpoints();
app.MapStatsEndpoints();
app.MapSettingsEndpoints();
app.MapOllamaEndpoints();
app.MapSecretsEndpoints();
app.MapCategoryEndpoints();
app.MapFoldersEndpoints();
app.MapHub<LiveHub>("/hub/live");

app.MapGet("/", () => Results.Redirect("/scalar"));

app.Run();
