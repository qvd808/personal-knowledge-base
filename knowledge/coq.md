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

## Resources

- [Software Foundations, Logical Foundations — Basics](https://softwarefoundations.cis.upenn.edu/lf-current/Basics.html)
