// Whether a question opens a compliance review, decided by reading it.
//
// The rules in public/intent.js are keyword matching, and keyword matching is
// wrong here in a way that shows up as a stream of near-identical bugs: 出口至
// was not 出口到, 吗 was only recognised inside 可以吗, "China" was absent where
// 中国 was present. Each fix is one phrasing. The next phrasing is the next bug,
// and the English half was always behind because it was written second.
//
// So this reads the question instead. It is one small call, and it sits on top
// of the rules rather than replacing them:
//
//   the rules recognise it        →  no call, their answer stands
//   the rules recognise nothing   →  ask, because that is where they are blind
//
// That ordering is deliberate. The rules are cheap, they are the same list the
// composer previews with, and where they fire they are right. What they cannot
// do is generalise, which is exactly what a model is for.
//
// Two things it is not allowed to do:
//
//   It cannot stop a review. A question that describes a transaction gets the
//   procedure — that rule is the product's, it is stated on the guide page, and
//   it is checked before this is called. This can only move a question from
//   "review" to "answered", never the other way, and it is asked only when the
//   deterministic side already found nothing to review.
//
//   It cannot fail into an answer. Any error, any unusable reply, any model that
//   is not reachable returns null, and null means the review runs. Skipping a
//   review that was warranted is the costly direction; running one that was not
//   costs three model calls and some of the reader's patience.

import { callJsonModel } from "./llm.js";

const KINDS = new Set(["review", "followup", "general"]);

// Trimmed hard. This decides one thing and is given only what that needs: a
// paragraph of prior conversation and the sentence to classify.
const turn = (item) => `${item.role === "assistant" ? "A" : "Q"}: ${String(item.content || "").replace(/\s+/g, " ").slice(0, 400)}`;

const SYSTEM = `You classify one message in an export-control compliance workbench. Answer with JSON only.

{"kind":"review|followup|general","because":"a few words"}

review    the message describes a transaction, a party, an item, a shipment or an arrangement to be assessed — anything the workbench should run its procedure over. Anything you are unsure about is this.
followup  the message asks about the analysis already in this conversation: what is still blocking it, whether supplying a value would settle it, why a step was skipped, what the previous answer meant. It adds no new transaction of its own.
general   the message asks about the rules, a term, a threshold or a procedure in the abstract, naming no particular party or item.

A message that adds new facts about a deal is review even when it is phrased as a question and even when it refers to the previous turn. "What if the customer were in Vietnam instead" is review: it changes the transaction. "Would supplying the registration number settle it" is followup: it changes nothing and asks about the state of the analysis.

With no prior analysis in the conversation, followup is not available: there is nothing to follow up on.`;

export async function classifyIntent({ question, history = [], config = {} } = {}) {
  const text = String(question || "").trim();
  if (!text || !config?.apiKey) return null;
  const priorTurns = history.filter((item) => item?.content).slice(-4);

  let reply = null;
  try {
    reply = await callJsonModel(config, [
      { role: "system", content: SYSTEM },
      {
        role: "user",
        content: `${priorTurns.length ? `Conversation so far:\n${priorTurns.map(turn).join("\n")}\n\n` : "There is no prior analysis in this conversation.\n\n"}Message to classify:\n${text}`
      }
    ]);
  } catch {
    // Unreachable, refused, rate-limited: the review runs. This is a widening of
    // what gets answered rather than reviewed, so losing it loses nothing that
    // was not already the behaviour.
    return null;
  }

  const kind = KINDS.has(reply?.kind) ? reply.kind : null;
  if (!kind || kind === "review") return null;
  // followup needs something to follow. A model that offers it over an empty
  // conversation has answered about a conversation that does not exist.
  if (kind === "followup" && !history.some((item) => item.role === "assistant")) return null;
  return { kind, because: String(reply?.because || "").slice(0, 80) };
}
