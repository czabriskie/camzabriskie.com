---
title: Benchmarks, and what they can't tell you
description: What a public benchmark measures, why its scores drift from reality through contamination, format sensitivity, grading bugs and selective reporting, and how Anthropic's, OpenAI's, Microsoft's and Meta's evaluation workflows fit around your own evals.
order: 8
updated: 2026-10-17
---

The library assistant from [Error analysis](/primers/working-with-ai/error-analysis/) needs a model, and two candidates are on the table. A leaderboard puts one a few points ahead of the other on a famous benchmark. Whether those points mean the leader will answer patrons' questions about holds and holiday hours better is a separate question, and often they don't.

## A few terms

- **Benchmark**: a fixed public set of questions or tasks with a scoring method, used to compare models under the same conditions. MMLU (multiple-choice questions across many subjects) and SWE-bench (real software bugs to fix) are two well-known ones.
- **Leaderboard**: a public ranking of models by benchmark score.
- **Product eval**: an eval built for one application, like the library assistant's checks from [Assertions and LLM judges](/primers/working-with-ai/assertions-and-llm-judges/). Husain and Shankar draw this line: benchmarks help you pick a base model, while product evals test your whole system, prompts, retrieval, tools and all [@husain-shankar-evals-faq].
- **Contamination**: benchmark questions, or text very close to them, ending up in a model's training data, so the test measures memory instead of ability [@sainz-2023-contamination].
- **Held-out set**: test data deliberately kept away from whoever, or whatever, is being tuned.
- **Saturation**: when models score near the maximum on a benchmark, so it no longer tells them apart.

## What a benchmark is good for

A benchmark runs every model on the same tasks with the same scoring, which a product eval can't do across dozens of models. The good ones are also hard in a realistic way. SWE-bench, for example, is 2,294 real issues from 12 popular Python projects on GitHub; a model gets the code and the issue and has to change the code to fix it, often across several files. When it came out in 2023, the best model solved under 2% of them [@jimenez-2024-swe-bench].

Microsoft's guidance puts benchmarks at the first of three stages: comparing candidate models on public datasets, or on your own data, before you build anything [@ms-foundry-observability]. Narrowing a shortlist suits them well.

## Why the score drifts from reality

### Contamination

Models are trained on huge amounts of web text, and popular benchmarks are on the web. Sainz and colleagues argued in 2023 that nobody knew how much this inflated published results, because it's hard to measure, and that contamination should be checked for each benchmark separately [@sainz-2023-contamination]. Several studies since have tried.

**Rewriting the test.** Zhang and colleagues commissioned GSM1k, 1,205 new grade-school math problems written to match the style and difficulty of the popular GSM8k benchmark. Some model families scored up to 8% lower on the new problems, and showed signs of overfitting at almost every size. Models that were more likely to reproduce GSM8k text tended to have bigger gaps. But many models, especially the strongest ones, scored about the same on both [@zhang-2024-gsm1k].

**Probing for memory.** Deng and colleagues hid one wrong answer option in multiple-choice questions and asked models to fill it in. On MMLU, ChatGPT and GPT-4 guessed the hidden option exactly 52% and 57% of the time, which the authors take as a sign the test data leaked into training [@deng-2024-contamination].

**Measuring overlap and its effect.** Meta's Llama 3 paper measured how much of each benchmark overlapped with its own training data, then compared scores on the overlapping and clean parts [@meta-llama3-2024]:

| Benchmark | Share flagged as contaminated | Estimated score gain (largest model) |
|---|---|---|
| HellaSwag | 85% | 14.3 points |
| PiQA | 55% | 8.1 points |
| Natural Questions | 52% | 0.8 points |
| SQuAD | 0% | 0.0 points |
| MMLU, HumanEval, MBPP | too high to estimate a gain | n/a |

Overlap doesn't always mean an advantage: Natural Questions was half contaminated with almost no effect on the score. And for some of the most-quoted benchmarks, overlap was so widespread that Meta's method couldn't estimate the effect at all, and the paper says other detection methods may be needed [@meta-llama3-2024].

### Small changes, big swings

Anthropic's 2023 write-up on evaluation problems reported that changing MMLU's answer labels from (A), (B), (C) to (1), (2), (3) could move accuracy by about 5%, and that some MMLU questions are mislabeled or have no right answer [@anthropic-eval-challenges]. A swing that size can reorder models whose scores sit close together.

The grader can be wrong too. Anthropic's agent-eval guide describes a model that scored 42% on CORE-Bench, a research-reproduction benchmark, and 95% once grading bugs and unclear task specs were fixed. One bug marked "96.12" wrong because the expected answer was "96.124991…" [@anthropic-agent-evals].

### How scores get reported

A reported score reflects choices about which runs to show. Chatbot Arena is a crowdsourced leaderboard where people compare two models' answers and vote [@zheng-2023-llm-judge]. In "The Leaderboard Illusion", Singh and colleagues found that a few providers privately tested many model variants there and could publish only the best. Meta tested 27 private variants in the lead-up to the Llama 4 release, and Google and OpenAI each received about a fifth of all Arena data, while 83 open-weight models together got about 30% [@singh-2025-leaderboard-illusion]. Extra Arena data could raise a model's Arena results substantially, which rewards fitting the Arena rather than general quality [@singh-2025-leaderboard-illusion].

