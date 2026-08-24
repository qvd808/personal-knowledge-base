---
tags:
  - coq
  - formal-verification
created: 2026-08-23
References: https://softwarefoundations.cis.upenn.edu/lf-current/Basics.html
---
## Introduction

A proof assistant and expressive function programming language within a system.
It contains components such as:
	- Galina (Programming Language): The underlying, dependently type functional programming language based on the idea of Calculus of Inductive Construction (CIC)
	- Vernacular: Top-level commands language used to structure scripts and defines module, manage env, and register theorem
	- Ltac/Ltac2: Tatic language which is DSL. Used to write proof scripts and construct proof term interactively
	
Can be used for formal verification or interactive mathematics

## Data and function

It is a functional programming a language, so in a way everything is a function. We can defines types like

```rocq
  Inductive day : Type :=  
  | monday  
  | tuesday  
  | wednesday  
  | thursday  
  | friday  
  | saturday  
  | sunday. 
```

It also has Boolean type, which is true and false. You can define a function with **match** similar to Haskell or Rust

```coq
Definition negb :=  
  match b with  
  | true  
  | false  
  end.
```

It also provides a module systems to aid in developments