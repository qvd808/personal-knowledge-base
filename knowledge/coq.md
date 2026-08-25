---
tags:
  - coq
  - formal-verification
created: 2026-08-23
---
## Introduction

Coq is a proof assistant and an expressive functional programming language inside one system. It can be used for [[formal-verification]] or interactive mathematics.

It contains three components:
- **Gallina** (programming language): the underlying dependently typed functional programming language, based on the Calculus of Inductive Constructions (CIC)
- **Vernacular**: the top-level command language, used to structure scripts, define modules, manage the environment, and register theorems
- **Ltac/Ltac2**: the tactic language, a DSL used to write proof scripts and construct proof terms interactively

Naming note: the prover is being renamed Rocq; most existing material, including Software Foundations, still says Coq.
## Data and Functions

Coq is a functional programming language, so in a way everything is a function. We can define types like:

```coq
Inductive day : Type :=
  | monday
  | tuesday
  | wednesday
  | thursday
  | friday
  | saturday
  | sunday.
```

It also has a Boolean type with the values `true` and `false`. You can define a function with a `match` expression, similar to Haskell or Rust:

```coq
Definition negb (b : bool) : bool :=
  match b with
  | true => false
  | false => true
  end.
```

Coq also provides a module system to aid in larger developments.
## Kernel

The thing that checks a term against a claimed type. It takes a complete, fully explicit term and a claimed type and answers yes or no.

The kernel is deliberately kept small so that we can completely trust it. 

| A bug in…         | Worst case                                                                                                                      |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| the tactic engine | it emits a term that does not type-check. The kernel rejects it. You see an error. **No false theorem.**                        |
| the elaborator    | it fills in a hole wrongly. The resulting term does not type-check. The kernel rejects it. **No false theorem.**                |
| the parser        | it misreads your input. You prove something, but not the thing you meant to state. **A real problem, but not a soundness bug.** |
| **the kernel**    | it accepts a term that is not a proof. **A false theorem is now provable, and nothing catches it.**                             |
Kernel bug is only bug that produces false theorem; tactic-only bug never gets a term with correct type through. 
### Keeping the kernel minimal not small

It not that we have to keep it small but more like we have to keep aggressive requirements and make it as miminal as possible. If the kernel only has 1000 lines of code but there is someone who can inject the definition then the kernel itself is useless. It must from a [TCB (Trusted Computing Base)](#^tcb) itself.
^ct-tcb
## Core Language

The core language is implemented in Calculus of Inductive Construction that the kernel can understand. Users write proof at the tactic engine level. Then these tactics are converted and translated to [proof term](#^proof-term) in this core language where the kernel will verify it.
^ct-proof-term

The separation between Core Language (elaboration engine), tactics and the kernel is because of de Bruijn criterion (keeping a small and well delimited trusted code base within a proof assistant)
## Definitions

[**Proof term**](#^ct-proof-term): A term of the Calculus of Inductive Constructions whose type corresponds to a theorem statement.
^proof-term

[**Trusted Computing Base**](#^ct-tcb): All the component your system relies on when you running your systems.
^tcb
## Resources
## Resources

- [[resources#^res-db27fa43|Software Foundations, Logical Foundations — Basics]]
- [[resources#^res-a11528be|Rocq Core Language Reference]]