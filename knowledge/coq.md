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

The thing that check a terms against a claimed type. It take a complete, fully explicit term and a claimed type and answer yes or no.
## Core Language

The core language is implemented in Calculus of Inductive Construction that the kernel can understand. Users write proof at the tactic engine levels. Then these tactics are convert and translate to [proof term](#^proof-term) in this core language where the kernel will verified.
^ct-proof-term
## Definitions

[**Proof term**](#^ct-proof-term): A term of the Calculus of Inductive Constructions whose type corresponds to a theorem statement.
^proof-term
## Resources

- [[resources#^res-db27fa43|Software Foundations, Logical Foundations — Basics]]
- [[resources#^res-a11528be|Rocq Core Language Reference]]