using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.IdentityModel.Tokens;
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
builder.Services.AddSingleton<UserRepository>();
builder.Services.AddSingleton<SettingsService>();
builder.Services.AddSingleton<SecretsService>();
builder.Services.AddSingleton<AuthService>();
builder.Services.AddSingleton<ProcessingQueue>();
builder.Services.AddTransient<EnrichmentService>();
builder.Services.AddTransient<CategorizationService>();
builder.Services.AddTransient<LlmService>();

// Conversion can be slow on CPU; give marker a generous ceiling.
builder.Services.AddHttpClient<MarkerClient>(c => c.Timeout = TimeSpan.FromMinutes(30));

// Short-timeout client for marker /health probes + the singleton that TTL-caches results
// (used to pause/resume processing when an off-VPS marker is down).
builder.Services.AddHttpClient("marker-health", c => c.Timeout = TimeSpan.FromSeconds(5));
builder.Services.AddSingleton<MarkerHealthMonitor>();

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

// ── Authentication / authorization ───────────────────────────────────────────
// JWT bearer. The signing key (App:JwtKey, or a generated vault keyfile) is resolved the
// same way here for validation and inside AuthService for issuance, so both agree.
var appOptions =
    builder.Configuration.GetSection("App").Get<AppOptions>() ?? new AppOptions();
var signingKey = AuthService.ResolveSigningKey(appOptions);

builder
    .Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.MapInboundClaims = false; // keep claim types verbatim (ClaimTypes.* survive)
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = false,
            ValidateAudience = false,
            ValidateLifetime = true,
            ValidateIssuerSigningKey = true,
            IssuerSigningKey = signingKey,
            NameClaimType = System.Security.Claims.ClaimTypes.Name,
            RoleClaimType = System.Security.Claims.ClaimTypes.Role,
            ClockSkew = TimeSpan.FromMinutes(1),
        };

        // SignalR websockets can't send an Authorization header — accept the token from
        // the access_token query string for hub connections.
        options.Events = new JwtBearerEvents
        {
            OnMessageReceived = ctx =>
            {
                var token = ctx.Request.Query["access_token"];
                if (!string.IsNullOrEmpty(token) && ctx.HttpContext.Request.Path.StartsWithSegments("/hub"))
                    ctx.Token = token;
                return Task.CompletedTask;
            },
        };
    });

builder.Services.AddAuthorization(o =>
{
    o.AddPolicy("Admin", p => p.RequireRole(nameof(PdfParser.Api.Models.UserRole.Admin)));
    // Lock everything down by default; public endpoints opt out with AllowAnonymous.
    o.FallbackPolicy = new Microsoft.AspNetCore.Authorization.AuthorizationPolicyBuilder()
        .RequireAuthenticatedUser()
        .Build();
});

// Permissive CORS for the React dashboard (dev) + SignalR. The bearer token travels in
// the Authorization header / access_token query, not a cookie, so this is safe behind
// the Cloudflare tunnel.
builder.Services.AddCors(o =>
    o.AddDefaultPolicy(p =>
        p.SetIsOriginAllowed(_ => true).AllowAnyHeader().AllowAnyMethod().AllowCredentials()
    )
);

var app = builder.Build();

// Build the schema (incl. FTS5 + multi-tenant migration), then load settings.
app.Services.GetRequiredService<Database>().Initialize();
app.Services.GetRequiredService<SettingsService>().Load();

app.UseCors();
app.UseAuthentication();
app.UseAuthorization();

app.MapOpenApi().AllowAnonymous();
app.MapScalarApiReference().AllowAnonymous(); // interactive API explorer at /scalar

app.MapAuthEndpoints();

// Everything below requires a logged-in user. Admin-only routes add their own policy.
app.MapDocumentsEndpoints();
app.MapStatsEndpoints();
app.MapSettingsEndpoints();
app.MapOllamaEndpoints();
app.MapSecretsEndpoints();
app.MapCategoryEndpoints();
app.MapFoldersEndpoints();

// Apply the default auth requirement to the feature endpoints. Auth + the health probe
// opt out explicitly (AllowAnonymous), so this only bites the app's own surface.
app.MapHub<LiveHub>("/hub/live").RequireAuthorization();

app.MapGet("/", () => Results.Redirect("/scalar")).AllowAnonymous();

app.Run();
