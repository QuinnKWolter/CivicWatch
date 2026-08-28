# Tweet Hydration Data Project

This folder is intentionally separate from the CivicWatch app workspace. It has
no `pnpm` scripts, no Node dependencies, and no coupling to the app README or
package manifest.

## Files

- `polite_tweet_hydrator.py` - standalone Python 3 script.
- `truncated_tweets.csv` - local input data, ignored by git.
- `*.jsonl` - local hydration outputs, ignored by git.
- `*.manifest.json` - local run manifests, ignored by git.
- `*.access_issues.jsonl` - compact logs for tombstones, 404s, empty bodies,
  and exhausted errors, ignored by git.

## Current Input Shape

The local `truncated_tweets.csv` inspected on July 13, 2026 contains:

- 3,191,595 total rows
- 2,963,499 rows with numeric `tweet_id`
- 228,096 rows with blank/non-numeric `tweet_id`
- 1,363,281 unique raw `tweet_id` values
- 1,363,280 unique hydratable numeric IDs

The hydrator deduplicates numeric IDs and records the invalid-row counts in the
manifest.

## How To Run

From this folder:

```powershell
cd D:\CivicWatch\tweet-hydration
```

Run a 1,000-ID pilot first:

```powershell
python .\polite_tweet_hydrator.py .\truncated_tweets.csv .\hydrated_tweets.probe1k.jsonl --id-column tweet_id --probe 1000 --user-agent "CivicWatch-Rehydration/1.0 (academic research; contact: you@example.edu)"
```

Then run a 10,000-ID pilot:

```powershell
python .\polite_tweet_hydrator.py .\truncated_tweets.csv .\hydrated_tweets.probe10k.jsonl --id-column tweet_id --probe 10000 --user-agent "CivicWatch-Rehydration/1.0 (academic research; contact: you@example.edu)"
```

Run the full job after both pilots look clean:

```powershell
python .\polite_tweet_hydrator.py .\truncated_tweets.csv .\hydrated_tweets.jsonl --id-column tweet_id --user-agent "CivicWatch-Rehydration/1.0 (academic research; contact: you@example.edu)"
```

Replace `you@example.edu` with a real contact address before any real pilot or
full run.

## Runtime Notes

The default starts at 2 requests/second, with a minimum automatic backoff rate
of 0.25 requests/second. At 2 requests/second, the sleep-only floor for
1,363,280 hydratable IDs is about 7.9 days. With retries, tombstones,
transient errors, and safety backoff, plan for roughly 8-11 days if the
endpoint stays healthy.

To use the old conservative pace, add `--rate 1.0` to any command.

The script is resumable. If it stops, rerun the exact same command and output
path; already-attempted IDs in the JSONL are skipped.

Each run also writes `OUTPUT.access_issues.jsonl` by default. That sidecar is
much smaller than the hydrated payload file and contains one compact record for
each inaccessible or unavailable tweet attempt.

## Statuses

Each JSONL record includes `_meta.status`:

- `ok_text` - hydrated full tweet text.
- `tombstone` - endpoint returned a deletion/unavailable tombstone.
- `not_found` - HTTP 404.
- `empty_body` - HTTP 200 with no JSON body.
- `other_error` - exhausted retries or unexpected payload.

The script pauses hard on `429`, backs off on `503`, and reduces its effective
rate after throttles or repeated transient failures.

For successful retweets, the syndication endpoint often returns the underlying
tweet's canonical payload rather than a payload whose `id_str` matches the
requested retweet ID. The hydrator records both `_meta.requested_id` and
`_meta.payload_id_str`, plus a manifest count named `payload_id_mismatch`.
