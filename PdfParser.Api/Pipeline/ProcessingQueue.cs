using System.Threading.Channels;

namespace PdfParser.Api.Pipeline;

/// <summary>In-memory job queue: document ids waiting for the PipelineWorker.</summary>
public class ProcessingQueue
{
    private readonly Channel<long> _channel = Channel.CreateUnbounded<long>();

    public ValueTask EnqueueAsync(long documentId, CancellationToken ct = default)
        => _channel.Writer.WriteAsync(documentId, ct);

    public IAsyncEnumerable<long> ReadAllAsync(CancellationToken ct)
        => _channel.Reader.ReadAllAsync(ct);
}
