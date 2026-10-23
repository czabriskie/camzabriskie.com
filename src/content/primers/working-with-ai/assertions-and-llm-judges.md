---
title: Assertions and LLM judges, and how judges go wrong
description: The two ways to check an AI feature's output automatically, code that tests a fact and a model that grades the answer, when to use each, how to prove a judge agrees with a person before trusting it, and the biases judges are known to have.
order: 7
updated: 2026-10-17
---

[Error analysis](/primers/working-with-ai/error-analysis/) ends with a counted list of failure modes for a made-up library assistant: wrong hours on holidays, booking rooms without confirming, answering from an outdated policy page. Some of those you fix once. The ones you'll keep working on need a check that runs every time the prompt or model changes, without a person reading every trace. There are two kinds of automated check, and this primer is about choosing between them and trusting the result.

## A few terms

- **Assertion**: a check written in ordinary code that tests something definite about an output or trace. "The answer contains no internal ID", "the `book_room` tool was called with a room number". Anthropic's docs call this **code-based grading** [@anthropic-develop-tests].
- **LLM-as-judge**: a separate model call that reads an output and grades it, for qualities code can't test, like "the answer is supported by the policy page it cites" [@zheng-2023-llm-judge].
- **Grader** or **evaluator**: either of the above. Vendors use both words for the same thing [@anthropic-agent-evals] [@ms-foundry-observability].
- **Reference answer**: a known-correct answer the check compares against, when one exists.
- **Pass rate**: the share of test cases that pass. In normal software tests you expect 100%. Here you usually don't (see below).
- **Likert scale**: a rating from 1 to 5 (or similar), "very poor" to "excellent".

## Start with code

Of the library's failure modes, two can be checked with plain code once you write down what "correct" means.

**Holiday hours.** The library's calendar is data. If the question is about a date, the right hours are known, so the check pulls the times out of the answer and compares them with the calendar. No model needed.

**Booking without confirming.** The trace records every tool call. The rule from the librarian is "never call `book_room` until the patron has confirmed the room and the time", which is a fact about the order of steps:

```python
def confirmed_before_booking(trace):
    """Fail if book_room was called before the patron confirmed."""
    confirmed = False
    for step in trace.steps:
        if step.role == "patron" and step.confirms_booking:
            confirmed = True
        if step.tool == "book_room" and not confirmed:
            return False
    return True
```

How `confirms_booking` gets set is up to your app. If the assistant asks a yes-or-no question before booking, it's a string check on the reply. Either way the check runs in milliseconds, costs nothing, and gives the same answer every time.

Every source here prefers code where it works. Anthropic's docs rank code-based grading first, as the fastest and most reliable, and add that it lacks nuance for anything subjective [@anthropic-develop-tests]. Anthropic's agent guide names the weakness more precisely: code is brittle against correct answers that don't match the expected pattern exactly [@anthropic-agent-evals]. Husain and Shankar lay out the same order as a cost ladder: simple assertions first, then code that checks structure or runs things, and an LLM judge only for problems you'll keep iterating on, since a judge needs labeled examples and ongoing upkeep [@husain-shankar-evals-faq].

Husain adds that these checks don't need to pass 100% of the time. How many failures you'll tolerate is a product decision [@husain-evals].

## When you need a judge

The third failure mode, "answered from an outdated policy page", is harder. The answer might quote the right page loosely, or combine two pages correctly, or paraphrase. No regular expression decides whether an answer is faithful to a document. A model can.

A judge is a prompt. For this failure it gets the patron's question, the policy pages that were retrieved (with their dates), and the answer, and returns a verdict. Two design choices matter more than the wording.

**Ask about one failure, and ask for pass or fail.** Husain argues for a binary verdict over a 1 to 5 scale: people can't agree on the difference between a 3 and a 4, scales need larger samples to show a change, and raters drift to the middle to avoid deciding [@husain-shankar-evals-faq]. If you want to track partial progress, split the quality into several pass/fail checks instead. He also recommends a separate judge for each failure mode rather than one judge grading everything [@husain-shankar-evals-faq].

**Ask for the reasoning, then the verdict.** Have the judge write a short critique before its answer. Husain wants critiques detailed enough to reuse as examples in the judge's own prompt [@husain-llm-judge], and OpenAI's guide likewise suggests having the judge reason before scoring [@openai-eval-best-practices].

### Vendors don't agree on scales

Husain's binary-only position is the strongest stance among these sources. The vendors are mixed:

| Source | Scale it recommends or ships |
|---|---|
| Husain and Shankar | Pass/fail only, with a written critique [@husain-shankar-evals-faq] |
| OpenAI's best-practices guide | Pairwise comparison or pass/fail "for more reliability" [@openai-eval-best-practices] |
| Anthropic's test-development docs | Shows both a 1 to 5 Likert grader and a yes/no grader as examples [@anthropic-develop-tests] |
| Microsoft Foundry, general evaluators | Coherence and fluency on a 1 to 5 scale, counted as passing at 3 or above [@ms-foundry-general-evaluators] |
| Microsoft Foundry, agent evaluators | Mostly pass/fail; some score 1 to 5 and convert to pass/fail at a threshold [@ms-foundry-agent-evaluators] |

Microsoft's approach, a scale with a pass mark, sits between the two camps: you get a number for dashboards and a verdict for gates. Husain's objection still applies to the number, since someone has to decide what makes a response a 3.

## Prove the judge agrees with your expert

A judge is a classifier, and an untested one is a guess. Every source here says to compare its verdicts with a person's before relying on it. OpenAI lists "not calibrating your automated metrics against human evals" as an anti-pattern [@openai-eval-best-practices], Anthropic says model graders need calibration against human graders [@anthropic-agent-evals], and Husain gives the most concrete method [@husain-llm-judge]:

