using System.Threading.Channels;

namespace PdfParser.Api.Pipeline;

/// <summary>
/// In-memory job queue: document ids waiting for the PipelineWorker.
///
/// Also holds a process-wide pause gate. When paused, the worker parks on
/// <see cref="WaitIfPausedAsync"/> before running the next job — the already-dequeued id
/// simply waits at the gate, so FIFO order is preserved and nothing is re-enqueued. The
/// pause is global (single-user-first); it survives until <see cref="Resume"/> or restart.
/// </summary>
public class ProcessingQueue
{
    private readonly Channel<long> _channel = Channel.CreateUnbounded<long>();

    private readonly object _lock = new();

    // A *completed* gate means "running"; a fresh, incomplete gate means "paused" (the
    // worker awaits it). We start un-paused.
    private TaskCompletionSource _gate = NewCompletedGate();

    private static TaskCompletionSource NewCompletedGate()
    {
        var tcs = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
        tcs.SetResult();
        return tcs;
    }

    public bool IsPaused
    {
        get
        {
            lock (_lock)
                return !_gate.Task.IsCompleted;
        }
    }

    public ValueTask EnqueueAsync(long documentId, CancellationToken ct = default) =>
        _channel.Writer.WriteAsync(documentId, ct);

    public IAsyncEnumerable<long> ReadAllAsync(CancellationToken ct) =>
        _channel.Reader.ReadAllAsync(ct);

    /// <summary>Awaited by the worker before each job — returns immediately while running,
    /// blocks until <see cref="Resume"/> while paused.</summary>
    public Task WaitIfPausedAsync(CancellationToken ct)
    {
        Task gate;
        lock (_lock)
            gate = _gate.Task;
        return gate.WaitAsync(ct);
    }

    public void Pause()
    {
        lock (_lock)
            if (_gate.Task.IsCompleted)
                _gate = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
    }

    public void Resume()
    {
        lock (_lock)
            _gate.TrySetResult();
    }
}
