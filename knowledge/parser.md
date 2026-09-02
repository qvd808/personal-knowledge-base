---
tags:
  - parser
created: 2026-09-01
---

## Introduction

A parser is an algorithm that take a sequence of tokens and produce the correct syntax tree

Recursive descent is the implementation method where each grammar rule become one function, and a rule mentioning another rule become a call to that rule's function. Nesting in the input is handled by the call stack: recursion in the grammar becomes recursion in the code. "Descent" because it enters at the outermost rule and works down to the leaves.