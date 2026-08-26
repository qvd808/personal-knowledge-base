---
tags:
  - lambda-calculus
created: 2026-08-25
---

## Introduction

Invented by Church in 1936 and later Turing prove that this system is also Turing complete meaning that it can compute anything a modern computer can. And then come the invention of functional programming

### Reduction and functional programming

A functional program consists of an expression E (representing both the algorithm and the input). The expression is subject to some rewrite rules. Reduction is replacing part P of E by another expression P' according to some schema/rules.

$$
E[P] \rightarrow E[P']
$$
The reduction will continue until no rewrite can be applied, by which we mean we call it normal form E* of the expression E.

**Ex: (7 + 4) * (8 + 5 * 3) $\rightarrow$ 253**

Reduction systems usually satisfy the Church-Rosser property, which states that the normal form obtained is independent of the order of evaluation of sub terms.

### Application and abstraction

The first basic operation of the $\lambda$-calculus is application. The expression
$$ F \cdot A$$
or 
$$ FA$$
denotes the data F as an algorithm applied to the data A as an input. This can be viewed in 2 ways:
- The process of computation $FA$ (captured by conversion, and better still by reduction)
- The output of this process (captured by the notion of models / semantics)

This is type free (no typing discipline restricts what can be applied to what), which makes an expression like $FF$ — F applied to itself — allowed. This isn't itself a recursive definition; it's self-application, and it's what later gets used to *build* recursion (fixed-point combinators, not covered yet).

The second basic operation is abstraction. If $M \equiv M[x]$ is an expression depending on $x$, then $\lambda x. M[x]$ denotes the function $x \mapsto M[x]$.

Application and abstraction work together:

$$(\lambda x. 2x + 1)\,3 = 2 \cdot 3 + 1 \;(=7)$$

i.e. the function $x \mapsto 2x+1$ applied to $3$ gives $2\cdot3+1$. In general:

$$(\lambda x. M[x])N = M[N]$$

written preferably as

$$(\lambda x. M)N = M[x := N] \qquad (\beta)$$

where $[x := N]$ is substitution of $N$ for $x$. This is the one rewrite rule of the lambda calculus — the reduction from the section above, made concrete for application and abstraction specifically.
### Free and bound variables

Abstraction is said to bind the free variable x in M. For expression like $$\lambda x.yx$$ we say that it has x as bound and y as free variable. Substitution $[x := N]$ is only performed in the free occurrences of x:
$$yx(\lambda x.x)[x:=N] \equiv yN(\lambda x.x)$$
In calculus there is a similar variable binding. In $\int_{a}^{b} f(x,y)\, dx$ the variable x is bound and y is free. It does not make sense to substitute 7 for x but substitution for y makes sense.

For reasons of hygiene it will always be assumed that the bound variables that occur in a certain expression are different from the free one. This can be fulfilled by renaming bound variables. E.g. $\lambda x.x$ becomes $\lambda y.y$. Indeed, these expressions act the same way: $(\lambda x.x)a = a = (\lambda y.y)a$ and they denote the same intended algorithm. Therefore expressions that differ only in the names of bound variables are identified.
### Functions of more arguments

Functions of several arguments can be constructed by iteration of application. The idea is due to Schönfinkel (1924) but is often called currying, after H.B. Curry who introduced it independently. Intuitively, if f(x, y) depends on two arguments, one can define:
$$ F_{x} = \lambda y \cdot f(x, y)$$
$$ F = \lambda x \cdot F_x$$
Then,
$$ (F x) y = F_x y = f(x, y) \qquad (*)$$
The last equation shows that it is convenient to use association to the left for the iterated application:
$$
FM_1 \cdots M_n \text{ denotes } (\cdots((FM_1)M_2)\cdots M_n)
$$
The equation (∗) then becomes:
$$
Fxy = f(x, y)
$$
Dually, iterated abstraction uses association to the right:
$$
\lambda x_1 \cdots x_n. f(x_1, \ldots, x_n) \text{ denotes } \lambda x_1.(\lambda x_2.(\cdots(\lambda x_n. f(x_1, \ldots, x_n))\cdots))
$$
Then we have for F defined above:
$$
F = \lambda xy. f(x,y)
$$
and (∗) becomes:
$$
(\lambda xy. f(x,y))\,xy = f(x,y)
$$
For n arguments we have:
$$
(\lambda x_1 \cdots x_n. f(x_1, \ldots, x_n))\,x_1 \cdots x_n = f(x_1, \ldots, x_n)
$$
by using n times (β). This last equation becomes in convenient vector notation:
$$
(\lambda \vec{x}. f[\vec{x}])\,\vec{x} = f[\vec{x}]
$$
more generally one has:
$$
(\lambda \vec{x}. f[\vec{x}])\,\vec{N} = f[\vec{N}]
$$
## Resources

[[resources#^res-72f015c2|Introduction to Lambda Calculus]]
