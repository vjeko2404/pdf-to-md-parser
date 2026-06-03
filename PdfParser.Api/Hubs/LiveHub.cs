using Microsoft.AspNetCore.SignalR;

namespace PdfParser.Api.Hubs;

/// <summary>
/// Push-only hub. The pipeline broadcasts "documentUpdated" { id, status, name }
/// as jobs move queued → processing → done/failed. The React dashboard subscribes.
/// </summary>
public class LiveHub : Hub { }
