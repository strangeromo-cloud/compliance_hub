# How this system is meant to improve

A record of the analysis behind `case_signals` and `/api/evolution`, so the next
person to work on this does not have to rediscover why the line is drawn where
it is.

## The two directions

Improvement here means two different things, and conflating them is how a
compliance tool goes wrong.

**Reading the question better.** A person writes a sentence; the system has to
work out which lanes it touches and which facts it will need. Today that is
regex vocabulary and per-gem `requiredFacts`. When it reads badly the cost is
visible: nothing matches, every lane runs by default, and the reader is
interrupted three times for facts that could have been asked for at the start.

**Searching better.** Name matching, list coverage, data freshness. When this
goes wrong the cost is a missed designation, which is not an inconvenience.

The first can be automated. The second can be automated only in one direction.

## What may evolve, and what may not

| May evolve | Never |
| --- | --- |
| Routing vocabulary (`public/intent.js`) | The five clearance conditions (`src/clearance.js`) |
| A gem's `requiredFacts` | The triage gates and their citations (`src/triage.js`) |
| Match thresholds — **toward recall only** | Cross-lane dependency edges (`src/lane-dependencies.js`) |
| Sync cadence per source | Any capability's `cite` |
| The probe corpus | "A declaration is not verified evidence" |

Everything in the right column points at a provision. Provisions do not change
because a model concluded they should. This is not a style preference: the one
property this system has that a general-purpose assistant does not is that every
conclusion traces to a rule and a dataset, and an agent that edits the right
column destroys exactly that.

The left column is safe for a specific reason — its failure modes are benign. A
routing term that should not be there puts an extra lane on the path, which
triage or a human removes. A missing term drops the run into "nothing matched,
so all three lanes ran", which the interface states plainly rather than hiding.
Neither can turn into a wrong answer about a transaction.

Match thresholds sit in the left column with a condition attached. A false
positive is a nuisance a reviewer resolves; a missed match is a compliance
failure. So tuning may only trade precision away for recall, never the reverse,
and the objective function has to be written that way or it will quietly learn
to suppress hits to look clean.

## The shape of an automated change

Not a commit. A proposal:

- the diff
- the evidence: which recorded cases, what each did before and after
- a new test that fails before the change and passes after
- the result of the existing suite

A human merges. The suite is the regression gate, and the guards that already
exist — no second copy of the routing rules, no capability reaching the model or
the network — are the pattern to extend to anything else the right column needs
protected.

## What is measured, and why those four

`case_signals` records one row per run, never pruned by the history limits, and
`/api/evolution` aggregates it. It is shown on the data-coverage page because it
answers the same question as the rest of that page: what got through, and what
did not.

- **Fallback rate** — runs where no term matched and every lane ran. The headline
  number for how well the vocabulary covers how people actually write.
- **Ask rate** — runs that had to stop and interrupt the reader.
- **Rounds per thread** — how many exchanges a case takes.
- **Open steps** — cases that ended still holding an unanswered step.

Plus the two lists that say where to look: which steps most often stop a run, and
which fields were supplied only after being asked for. A field in the second list
is a field the composer could have asked for up front.

Two constraints on using these. Rounds per thread must never be optimised alone —
a model rewarded for fewer rounds learns to ask for less, and open steps is the
counterweight. And a fallback is not a failure of the reader; it is the system
saying it did not understand, which is the behaviour that makes the number
trustworthy in the first place.

## Where a local model fits

The specialists and the synthesis are the only two places this system calls a
model — at most four calls per review, none at all for a briefing, a memo, a
lookup, or in rules mode. Everything else is regex, provisions computed in code,
and database reads.

That shape makes an open-weights model unusually attractive here, and not
primarily for cost. The composer currently warns readers not to enter trade
secrets or unpublished transaction data, because the question is posted to an
external endpoint. Served locally behind an OpenAI-compatible API, that warning
can go — and a compliance tool that cannot be given the real transaction is a
compliance tool working at a permanent discount. `OPENAI_BASE_URL` already exists;
no code change is required.

The narrower use is a small fine-tuned model that predicts which declarable
fields a question will need, so the composer asks up front instead of the run
stopping three times. It decides what to ask a person, never what a provision
means, and the existing stop-and-ask loop is the safety net if it is wrong. That
is the only position in this system where a learned component can be wrong
without being dangerous.

### Verified, not assumed

The on-premise path is a tested route (`test/local-model.test.js`), driven
against a stand-in for `vllm serve`: an ordinary Chat Completions call with
`model`, `messages` and two parameters that are dropped if refused. A server that
400s on `response_format` — older vLLM and TGI do — is retried without it and the
answer remembered per model, so the cost is one failed request rather than one
per call. Streaming is plain SSE.

One thing this turned up rather than confirmed. A reasoning model states its
working before its answer, and Hermes wraps that in `<think>…</think>`. The
working is prose about the problem, so it contains braces — the problem is about
JSON. Matching the first `{` to the last `}` spliced the tail of the explanation
onto the head of the answer and failed with a parse error that read like the
model had malfunctioned. Reasoning blocks are stripped now and the object is
found by balancing braces, quote-aware. Trailing prose after the object, the
other half of the same habit, is covered by the same change.

Both wait on data. A few hundred recorded cases is the floor, which is why the
first work was recording them rather than training on them.