Vendors' own reports state choices like these in their method notes. Meta's Muse Spark 1.1 evaluation report, for example, uses competitors' self-reported numbers for coding and agent benchmarks, and for the rest reports the better of the self-reported score and Meta's own rerun. It also notes that its test setup may not be tuned for other vendors' models [@meta-muse-spark-report]. That's disclosed and reasonable, and it's also a reason to read the method section before the chart.

### The model may know it's a test

The same report checked whether the model noticed it was being evaluated during its alignment tests. A classifier reading the model's reasoning found it suspected an evaluation in 27.9% of samples, with the awareness affecting its behavior in 14.3%. Meta calls this a lower bound, since a model can notice without saying so [@meta-muse-spark-report]. A score earned while the model suspects a test may not describe how it behaves when it doesn't.

### Saturation

Benchmarks wear out. When the best models score near 100%, a benchmark stops separating them. Anthropic's guide applies the same idea to your own evals: hard "capability" evals start with low pass rates, and once the agent reliably passes them they "graduate" into a regression suite that should stay near 100% [@anthropic-agent-evals].

## How the vendor workflows fit together

The four big vendors describe evaluation in similar steps, and none of those steps is "trust the leaderboard":

| Vendor | Workflow they describe | Notes |
|---|---|---|
| Anthropic | Define specific, measurable success criteria, then build task-specific evals, automated where possible [@anthropic-develop-tests]. For agents: tasks, repeated trials, transcripts, and graders [@anthropic-agent-evals]. | Guidance, not a hosted eval product. |
| OpenAI | Define the objective, collect a dataset, define metrics, run and compare, evaluate continuously [@openai-eval-best-practices]. The Evals API takes a data schema plus testing criteria [@openai-evals-guide]. | The Evals platform is being retired, see below. |
| Microsoft Foundry | Model selection with benchmarks, then pre-production evaluation on your data, then monitoring of production traffic [@ms-foundry-observability]. Choose what to evaluate, pick evaluators, run, review [@ms-foundry-eval-overview]. | Built-in evaluators plus custom ones [@ms-foundry-eval-overview]. |
| Meta | Publishes benchmark results with contamination analysis for its models, and kept its human-evaluation prompts away from its modeling teams to prevent contamination or overfitting [@meta-llama3-2024]. | A model maker's view; the sources here describe no app-builder workflow. |

They agree on the order: benchmarks to choose a model, your own data and graders for everything after. Meta's practice of hiding the human-eval prompts from the people training the model is the same rule as keeping a judge's test set out of its prompt in [Assertions and LLM judges](/primers/working-with-ai/assertions-and-llm-judges/#prove-the-judge-agrees-with-your-expert): whoever is being tuned must not see the questions.

### The OpenAI Evals platform is being retired {only: OpenAI}

OpenAI announced on June 3, 2026 that its Evals platform is deprecated. Existing evals become read-only on October 31, 2026, and the dashboard and API are scheduled to shut down on November 30, 2026. The graders used in eval workflows are part of the same transition, and OpenAI points to the open-source tool Promptfoo as the migration path [@openai-deprecations]. The Evals guide still suggests a feature called Datasets to people new to evals, but that page carries the same deprecation banner, and the deprecation notice itself names Promptfoo, not Datasets, as the replacement [@openai-evals-guide] [@openai-deprecations].

Microsoft's Foundry SDK builds its cloud evaluations on OpenAI's Python types for evals, through a client the Foundry project hands out [@ms-foundry-cloud-evaluation]. The Foundry pages cited here don't mention OpenAI's deprecation, so whether it affects Foundry isn't stated.

None of this changes the method. A dataset, a set of checks, and a run that compares versions can live in any tool, or in a test file next to your code.

## Where the sources disagree

How much contamination matters depends on who's measuring. Deng and colleagues read high option-guessing rates on MMLU as evidence of contamination [@deng-2024-contamination]. Meta's analysis says simple overlap is too blunt to estimate the effect on MMLU at all, and found heavy overlap with no gain on other benchmarks [@meta-llama3-2024]. GSM1k found real overfitting in some model families and very little in the strongest models [@zhang-2024-gsm1k]. All of them support Sainz and colleagues' starting point, that the answer differs by benchmark and by model and has to be measured each time [@sainz-2023-contamination].

The vendors also differ on what a benchmark is for. Microsoft builds benchmarks into its first lifecycle stage [@ms-foundry-observability], and Meta's reports lead with them [@meta-muse-spark-report]. Husain and Shankar's view is narrower: a benchmark like MMLU helps pick a base model and says nothing about your use case [@husain-shankar-evals-faq]. For a coding agent with broad, varied tasks, they do suggest starting from public benchmarks such as SWE-bench, then adding product-specific tests [@husain-shankar-evals-faq].

A benchmark picks the shortlist; your own traces pick the model.
