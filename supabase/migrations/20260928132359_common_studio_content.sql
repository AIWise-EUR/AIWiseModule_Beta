-- Extend the existing guarded review pipeline to Common C1-C3.
-- Existing role checks, RPC signatures, RLS, grants and course rows are unchanged.
begin;
alter table public.workspace_content_sources drop constraint workspace_content_sources_course_check;
alter table public.workspace_content_sources add constraint workspace_content_sources_course_check
 check (course in ('aws1','ped','common'));
alter table public.workspace_content_sources drop constraint workspace_content_sources_chapter_check;
alter table public.workspace_content_sources add constraint workspace_content_sources_chapter_check
 check ((course = 'common' and chapter in ('c1','c2','c3')) or (course in ('aws1','ped') and chapter in ('c2','c3')));

-- Generated from the shared text catalog. Do not seed edited browser drafts here.
insert into public.workspace_content_sources(course,chapter,slots) values
('common','c1',$common${
  "c1.block-0": {
    "Heading 1": "What is Generative AI?"
  },
  "c1.block-1": {
    "Text 1": "\n        The word \"GenAI\" is everywhere. But familiarity with a term is not the same as understanding what the thing actually is. This block builds that understanding — from where it came from, to what it is made of.\n      "
  },
  "c1.block-2": {
    "Heading 1": "What is AI? What is GenAI?"
  },
  "c1.block-3": {
    "Text 1": "\n        You have heard the term many times. But what exactly is GenAI, and how did it emerge?\n      ",
    "Text 2": "\n        Artificial intelligence has been developing for more than sixty years. The timeline below traces that broader history. Early systems such as ELIZA in the 1960s relied entirely on rules. They matched patterns in user input and returned prewritten responses. They did not learn from data, and they did not generate new content. Later systems such as Siri, Google Now, and Alexa could retrieve information and respond to voice input, but they still mainly depended on recognition, classification, and retrieval.\n      ",
    "Text 3": "\n        GenAI marks a different point in that history. Systems such as ChatGPT do not simply return stored answers. They generate responses by producing new text based on statistical patterns learned from large amounts of human written language. This is a different mechanism from the one used in earlier systems.\n      ",
    "Text 4": "\n        It is also useful to be precise about the terms. AI is the broadest category and includes many different kinds of systems, such as recommendation engines, fraud detection tools, image classifiers, and medical decision support systems. GenAI is a more specific category within AI. It refers to systems that generate new content rather than simply classifying, ranking, or retrieving information. Large language models, or LLMs, are a further subset within GenAI. They are models designed to generate language based on patterns learned from large amounts of text. Systems such as ChatGPT or Claude are best understood in this way: they are GenAI systems built on LLMs.\n      "
  },
  "c1.block-4": {
    "Diagram label 1": "ELIZA",
    "Diagram label 2": "1960",
    "Diagram label 3": "Pattern",
    "Diagram label 4": "matching",
    "Diagram label 5": "PARRY",
    "Diagram label 6": "1970",
    "Diagram label 7": "Psychological",
    "Diagram label 8": "concepts",
    "Diagram label 9": "ALICE",
    "Diagram label 10": "1995",
    "Diagram label 11": "Language",
    "Diagram label 12": "analysis",
    "Diagram label 13": "Siri",
    "Diagram label 14": "2010",
    "Diagram label 15": "Personal",
    "Diagram label 16": "assistant",
    "Diagram label 17": "Google Now",
    "Diagram label 18": "2012",
    "Diagram label 19": "Answers ",
    "Diagram label 20": "&",
    "Diagram label 21": "actions",
    "Diagram label 22": "Alexa",
    "Diagram label 23": "2014",
    "Diagram label 24": "Intelligent",
    "Diagram label 25": "assistant",
    "Diagram label 26": "ChatGPT",
    "Diagram label 27": "2022",
    "Diagram label 28": "Generates",
    "Diagram label 29": "human-like text",
    "Diagram label 30": "Retrieval and rule-based systems",
    "Diagram label 31": "Generative AI",
    "Emphasis 1": "Figure 1.",
    "Text 1": " The developmental stream from rule-based conversational systems to Generative AI (adapted from Yenduri et al., 2024, Figure 2). The qualitative shift occurs at ChatGPT (2022): for the first time, the system generates new text rather than retrieving or matching pre-written responses. ",
    "Text 2": "Source: Yenduri, G. et al. (2024). GPT — A Comprehensive Review on Enabling Technologies, Potential Applications, Emerging Challenges, and Future Directions. IEEE Access, 12, 54608–54649. DOI: 10.1109/ACCESS.2024.3389497"
  },
  "c1.block-5": {
    "Heading 1": "What is GenAI made of?"
  },
  "c1.block-6": {
    "Text 1": "\n        When a response sounds fluent or well targeted, it is easy to start anthropomorphizing the system, that is, treating it as if it were a mind or an entity that understands in the human sense. This reaction is natural, but this diagram is meant to interrupt that intuition. Its purpose is not to make you memorize every component one by one. Rather, it is to help you see GenAI more clearly as a system made up of physical and informational parts that work together to produce each response. Clearing away that fog is an important first step toward understanding GenAI and using it more appropriately.\n      "
  },
  "c1.block-7": {
    "Heading 1": "What GenAI is good at — and where it structurally falls short"
  },
  "c1.block-8": {
    "Text 1": "\n        Knowing how GenAI works makes its strengths and limitations predictable rather than surprising. Each limitation below is not a design flaw — it follows directly from the mechanism described in Section 2.\n      "
  },
  "c1.block-9": {
    "Text 1": "\n          Strengths\n        "
  },
  "c1.block-10": {
    "Text 1": "Brainstorming and idea generation",
    "Text 2": "GenAI samples broadly across its training distribution, which makes it effective at producing a wide range of starting points quickly. When you are unsure where to begin a research question or essay argument, it can surface angles you had not considered. Use it to generate options, not to select among them."
  },
  "c1.block-11": {
    "Text 1": "Structuring and outlining",
    "Text 2": "Because GenAI has processed enormous quantities of academic writing, it has strong pattern-matching over conventional structures — argument flow, section sequencing, paragraph organisation. It can draft a plausible skeleton for a literature review or discussion section. Treat the output as a scaffold to critique and rebuild, not a final form."
  },
  "c1.block-12": {
    "Text 1": "Paraphrasing and reformulating",
    "Text 2": "Restating a concept in different words or at a different level of complexity is a core strength. If you understand something but cannot articulate it clearly, GenAI can help you find the phrasing. This is most useful after you have already worked through the source material yourself."
  },
  "c1.block-13": {
    "Text 1": "Summarising large volumes of text",
    "Text 2": "GenAI can compress a long document into key points quickly. For an initial orientation to an unfamiliar topic or body of literature, this can save time. The risk is that compression always involves selection — you cannot verify what was left out without reading the original."
  },
  "c1.block-14": {
    "Text 1": "\n          Limitations\n        "
  },
  "c1.block-15": {
    "Text 1": "Sourcing and citation",
    "Text 2": "Hallucination is not a bug — it is a structural consequence of the generation mechanism. The model produces the most statistically plausible next token, and a plausible-sounding citation is often more likely than an admission of uncertainty. References produced by GenAI must be verified against actual databases before use. Never cite a source you have not read.",
    "Text 3": "Why: logits/softmax assigns high probability to fluent, confident-sounding output — including fictional references (Shanahan, 2024; Huang et al., 2025)"
  },
  "c1.block-16": {
    "Text 1": "Critical analysis and original argumentation",
    "Text 2": "GenAI has no genuine position on anything. What appears to be an argument is a statistically likely sequence of tokens associated with argument-shaped text. For tasks requiring you to evaluate evidence, take a stance, or construct an original claim, GenAI output is a starting point for thinking — not a substitute for it.",
    "Text 3": "Why: output is sampled from a distribution over training text — there is no reasoning agent holding a view (Shanahan, 2024)"
  },
  "c1.block-17": {
    "Text 1": "Multi-step reasoning",
    "Text 2": "Each token is generated conditioned on previous tokens, which means early errors propagate and compound. For tasks involving calculation, logical chains, or sequential inference — such as working through a statistical method or a philosophical argument step by step — errors in early steps often go uncorrected. Always verify reasoning-intensive outputs manually.",
    "Text 3": "Why: autoregressive generation has no backtracking mechanism — errors in the sequence condition all subsequent tokens (Naveed et al., 2025)"
  },
  "c1.block-18": {
    "Text 1": "Specialist and current knowledge",
    "Text 2": "Training data has a cutoff date, and rarer domains are underrepresented in the corpus. GenAI may produce confident-sounding output on recent publications, niche subfields, or local institutional knowledge that is partially or wholly inaccurate. For literature searches and factual claims in your field, always go to primary sources and verified databases.",
    "Text 3": "Why: model weights encode a fixed snapshot of training data — post-cutoff and low-frequency knowledge is absent or unreliable (Yenduri et al., 2024)"
  },
  "c1.block-19": {
    "Emphasis 1": "Sources:",
    "Text 1": " Shanahan, M. (2024). Talking about Large Language Models. ",
    "Text 2": "Communications of the ACM",
    "Text 3": ", 67(2), 68–79. · Naveed, H. et al. (2025). A Comprehensive Overview of Large Language Models. ",
    "Text 4": "ACM Transactions on Intelligent Systems and Technology",
    "Text 5": ". · Yenduri, G. et al. (2024). GPT — A Comprehensive Review on Enabling Technologies, Potential Applications, Emerging Challenges, and Future Directions. ",
    "Text 6": "IEEE Access",
    "Text 7": ", 12, 54608–54649. · Huang, L. et al. (2025). A Survey on Hallucination in Large Language Models. ",
    "Text 8": "ACM Transactions on Information Systems",
    "Text 9": ". · Vaswani, A. et al. (2017). Attention Is All You Need. ",
    "Text 10": "NeurIPS 2017",
    "Text 11": ". · Ouyang, L. et al. (2022). Training Language Models to Follow Instructions with Human Feedback. ",
    "Text 12": "NeurIPS 2022",
    "Text 13": ".\n    "
  }
}$common$::jsonb),
('common','c2',$common${
  "c2.block-0": {
    "Heading 1": "What is AI for us?"
  },
  "c2.block-1": {
    "Text 1": "\n        Knowing what GenAI is made of is a starting point. The next question is what it can and cannot do compared to you, and how to work with it effectively.\n      "
  },
  "c2.block-2": {
    "Heading 1": "Is Artifical Intelligence Same as Human Intelligence?\n    "
  },
  "c2.block-3": {
    "Text 1": "Before comparing what humans and GenAI can do, it is necessary to understand why they differ in the first place. The differences are not superficial. They are structural, rooted in how each system receives and processes information."
  },
  "c2.block-4": {
    "Text 1": "Part A: Input channel asymmetry"
  },
  "c2.block-5": {
    "Text 1": "Think about the last time you saw an elephant. Not in a photo, but in real life. You didn't just see it. You smelled it. You heard it breathe. You felt the ground vibrate slightly under its weight. All of that entered your brain at once, and all of it shaped what \"elephant\" means to you.",
    "Text 2": "Now think about what happens when a language model encounters the word \"elephant.\" It receives a token. A numerical code that represents the word. That's it. No smell, no sound, no sense of scale. Just a number in a sequence of numbers.",
    "Text 3": "This is the most basic difference between human cognition and GenAI: ",
    "Emphasis 1": "the input is not the same."
  },
  "c2.block-6": {
    "Text 1": "Human",
    "Text 2": "Five senses, all at once. Smell, sound, scale, proximity, integrated into one layered experience. Your brain does not process these separately and stitch them together later. They arrive as a single, unified representation of the world.",
    "Text 3": "GenAI",
    "Text 4": "A token. A numerical code that stands for a word. By the time any input reaches the model, it has already been compressed and stripped down to symbolic structure. The model operates entirely at the level of abstracted language, with no connection to the sensory world the language describes."
  },
  "c2.block-7": {
    "Text 1": "✓",
    "Text 2": "Nonsensory meaning: recovered at human level",
    "Text 3": "Abstract, relational knowledge. Things like \"elephants are mammals,\" \"they live in herds,\" \"they are associated with memory.\" These are patterns that exist fully in language itself, and LLMs pick them up about as well as humans do.",
    "Text 4": "~",
    "Text 5": "Sensory features: partially recovered",
    "Text 6": "What something looks, sounds, or feels like. Multimodal models that process images alongside text do better here, especially for vision. But \"partially\" is the key word: the gap narrows for what can be photographed, not for what can only be experienced.",
    "Text 7": "✗",
    "Text 8": "Motor and bodily features: not recovered",
    "Text 9": "What it feels like to stand next to something enormous. The weight of an object in your hand. The muscle memory of a familiar movement. These dimensions of meaning are grounded in having a body, and no amount of text training has bridged this gap. There is no current pathway by which it would."
  },
  "c2.block-8": {
    "Text 1": "Part B: Distance from reality"
  },
  "c2.block-9": {
    "Text 1": "The information GenAI learns from is not reality. It is a filtered, compressed, and unevenly sampled version of what people have written online. Think of it like a chain. At each link, something gets lost."
  },
  "c2.block-10": {
    "Text 1": "Reality",
    "Text 2": "Everything that happens in the world.",
    "Text 3": "What gets recorded",
    "Text 4": "Only the fraction that someone decides to write down.",
    "Text 5": "What gets published online",
    "Text 6": "Only the fraction of that which makes it onto the internet.",
    "Text 7": "What gets indexed",
    "Text 8": "Only what search engines and web crawlers can find and collect.",
    "Text 9": "What gets selected for training data",
    "Text 10": "Only what dataset builders choose to include.",
    "Text 11": "What the model learns",
    "Text 12": "The statistical average of everything above.",
    "Text 13": "At every step, noise enters and fidelity decreases. The result is a model trained on the statistical average of online text, which is itself a narrow and unrepresentative sample of human experience.",
    "Text 14": "To give you a sense of scale: GPT 3 was trained on hundreds of billions of words. About 82% of those words came from a single source, a massive collection of web pages scraped automatically from the internet. Research has shown that this collection systematically overrepresents certain languages, cultures, and demographics. Some researchers argue that this is not simply a technical problem with a straightforward fix, but something more deeply tied to how large language models work: they predict text based on what they have seen, so the patterns in the training data inevitably shape the patterns in the output."
  },
  "c2.block-11": {
    "Text 1": "What this means for output",
    "Text 2": "In creativity tasks, GenAI tends to raise the floor. It produces consistently competent results. But the ceiling is lower: the highest quality human outputs exceed what GenAI produces, and attempts to boost LLM creativity through prompt engineering have yielded mixed to negative results."
  },
  "c2.block-12": {
    "Text 1": "Part C: Intentional information loss"
  },
  "c2.block-13": {
    "Text 1": "When you ask GenAI something, you type a prompt. But think about everything that shaped your question before you started typing. Your background knowledge. Your assumptions about what matters. Your emotional investment in the topic. The context you are working in. The criteria you have in your head but never spelled out.",
    "Text 2": "Most of that never makes it into the prompt. It can't. You would need to write pages just to capture what you already know without thinking about it.",
    "Text 3": "GenAI has access only to what is explicitly provided. What is not typed does not exist for the model. This creates a structural gap between what you mean and what the model receives.",
    "Text 4": "Here is what that looks like in practice."
  },
  "c2.block-14": {
    "Text 1": "In every one of these examples, the model did something reasonable with what it received. The problem is not that it did a bad job. The problem is that most of what mattered to you never reached the model in the first place.",
    "Text 2": "This gap does not disappear as you get better at prompting. You can narrow it, but you cannot close it.",
    "Text 3": "Research supports this. Studies have found that language models generate responses with significantly less conversational grounding than humans. Rather than actively checking whether they understood you correctly, they tend to assume that common ground already exists. And here is an interesting complication: the fine tuning that makes models more helpful and polished actually makes this worse. The more \"assistant like\" the model becomes, the less likely it is to pause and verify what you actually meant.",
    "Text 4": "Across longer conversations, this adds up. Even for the most advanced models available today, average performance on generation tasks drops by about 39% in multi turn conversations compared to fully specified single turn instructions."
  },
  "c2.block-15": {
    "Text 1": "\n        Section 1 Sources\n      ",
    "Text 2": "Xu, Q. et al. (2025). Large language models without grounding recover non sensorimotor but not sensorimotor features of human concepts. ",
    "Text 3": "Nature Human Behaviour",
    "Text 4": ", 9, 1871–1886.",
    "Text 5": "Brown, T. B. et al. (2020). Language models are few shot learners. ",
    "Text 6": "Advances in Neural Information Processing Systems",
    "Text 7": ", 33, 1877–1901.",
    "Text 8": "Baack, S. (2024). A critical analysis of the largest source for generative AI training data: Common Crawl. ",
    "Text 9": "Proceedings of ACM FAccT 2024",
    "Text 10": ", pp. 2194–2207.",
    "Text 11": "Resnik, P. (2025). Large language models are biased because they are large language models. ",
    "Text 12": "Computational Linguistics",
    "Text 13": ", 51(3), 885–906. [Position paper]",
    "Text 14": "Wang, D. et al. (2025/2026). A large scale comparison of divergent creativity in humans and large language models. ",
    "Text 15": "Nature Human Behaviour",
    "Text 16": ", 10, 531–540.",
    "Text 17": "Koivisto, M. ",
    "Text 18": "&",
    "Text 19": " Grassini, S. (2023). Best humans still outperform artificial intelligence in a creative divergent thinking task. ",
    "Text 20": "Scientific Reports",
    "Text 21": ", 13, 13601.",
    "Text 22": "Shaikh, O. et al. (2024). Grounding gaps in language model generations. ",
    "Text 23": "Proceedings of NAACL 2024",
    "Text 24": ", pp. 6279–6296.",
    "Text 25": "Laban, P. et al. (2026). LLMs get lost in multi turn conversation. ",
    "Text 26": "Proceedings of ICLR 2026",
    "Text 27": " (Oral). arXiv: 2505.06120."
  },
  "c2.block-16": {
    "Heading 1": "Human vs GenAI: a functional comparison"
  },
  "c2.block-17": {
    "Text 1": "Section 1 established why humans and GenAI differ. The input is different, the training data is distant from reality, and most of what you mean never reaches the model. But what do these structural differences actually look like when the two systems perform specific tasks?",
    "Text 2": "This section compares ten cognitive functions, grouped into three categories based on where the advantage lies."
  },
  "c2.block-18": {
    "Text 1": "H",
    "Text 2": "\n          Human leads\n        "
  },
  "c2.block-19": {
    "Text 1": "Perception",
    "Text 2": "Humans receive the world through five senses at once, integrated into one experience. GenAI receives tokens. The gap is largest for bodily, physical experience, and partially closed for vision in multimodal models."
  },
  "c2.block-20": {
    "Text 1": "Emotional processing",
    "Text 2": "Humans experience emotion as a genuine internal state that shapes thinking, motivation, and behavior. GenAI recognizes and produces emotionally appropriate language, but has no internal feeling behind it."
  },
  "c2.block-21": {
    "Text 1": "Metacognition",
    "Text 2": "Humans know what they know and what they don't. They monitor their own confidence and adjust. GenAI produces confidence estimates through probability distributions, but has no persistent self check. This is part of why it can say something false without hesitating."
  },
  "c2.block-22": {
    "Text 1": "Social cognition",
    "Text 2": "Humans develop social understanding through real relationships, emotional resonance, and years of interaction. GenAI can pass structured social reasoning tests at high levels, but without the developmental grounding and relational stakes behind it."
  },
  "c2.block-23": {
    "Text 1": "↔",
    "Text 2": "\n          Both capable, depends on the task\n        "
  },
  "c2.block-24": {
    "Text 1": "Short term storage",
    "Text 2": "Human working memory holds roughly four to seven chunks and actively manipulates them. GenAI context windows hold thousands of tokens passively. Studies show comparable limits under active maintenance conditions, but humans manipulate held information more flexibly."
  },
  "c2.block-25": {
    "Text 1": "Reasoning",
    "Text 2": "Humans support causal, counterfactual, and analogical reasoning and adapt flexibly to new situations. GenAI outperforms humans on some structured reasoning tasks, but fails on tasks that require distinguishing observation from intervention, or deliberately exploring uncertain options."
  },
  "c2.block-26": {
    "Text 1": "Language processing",
    "Text 2": "Humans integrate grammar with pragmatics, social intent, and contextual meaning. GenAI achieves strong grammatical competence but functional competence (using language appropriately in context) is uneven. The key insight: language ability and thinking ability are separate systems, and GenAI has acquired one without fully having the other."
  },
  "c2.block-27": {
    "Text 1": "Creativity",
    "Text 2": "Humans produce highly variable creative output, with the best human work exceeding anything GenAI produces. GenAI raises the floor by producing consistently competent results, but the upper tail is smaller. Attempts to boost GenAI creativity through prompt engineering have yielded mixed to negative results."
  },
  "c2.block-28": {
    "Text 1": "G",
    "Text 2": "\n          GenAI leads on scale\n        "
  },
  "c2.block-29": {
    "Text 1": "Pattern recognition",
    "Text 2": "GenAI detects statistical regularities across billions of examples with consistency and speed beyond human capacity. On structured analogy tasks, it has matched or surpassed human performance, though results vary significantly across model versions and task types."
  },
  "c2.block-30": {
    "Text 1": "Long term storage",
    "Text 2": "GenAI encodes patterns from its entire training corpus into billions of parameters, far exceeding human memory in raw volume. But this knowledge is frozen at the training cutoff and cannot be updated through conversation. Human memory holds less, but keeps learning from lived experience."
  },
  "c2.block-31": {
    "Text 1": "\n        Section 2 Sources\n      ",
    "Text 2": "Xu, Q. et al. (2025). ",
    "Text 3": "Nature Human Behaviour",
    "Text 4": ", 9, 1871–1886.",
    "Text 5": "Chemero, A. (2023). ",
    "Text 6": "Nature Human Behaviour",
    "Text 7": ", 7(11), 1828–1829.",
    "Text 8": "Schlegel, K. et al. (2025). ",
    "Text 9": "Communications Psychology",
    "Text 10": ", 3, Article 80.",
    "Text 11": "Cash, T. N. et al. (2025). ",
    "Text 12": "Memory ",
    "Text 13": "&",
    "Text 14": " Cognition",
    "Text 15": ".",
    "Text 16": "Strachan, J. W. A. et al. (2024). ",
    "Text 17": "Nature Human Behaviour",
    "Text 18": ", 8(7), 1285–1295.",
    "Text 19": "Gong, D., Wan, X. ",
    "Text 20": "&",
    "Text 21": " Wang, D. (2024). ",
    "Text 22": "Proceedings of AAAI 2024",
    "Text 23": ", 38, 10048–10056.",
    "Text 24": "Hagendorff, T., Fabi, S. ",
    "Text 25": "&",
    "Text 26": " Kosinski, M. (2023). ",
    "Text 27": "Nature Computational Science",
    "Text 28": ", 3(10), 833–838.",
    "Text 29": "Binz, M. ",
    "Text 30": "&",
    "Text 31": " Schulz, E. (2023). ",
    "Text 32": "PNAS",
    "Text 33": ", 120(6), e2218523120.",
    "Text 34": "Mahowald, K. et al. (2024). ",
    "Text 35": "Trends in Cognitive Sciences",
    "Text 36": ", 28(6), 517–540.",
    "Text 37": "Wang, D. et al. (2025/2026). ",
    "Text 38": "Nature Human Behaviour",
    "Text 39": ", 10, 531–540.",
    "Text 40": "Koivisto, M. ",
    "Text 41": "&",
    "Text 42": " Grassini, S. (2023). ",
    "Text 43": "Scientific Reports",
    "Text 44": ", 13, 13601.",
    "Text 45": "Webb, T., Holyoak, K. J. ",
    "Text 46": "&",
    "Text 47": " Lu, H. (2023). ",
    "Text 48": "Nature Human Behaviour",
    "Text 49": ", 7(9), 1526–1541.",
    "Text 50": "de Varda, A. G., Saponaro, S. ",
    "Text 51": "&",
    "Text 52": " Marelli, M. (2025). ",
    "Text 53": "Nature Human Behaviour",
    "Text 54": " [Matters Arising]."
  },
  "c2.block-32": {
    "Heading 1": "A Framework for Collaboration: S.A.T Framework"
  },
  "c2.block-33": {
    "Text 1": "The beginning is always yours"
  },
  "c2.block-34": {
    "Text 1": "Before AI can help, something has to already exist in you. A rough sense of what you are trying to do, what you want out of it, and what direction feels right. GenAI cannot produce this, since there is no statistically probable answer for that. AI is a systematic tool, not a genie from a lamp.",
    "Text 2": "You have to know the process of your work, and which parts AI can take over. Without that, it is hard to expect the interaction with AI to land anywhere meaningful, especially in work where the thinking has to be yours, such as writing a paper, developing a project, or forming an argument you will stand behind."
  },
  "c2.block-35": {
    "Text 1": "GenAI's role: Operationalization"
  },
  "c2.block-36": {
    "Text 1": "Once you have that direction, put it on paper. Sketch an idea, a rough structure, a set of notes. It does not need to be polished. It just needs to exist.",
    "Text 2": "This is where GenAI becomes useful. When you only think in your head, everything happens at once, and it is hard to make your ideas complete or untangled. It is also hard to tell whether your idea actually makes sense, holds together logically, or is even factually correct. Once you have something on paper, GenAI can help you work through it systematically, like a thinking partner. It organizes what you have and what you don't have, gives you quick access to knowledge, and guides you toward a more structured process.",
    "Text 3": "GenAI is not thinking instead of you. It is making your thinking visible fast enough to work with. In other words, it helps your ideas go through operationalization."
  },
  "c2.block-37": {
    "Text 1": "S.A.T Framework ",
    "Text 2": "(Self–AI–Team)",
    "Diagram label 1": "Self",
    "Diagram label 2": "Intent",
    "Diagram label 3": "AI",
    "Diagram label 4": "Operationalize",
    "Diagram label 5": "Self",
    "Diagram label 6": "Judge",
    "Diagram label 7": "AI",
    "Diagram label 8": "Refine",
    "Diagram label 9": "Self",
    "Diagram label 10": "Present",
    "Diagram label 11": "Team",
    "Diagram label 12": "Feedback",
    "Diagram label 13": "Self",
    "Diagram label 14": "Integrate",
    "Diagram label 15": "Team",
    "Diagram label 16": "Expand",
    "Diagram label 17": "SELF–AI",
    "Diagram label 18": "SELF–TEAM",
    "Diagram label 19": "SELF–AI",
    "Diagram label 20": "SELF–TEAM",
    "Diagram label 21": "Cycle 1",
    "Diagram label 22": "Cycle 2",
    "Diagram label 23": "Cycle 3",
    "Diagram label 24": "Cycle 4",
    "Diagram label 25": "SCALE OF THE WORK",
    "Diagram label 26": "SESSION PROGRESSION",
    "Diagram label 27": "“",
    "Diagram label 28": "At every transition, you steer.",
    "Diagram label 29": "”"
  },
  "c2.block-38": {
    "Text 1": "1.",
    "Text 2": "The Self–AI loop",
    "Text 3": "You bring an intention and a rough sketch. GenAI operationalizes it. You judge, redirect, and GenAI produces again. Each cycle sharpens the work, and the process accelerates.",
    "Text 4": "But the loop stalls. The model returns to early assumptions, delivers \"complete\" answers without clarifying, or produces outputs that are internally consistent but feel off. The work has been operationalized, not tested against reality."
  },
  "c2.block-39": {
    "Text 1": "2.",
    "Text 2": "The Self–Team loop",
    "Text 3": "When the Self–AI loop stalls, you bring the work to people: classmates, tutors, your project group. The team brings what GenAI structurally cannot: shared context, social judgment, real world experience, and practical matters.",
    "Text 4": "You present the work, the team responds, and new questions emerge. The scope does not just refine. It grows."
  },
  "c2.block-40": {
    "Text 1": "3.",
    "Text 2": "Transition",
    "Text 3": "Each transition belongs to you. With the support of AI, you bring verified and reliable work to the team. With the team's feedback, you return to AI with new material. The starting point is higher, and each cycle builds on what the last one produced."
  },
  "c2.block-41": {
    "Text 1": "Worked example"
  },
  "c2.block-42": {
    "Text 1": "The ending is also yours"
  },
  "c2.block-43": {
    "Text 1": "Just as the beginning cannot be generated, the ending cannot be delegated. GenAI cannot be held responsible. When the output of the Self–AI loop is discussed, presented, or submitted, your name is attached, and what the work represents is what you stand behind.",
    "Text 2": "You check the output against your original intent, line by line. Yes, this is partly about plagiarism and rules. But more importantly, it is about your own work. Small flaws that go unchecked compound over time, especially when working with AI."
  },
  "c2.block-44": {
    "Text 1": "\n        Section 3 Sources\n      ",
    "Text 2": "Laird, J. E., Lebiere, C. ",
    "Text 3": "&",
    "Text 4": " Rosenbloom, P. S. (2017). AI Magazine, 38(4), 13–26.",
    "Text 5": "Sumers, T. R. et al. (2024). Transactions on Machine Learning Research."
  }
}$common$::jsonb),
('common','c3',$common${
  "c3.block-0": {
    "Heading 1": "How Do We Use AI?"
  },
  "c3.block-1": {
    "Text 1": "\n        C1 covered what GenAI is. C2 covered what it is to us. C3 covers the operational layer: how we actually interact with it. This is not a collection of prompt tips — it is a framework built around one cycle.\n      "
  },
  "c3.block-2": {
    "Text 1": " Prompt",
    "Text 2": " Critique",
    "Text 3": " Integrate"
  },
  "c3.block-3": {
    "Heading 1": "Designing the input"
  },
  "c3.block-4": {
    "Text 1": "\n        A prompt is a text input given to AI to instruct a task. Research defines prompt engineering as \"the skill of articulating a problem, its context, and the constraints of the desired solution to an AI assistant\" (Federiakin et al., 2024).\n      ",
    "Text 2": "\n        In this module, prompting is ",
    "Emphasis 1": "calibration",
    "Text 3": ". It is the act of defining what you want to do, what you expect, what process to follow, and under what conditions. Think of it as designing a virtual workspace where AI operates on your terms. To write a good prompt, you need to understand GenAI, but you also need to understand yourself: your task, your intention, your current stage, and your boundaries.\n      "
  },
  "c3.block-5": {
    "Text 1": "\"Learning how to interact with AI is not unlike being someone who's really good at asking questions. Prompting AI is very similar. You can't just randomly ask a bunch of questions. Asking AI to be an assistant to you requires some expertise and artistry of how to prompt it.\"",
    "Text 2": "— Jensen Huang, CEO of NVIDIA (Cleo Abram, \"Huge Conversations\", January 2025)"
  },
  "c3.block-6": {
    "Text 1": "Six types of information AI uses to process a task"
  },
  "c3.block-7": {
    "Text 1": "Research consistently shows that AI performs significantly better when certain types of information are clearly provided. The following six are the key components that support how AI processes and responds to your request."
  },
  "c3.block-8": {
    "Text 1": "Clear Instruction",
    "Text 2": "Role / Persona",
    "Text 3": "Task Decomposition",
    "Text 4": "Few-shot Examples",
    "Text 5": "Chain-of-Thought",
    "Text 6": "Output Format"
  },
  "c3.block-9": {
    "Text 1": "Task Specification",
    "Text 2": "Clear Instruction",
    "Text 3": "Information about ",
    "Emphasis 1": "what needs to be done",
    "Text 4": ". The more you specify the purpose, scope, context, and conditions of a task, the narrower AI's working space becomes.",
    "Emphasis 2": "If you don't set it:",
    "Text 5": " AI interprets the task in the most generic way possible. Whether it matches your intent is left to chance.",
    "Text 6": "Consensus: treated as baseline across all major prompt engineering surveys"
  },
  "c3.block-10": {
    "Text 1": "Perspective Assignment",
    "Text 2": "Role / Persona",
    "Text 3": "Information about ",
    "Emphasis 1": "what perspective AI should operate from",
    "Text 4": ". Setting a role is not a technique to boost AI accuracy — it is the act of deciding what position you want AI to occupy for this task.",
    "Emphasis 2": "If you don't set it:",
    "Text 5": " AI operates as a generic \"helpful assistant.\"",
    "Text 6": "Evidence: no measurable accuracy improvement on benchmarks (Zheng et al., 2024 EMNLP; 162 personas, 4 LLM families). Effective as a tone and framing tool."
  },
  "c3.block-11": {
    "Text 1": "Structure of a Task",
    "Text 2": "Task Decomposition",
    "Text 3": "Information about ",
    "Emphasis 1": "the structure of a task",
    "Text 4": ". When you throw a complex task at AI in one piece, you cannot tell which part of the output went wrong.",
    "Emphasis 2": "If you don't set it:",
    "Text 5": " AI decomposes the task on its own, but you cannot know if its decomposition matches your intent.",
    "Text 6": "Evidence: Least-to-Most prompting showed 83.5pp gain on compositional benchmarks (Zhou et al., 2022 ICLR)"
  },
  "c3.block-12": {
    "Text 1": "Desired Output",
    "Text 2": "Few-shot Examples",
    "Text 3": "Information about ",
    "Emphasis 1": "what the desired output looks like",
    "Text 4": ". The act of creating an example forces you to check: do I actually know what I want? Modern models can infer intent without examples, but that means the model interprets on its own.",
    "Emphasis 2": "If you don't set it:",
    "Text 5": " AI responds in its most generic form. Without a standard, you cannot judge if it is right.",
    "Text 6": "Evidence: established in Brown et al. (2020, NeurIPS) GPT-3 paper. Few-shot CoT scored highest in Schulhoff et al. benchmarks."
  },
  "c3.block-13": {
    "Text 1": "Reasoning Steps",
    "Text 2": "Chain-of-Thought",
    "Text 3": "Information about ",
    "Emphasis 1": "the reasoning process",
    "Text 4": ". Asking AI to show its intermediate steps opens a window for you to check its logic.",
    "Emphasis 2": "If you don't set it:",
    "Text 5": " You get only the conclusion, with no visibility into how it got there. If it sounds plausible, you just accept it.",
    "Text 6": "Evidence: Wei et al. (2022, NeurIPS) GSM8K 18% → 58%. However, effects are limited outside math/symbolic reasoning (Sprague et al., 2024)."
  },
  "c3.block-14": {
    "Text 1": "Shape of the Output",
    "Text 2": "Output Format",
    "Text 3": "Information about ",
    "Emphasis 1": "the shape of the output",
    "Text 4": ". The same content delivered as a table, a list, a single sentence, or a set of questions changes how you can use it afterward. Specifying the format is not a convenience — it is designing how the output will integrate into your workflow.",
    "Emphasis 2": "If you don't set it:",
    "Text 5": " AI defaults to its standard form (usually long paragraphs).",
    "Text 6": "Revisited in Section 3 (Integrate) from the integration strategy perspective."
  },
  "c3.block-15": {
    "Text 1": "Proactive GenAI Usage"
  },
  "c3.block-16": {
    "Text 1": "If you think through these components before prompting, you stay in control of the task. If you skip them, AI fills them in for you, and because its output looks plausible, you may not realize decisions were made without you. Having your own ideas about these components before you let AI work is what we call proactive GenAI usage."
  },
  "c3.block-17": {
    "Text 1": "Clear Instruction",
    "Text 2": "Role",
    "Text 3": "Task Decomposition",
    "Text 4": "Few-shot",
    "Text 5": "Chain-of-Thought",
    "Text 6": "Output Format"
  },
  "c3.block-18": {
    "Text 1": "Ask yourself",
    "Text 2": "Clear Instruction",
    "List text 1": "What exactly am I trying to do right now?",
    "List text 2": "What is the purpose of this task?",
    "List text 3": "What is the scope?",
    "List text 4": "Which stage of my project does this task belong to?"
  },
  "c3.block-19": {
    "Text 1": "Ask yourself",
    "Text 2": "Role",
    "List text 1": "What perspective should AI operate from?",
    "List text 2": "What should AI NOT do?",
    "List text 3": "What tone and level of response do I need?"
  },
  "c3.block-20": {
    "Text 1": "Ask yourself",
    "Text 2": "Task Decomposition",
    "List text 1": "Can I break this task into smaller units?",
    "List text 2": "Am I trying to ask for too much at once?",
    "List text 3": "What order should the sub-tasks follow?"
  },
  "c3.block-21": {
    "Text 1": "Ask yourself",
    "Text 2": "Few-shot",
    "List text 1": "Do I know what the desired output looks like?",
    "List text 2": "Can I create one example?",
    "List text 3": "If I can't make an example, do I actually know what I want?"
  },
  "c3.block-22": {
    "Text 1": "Ask yourself",
    "Text 2": "Chain-of-Thought",
    "List text 1": "What reasoning process does this task require?",
    "List text 2": "What steps should AI go through?",
    "List text 3": "Do I need to see the intermediate process?"
  },
  "c3.block-23": {
    "Text 1": "Ask yourself",
    "Text 2": "Output Format",
    "List text 1": "What format do I need to actually use it?",
    "List text 2": "Table? List? Single sentence? Questions?",
    "List text 3": "Is this format easy to integrate into my workflow?"
  },
  "c3.block-24": {
    "Text 1": "Based on these components, you build your prompt."
  },
  "c3.block-25": {
    "Text 1": "[Role]",
    "Text 2": "You are a _______ who _______.",
    "Text 3": "[Task]",
    "Text 4": "I need you to _______.",
    "Text 5": "[Context]",
    "Text 6": "I am currently working on _______. This task is part of _______.",
    "Text 7": "[Constraints]",
    "Text 8": " Do not _______. Stay within _______.",
    "Text 9": "[Reasoning]",
    "Text 10": "Approach this by first _______, then _______.",
    "Text 11": "[Examples]",
    "Text 12": "Here is an example of what I want: _______",
    "Text 13": "[Format]",
    "Text 14": "Respond in the form of a _______."
  },
  "c3.block-26": {
    "Heading 1": "Output is not an answer — it is a candidate"
  },
  "c3.block-27": {
    "Text 1": "What AI gives you is not a final answer but a ",
    "Emphasis 1": "candidate",
    "Text 2": ": candidate structure, candidate wording, candidate comparison, candidate interpretation. Output is material to review, not material to adopt.",
    "Text 3": "This connects directly to what you learned in C1. GenAI output is statistically likely, not factually verified. It is conditioned on prior tokens, not on reasoning. It is bounded by training data. It reflects a distribution, not authorship. Without your domain knowledge, critique is impossible."
  },
  "c3.block-28": {
    "Text 1": "Four steps: Read → Question → Verify → Decide"
  },
  "c3.block-29": {
    "Text 1": "Read",
    "Text 2": "Identify what came out",
    "Text 3": "Question",
    "Text 4": "Generate questions before judging",
    "Text 5": "Verify",
    "Text 6": "Judge against criteria",
    "Text 7": "Decide",
    "Text 8": "Select, modify, or discard"
  },
  "c3.block-30": {
    "Text 1": "Read — Identify what came out",
    "List text 1": "Is this a response to what I requested?",
    "List text 2": "What structure did AI use? (list, paragraphs, table, etc.)",
    "List text 3": "What overall claim or direction is it taking?",
    "Emphasis 1": "Example"
  },
  "c3.block-31": {
    "Text 1": "Question — Generate questions before judging",
    "List text 1": "Is this content factually verifiable?",
    "List text 2": "Is anything missing?",
    "List text 3": "Are any parts overly general or vague?",
    "List text 4": "Does the output include claims I can't verify?",
    "List text 5": "Did the output stay within my requested scope?",
    "Emphasis 1": "Example"
  },
  "c3.block-32": {
    "Text 1": "Verify — Judge against criteria",
    "List text 1": "If facts, citations, or numbers are included — can the source be verified?",
    "List text 2": "Does the output match the scope of my request?",
    "List text 3": "Can I explain this content myself?",
    "List text 4": "Does this output reflect my intent and context?",
    "Emphasis 1": "Example"
  },
  "c3.block-33": {
    "Text 1": "Decide — Select, modify, or discard",
    "List text 1": "Which parts can I use and which should I discard?",
    "List text 2": "Which parts need modification?",
    "List text 3": "Is a re-prompt necessary?",
    "Emphasis 1": "Example"
  },
  "c3.block-34": {
    "Heading 1": "How AI output enters your work"
  },
  "c3.block-35": {
    "Text 1": "Integration does not start after you receive the output — it starts at the prompting stage. The moment you decide what format to receive the output in, you have already determined how safe and controllable the integration will be.",
    "Text 2": "\"Compare these papers\" produces paragraphs that easily bleed into your writing. \"Make a comparison table\" keeps the output separate from your text, verifiable cell by cell. Choosing the output format is not a convenience — it is a ",
    "Emphasis 1": "safety mechanism",
    "Text 3": " for integration."
  },
  "c3.block-36": {
    "Table text 1": "Requested Format",
    "Table text 2": "Integration Characteristics",
    "Table text 3": "Comparison table",
    "Table text 4": "Verifiable and extractable cell by cell. Does not blend into your prose.",
    "Table text 5": "Question list",
    "Table text 6": "Serves as a thinking prompt. No copy-paste risk. You have to write the answers.",
    "Table text 7": "Single sentence summary",
    "Table text 8": "A single claim — easy to accept or reject clearly.",
    "Table text 9": "Keyword / term list",
    "Table text 10": "Easy to selectively adopt. You write the sentences.",
    "Table text 11": "Bullet point outline",
    "Table text 12": "Use the structure as reference; fill in the content yourself.",
    "Table text 13": "Full paragraph",
    "Text 1": "Highest risk of blending into your writing. Use with caution."
  },
  "c3.block-37": {
    "Text 1": "Adopt / Modify / Discard"
  },
  "c3.block-38": {
    "Text 1": "Segment",
    "Text 2": "Break output into units",
    "Text 3": "Tag",
    "Text 4": "Adopt / Modify / Discard",
    "Text 5": "Execute",
    "Text 6": "Act on each tag",
    "Text 7": "Review",
    "Text 8": "Look at the whole"
  },
  "c3.block-39": {
    "Text 1": "Segment — Break output into units",
    "Text 2": "Break the output into units that can be judged independently. Rows for tables, items for lists, claims for paragraphs."
  },
  "c3.block-40": {
    "Text 1": "Tag — Adopt / Modify / Discard",
    "Text 2": "Assign a tag to each unit:",
    "Text 3": "Adopt",
    "List text 1": "accurate, matches my intent, ready to use",
    "Text 4": "Modify",
    "List text 2": "direction is right, needs adjustment",
    "Text 5": "Discard",
    "List text 3": "inaccurate, outside scope, or I cannot verify it"
  },
  "c3.block-41": {
    "Text 1": "Execute — Act on each tag",
    "Emphasis 1": "Adopt →",
    "List text 1": " place in your work; confirm source and context.",
    "Emphasis 2": "Modify →",
    "List text 2": " define what to change; return to original source or re-prompt.",
    "Emphasis 3": "Discard →",
    "List text 3": " delete; record why in one line."
  },
  "c3.block-42": {
    "Text 1": "Review — Look at the whole",
    "Text 2": "After integration, look at the whole:",
    "List text 1": "Does this reflect my thinking?",
    "List text 2": "Has AI's language remained unchanged in my text?",
    "List text 3": "Can I explain and defend every part?"
  },
  "c3.block-43": {
    "Text 1": "Human Accountability Checklist",
    "List text 1": "Are the core ideas and judgments in this work my own?",
    "List text 2": "Have I verified all AI-generated content that I adopted?",
    "List text 3": "Can I explain and defend every part of this work?",
    "List text 4": "Can I transparently disclose how AI was used?",
    "Text 2": "Based on the Author Checklist from Cheng, Calhoun, & Reedy (2025). Advances in Simulation, 10, 22."
  },
  "c3.block-44": {
    "Text 1": "\n        Use GenAI responsibly during your study work, make sure you adhere to the ESSB principles and Guidelines.\n      ",
    "Link text 1": "ESSB GenAI Guidelines",
    "Link text 2": "↗"
  },
  "c3.block-45": {
    "Heading 1": "Building your prompt"
  },
  "c3.block-46": {
    "Text 1": "AI processes structured input more accurately than prose paragraphs. Formatting changes alone can shift accuracy by up to 76 percentage points (Sclar et al., ICLR 2024). Two common structuring formats are Markdown and XML."
  },
  "c3.block-47": {
    "Text 1": "Markdown",
    "Text 2": "XML"
  },
  "c3.block-48": {
    "Text 1": "Markdown uses ",
    "Text 2": "#",
    "Text 3": " for headings and ",
    "Text 4": "-",
    "Text 5": " for lists — intuitive and easy for humans to read. XML uses explicit opening and closing tags, which models parse more precisely. XML is the only delimiter format recommended by all three major providers (OpenAI, Anthropic, Google), making it advantageous for complex prompts."
  },
  "c3.block-49": {
    "Text 1": "Prompt template (XML)"
  },
  "c3.block-50": {
    "Text 1": "<",
    "Text 2": "role",
    "Text 3": ">",
    "Text 4": "[What perspective should AI operate from?]",
    "Text 5": "<",
    "Text 6": "/role",
    "Text 7": ">",
    "Text 8": "<",
    "Text 9": "task",
    "Text 10": ">",
    "Text 11": "[What specifically needs to be done? Include purpose and context]",
    "Text 12": "<",
    "Text 13": "/task",
    "Text 14": ">",
    "Text 15": "<",
    "Text 16": "context",
    "Text 17": ">",
    "Text 18": "[The situation this task sits in. Current stage, background, materials]",
    "Text 19": "<",
    "Text 20": "/context",
    "Text 21": ">",
    "Text 22": "<",
    "Text 23": "constraints",
    "Text 24": ">",
    "Text 25": "[What should AI NOT do? Scope limits. Conditions to respect]",
    "Text 26": "<",
    "Text 27": "/constraints",
    "Text 28": ">",
    "Text 29": "<",
    "Text 30": "steps",
    "Text 31": ">",
    "Text 32": "[The reasoning or work steps AI should follow]\n1. ...\n2. ...\n3. ...",
    "Text 33": "<",
    "Text 34": "/steps",
    "Text 35": ">",
    "Text 36": "<",
    "Text 37": "examples",
    "Text 38": ">",
    "Text 39": "[Examples of the desired output. 1–3]",
    "Text 40": "<",
    "Text 41": "/examples",
    "Text 42": ">",
    "Text 43": "<",
    "Text 44": "output_format",
    "Text 45": ">",
    "Text 46": "[Shape, length, and structure of the output]",
    "Text 47": "<",
    "Text 48": "/output_format",
    "Text 49": ">"
  },
  "c3.block-51": {
    "Text 1": "Prompt length guide"
  },
  "c3.block-52": {
    "Table text 1": "Task Complexity",
    "Table text 2": "Recommended Length",
    "Table text 3": "Simple",
    "Table text 4": "50–100 words (summary, factual question)",
    "Table text 5": "Moderate",
    "Table text 6": "150–300 words (analysis, comparison, structured output)",
    "Table text 7": "Complex",
    "Table text 8": "300–500 words (multi-step reasoning, detailed generation)",
    "Table text 9": "Beyond 500 words",
    "Table text 10": "Split into multiple turns"
  },
  "c3.block-53": {
    "Text 1": "Writing principles"
  },
  "c3.block-54": {
    "Text 1": "Use imperative verbs",
    "Text 2": "Start instructions with action words.",
    "Text 3": "\"Summarize\", \"Compare\", \"Identify\"",
    "Text 4": "Skip politeness tokens",
    "Text 5": "\"Please\", \"thank you\", and \"if you don't mind\" are unnecessary and can reduce performance (Dobariya & Kumar, 2025).",
    "Text 6": "Use affirmative instructions",
    "Text 7": "Affirmative instructions outperform negations.",
    "Text 8": "\"Use plain language\" > \"Don't use jargon\"",
    "Text 9": "Place key instructions at the edges",
    "Text 10": "Put the most important instructions at the very beginning or very end of your prompt, countering the \"Lost in the Middle\" effect (Liu et al., 2024)."
  },
  "c3.block-55": {
    "Emphasis 1": "This template is a general-purpose framework.",
    "Text 1": " The activity preset prompts in this module are instances of this template with each field pre-filled for a specific learning activity."
  },
  "c3.block-56": {
    "Emphasis 1": "Sources:",
    "Text 1": "\n      Federiakin, D. et al. (2024). Prompt engineering as a new 21st century skill. ",
    "Text 2": "Frontiers in Education",
    "Text 3": ", 9, 1366434. ·\n      Schulhoff, S. et al. (2024). The Prompt Report. ",
    "Text 4": "arXiv:2406.06608",
    "Text 5": ". ·\n      Sahoo, P. et al. (2024). A Systematic Survey of Prompt Engineering in LLMs. ",
    "Text 6": "arXiv:2402.07927",
    "Text 7": ". ·\n      Liu, D. et al. (2026). A comprehensive taxonomy of prompt engineering techniques. ",
    "Text 8": "Frontiers of Computer Science",
    "Text 9": ", 20(3). ·\n      White, J. et al. (2023). A Prompt Pattern Catalog. ",
    "Text 10": "PLoP 2023, Vanderbilt",
    "Text 11": ". ·\n      Bozkurt, A. & Sharma, R. (2023). ",
    "Text 12": "Open Praxis",
    "Text 13": ". ·\n      Wei, J. et al. (2022). Chain-of-Thought Prompting. ",
    "Text 14": "NeurIPS 2022",
    "Text 15": ". ·\n      Brown, T. et al. (2020). Language Models are Few-Shot Learners. ",
    "Text 16": "NeurIPS 2020",
    "Text 17": ". ·\n      Yusuf, A. et al. (2024). ",
    "Text 18": "Thinking Skills and Creativity",
    "Text 19": ", 54, 101619. ·\n      Wang, Z. & Wang, C. (2025). APSE Model. ",
    "Text 20": "Journal of Second Language Writing",
    "Text 21": ", 67, 101187. ·\n      Zhu, J. & Duan, C. (2025). Pan-indexicality and prompt. ",
    "Text 22": "Language and Semiotic Studies",
    "Text 23": ". ·\n      Cheng, A., Calhoun, A. & Reedy, G. (2025). ",
    "Text 24": "Advances in Simulation",
    "Text 25": ", 10, 22. ·\n      Sclar, M. et al. (2024). Sensitivity to Spurious Features. ",
    "Text 26": "ICLR 2024",
    "Text 27": ". ·\n      Bsharat, S. et al. (2023). 26 Principled Instructions. ·\n      Liu, N. et al. (2024). Lost in the Middle. ",
    "Text 28": "TACL",
    "Text 29": ". ·\n      Levy, M., Jacoby, A. & Goldberg, Y. (2024). Same Task, More Tokens. ",
    "Text 30": "ACL 2024",
    "Text 31": ". ·\n      Shanahan, M. (2024). ",
    "Text 32": "Communications of the ACM",
    "Text 33": ", 67(2). ·\n      Huang, L. et al. (2025). ",
    "Text 34": "ACM Transactions on Information Systems",
    "Text 35": ". ·\n      Naveed, H. et al. (2025). ",
    "Text 36": "ACM TIST",
    "Text 37": ". ·\n      Yenduri, G. et al. (2024). ",
    "Text 38": "IEEE Access",
    "Text 39": ", 12, 54608–54649.\n    "
  }
}$common$::jsonb);
notify pgrst, 'reload schema';
commit;