1. Have the domain expert label traces pass or fail, with a critique each.
2. Split the labels three ways: about 10 to 20% as examples to put in the judge's prompt, about 40 to 45% as a **development set** to tune the prompt against, and 40 to 45% as a **test set** you look at only at the end.
3. Aim for 30 to 50 examples of each label in each set.
4. Tune the judge prompt until it agrees with the expert on the development set, then measure it once on the test set.

The test set never goes into the prompt. A judge tuned on the examples it's tested on will look better than it is, which is the same problem as benchmark contamination in [the next primer](/primers/working-with-ai/benchmarks-and-their-limits/).

### Report two numbers, not one

Say the test set has 100 traces the librarian labeled: 50 pass and 50 fail. The judge agrees on 47 of the 50 passes and 44 of the 50 fails.

- Agreement on passes: 47 / 50 = 94%.
- Agreement on fails: 44 / 50 = 88%.
- Overall agreement: (47 + 44) / 100 = 91%.

Husain says to report the first two separately and not lean on the third [@husain-llm-judge]. His example shows why: if only 5% of real traces fail, a judge that always says "pass" agrees with the expert 95% of the time and catches none of the failures [@husain-llm-judge]. For a failure-mode judge, the rate on the expert's fails is the number you care about most.

## How judges are biased

The best-known study of LLM judges, Zheng and colleagues' 2023 paper, found that a strong judge (GPT-4 at the time) agreed with human raters about as often as the humans agreed with each other: about 85% against 81%, counting only the comparisons where neither side called a tie [@zheng-2023-llm-judge]. The same paper named three biases that later work keeps returning to [@zheng-2023-llm-judge]:

| Bias | What happens | What helps |
|---|---|---|
| **Position** | Shown two answers, the judge favors one slot. GPT-4 gave the same verdict after the answers were swapped only about two thirds of the time. | Ask twice with the order swapped and count only verdicts that hold both ways. |
| **Verbosity** | The judge prefers longer answers, even when the shorter one is clearer. | Control for response length, as OpenAI's guide also advises [@openai-eval-best-practices]. |
| **Self-enhancement** | The judge favors answers written by its own model. | Use a different model to judge, or check for the effect in your own labels. |

Wang and colleagues showed how large the position effect can be. By changing only the order of two answers, they could make the open model Vicuna-13B appear to beat ChatGPT on 66 of 80 questions when ChatGPT was the judge [@wang-2023-fair-evaluators]. Their fixes were the ones in the table: have the judge give evidence before rating, average across both orders, and send the hardest cases to a person [@wang-2023-fair-evaluators].

Single-answer pass/fail judges, the kind recommended above, sidestep position bias because there's only one answer to look at. Length and self-preference still apply.

### Where the evidence disagrees on self-preference

Zheng and colleagues saw signs of self-preference but said their data was too limited to conclude the bias exists [@zheng-2023-llm-judge]. Panickssery, Bowman, and Feng later found that models can recognize their own writing and that the better a model recognizes itself, the more it favors itself [@panickssery-2024-self-preference]. The practical advice splits the same way. Anthropic's docs say it's generally best to use a different model to grade than the one that wrote the output [@anthropic-develop-tests]. Husain and Shankar say using the same model is usually fine, because judging one narrow failure is a different task from writing the answer, and what matters is the judge's measured agreement with your expert on held-out data [@husain-shankar-evals-faq]. If you validate the judge as above, the measurement settles it for your case either way.

## RAG metrics are judges too

Ready-made RAG metrics are LLM judges with a fixed prompt. RAGAS, a widely used framework, scores three things without needing a reference answer [@es-2023-ragas]:

- **Faithfulness**: a model splits the answer into separate claims and checks each against the retrieved text. The score is the share of claims supported.
- **Answer relevance**: whether the answer addresses the question.
- **Context relevance**: how much of the retrieved text was needed to answer.

Faithfulness is close to the library's "outdated policy page" judge. It wouldn't catch that failure on its own, though: an answer can be perfectly faithful to the 2024 page that was retrieved, when the 2026 page should have won. Husain and Shankar say off-the-shelf judge prompts like these need the same validation against your own labels as any judge you write [@husain-shankar-evals-faq].

## Agents: grade the outcome, the path, or both

For an agent, the trace has many steps, and you can check the end state or the route to it. The sources lean different ways.

Anthropic's agent guide says it's often better to grade what the agent produced than the path it took, because agents find valid routes nobody anticipated [@anthropic-agent-evals]. Microsoft Foundry ships both kinds: "system" evaluators that check the outcome, like Task Completion, and "process" evaluators that check each step, like Tool Selection. One of them, Task Navigation Efficiency, compares the agent's tool calls with an expected sequence [@ms-foundry-agent-evaluators]. The library's `confirmed_before_booking` check is a path check, and it should be: the rule is about order, so the order is the outcome that matters.

Agents also make repeated runs important, because the same task can pass once and fail the next time. Anthropic distinguishes two measures [@anthropic-agent-evals], and the τ-bench paper introduced the stricter one [@yao-2024-tau-bench]:

- **pass@k**: the chance that at least one of k attempts succeeds. It rises with k. Right when one success is enough, like generating candidate solutions.
- **pass^k**: the chance that all k attempts succeed. It falls with k. Right when users expect the same good result every time, like a booking assistant.

In the τ-bench paper, even strong agents such as GPT-4o succeeded on under half the tasks, and in the retail domain their pass^8 fell below 25% [@yao-2024-tau-bench].

Code when you can, a judge when you must, and no judge until it agrees with your expert.
