using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;

namespace DogTrials.Api.Data;

public sealed class TrialCounterAllocator(DogTrialsDbContext context)
{
    public async Task<int> AllocateSequenceNumberAsync(Guid trialId, CancellationToken ct = default)
    {
        var sql = @"
UPDATE TrialCounters WITH (UPDLOCK, HOLDLOCK)
SET NextSequenceNumber = NextSequenceNumber + 1
OUTPUT DELETED.NextSequenceNumber
WHERE TrialId = @trialId";

        var parameter = new SqlParameter("@trialId", trialId);

        var sequenceNumber = await context.Database
            .SqlQueryRaw<int>(sql, parameter)
            .FirstOrDefaultAsync(ct);

        return sequenceNumber;
    }
}
