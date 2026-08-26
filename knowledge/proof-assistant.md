---
tags:
  - proof-assistant
created: 2026-08-25
---

## Introduction

Proof Assistants are computer systems that allows a user to do mathematics on a computer, but not so much computing (numerical or symbolical) aspect of mathematics but the aspects of _proving_ and _defining_

If you think the theorem is correct there is not much used fore the proof assistant. Mostly, it got used in situation where the correctness of the proofs are intricate pieces of software that act in a physical environment or about a compiler that involves syntax of programming langauge that has many possible instructions.
### Roles of [[proof-assistant#^a-proof|proof]]

Usually a role of the proof is either:
	- Convinces the reader that the statement is correct.
	- Explains why the statement is correct

How do we convince ourself that a checked proof is itself correct:
	- **Description of the logic:** If we have a system independent description of the logic and its mathematical features (like the mechanism for defining functions and dataq types), we can establish whether we believe in those, whether our definitions faithfully represents what we want to express and whether the proof steps make sense.
	- **Small Kernel:** Some systems for proof verification have a very small kernel, with rules that a user can verify by manually checking the code. All other proof rules are defined in terms of those, so a proof step is a composition of basic proof steps from the kernel. In this case, one only has to trust the small kernel.
	- **Check the Checker:** The proof assistant itself is "just another program". so its correctness can be verified. To do this, one first has to specify the properties of the program, which means that one has to formalize the rules of the logic. Then one would prove that the proof assistant can prove a theorem $\varphi$  if and only if $\varphi$ is derivable in the logic. A way to do this is to prove that all proof-tactics are sound in the logic and that there is a proof-tactics for every inference rule. Another way to proceed is to construct a complete model for the logic within the system. 
	- **De Bruijn criterion:** Some proof assistants create an "independently checkable proof object" while the user is interactively proving a theorem. The proof should be easily checkable by the user of the program. De Bruijn's Automath systems were the first to specifically focus on this aspect and therefore this property was coined "De Bruijn criterion". In this system, the proof objects are basically encodings of natural deduction derivations that can be checked by a type checking algorithm.
## Definitions

**A proof**: The process of an instance of establishing the validity of a statement especially by derivation from other statements in accordance with principles of reasoning.
^a-proof
## Resources

[[resources#^res-60e162a6|Proof Assistants: history, ideas and future by H. Geuvers]]