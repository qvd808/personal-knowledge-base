---
tags:
  - lambda-calculus
created: 2026-08-25
---
## Introduction

Introduced in the 1930s by Alonzo Church. It is equivalent to Turing machines, meaning that it can compute anything a modern computer can.

It can compute anything, and all computable (number-theoretic) functions can be faithfully represented in the λ-calculus. 

It is the skeleton every dependent type theory is built on. λΠ, System F, the Calculus of Inductive Constructions — all of them are this, plus extra term forms and a typing discipline
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

i.e. the function $x \mapsto 2x+1$ applied to $3$ gives $2\cdot3+1$. In a way, 3 is the input we should put in x so every x inside the body is replace with 3. In general:

$$(\lambda x. M[x])N = M[N]$$

written preferably as

$$(\lambda x. M)N = M[x := N] \qquad (\beta)$$
^beta-axiom

where $[x := N]$ is substitution of $N$ for $x$. This is the one rewrite rule of the lambda calculus — the reduction from the section above, made concrete for application and abstraction specifically.
### Free and bound variables

Abstraction is said to bind the free variable x in M. For expression like $$\lambda x.yx$$ we say that it has x as bound and y as free variable. Substitution $[x := N]$ is only performed in the free occurrences of x:
$$yx(\lambda x.x)[x:=N] \equiv yN(\lambda x.x)$$
In calculus there is a similar variable binding. In $\int_{a}^{b} f(x,y)\, dx$ the variable x is bound and y is free. It does not make sense to substitute 7 for x but substitution for y makes sense.

For reasons of hygiene it will always be assumed that the bound variables that occur in a certain expression are different from the free ones. This can be fulfilled by renaming bound variables. E.g. $\lambda x.x$ becomes $\lambda y.y$. Indeed, these expressions act the same way: $(\lambda x.x)a = a = (\lambda y.y)a$ and they denote the same intended algorithm. Therefore expressions that differ only in the names of bound variables are identified.
### Functions of more arguments

Functions of several arguments can be constructed by iteration of application. The idea is due to Schönfinkel (1924) but is often called currying, after H.B. Curry who introduced it independently. Intuitively, if f(x, y) depends on two arguments, one can define:
$$ F_{x} = \lambda y . f(x, y)$$
$$ F = \lambda x . F_x$$
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
## Conversion

The set of $\lambda$-terms (notation $\Lambda$) is built up from an infinite set of variables V = $\{v, v', v'', ...\}$ using application and (function) abstraction.

$$
\begin{aligned}
x \in V &\implies x \in \Lambda \\
M, N \in \Lambda &\implies (MN) \in \Lambda \\
M \in \Lambda, x \in V &\implies (\lambda xM) \in \Lambda \\
\end{aligned}
$$
The same three rules, written as a formal grammar — according to Barendregt's own Def 2.1:
$$\begin{aligned}
\texttt{<variable>} &::= \texttt{v} \mid \texttt{<variable>}\,' \\
\texttt{<}\lambda\texttt{-term>} &::= \texttt{<variable>} \mid \texttt{(<}\lambda\texttt{-term><}\lambda\texttt{-term>)} \mid \texttt{(}\lambda\texttt{<variable><}\lambda\texttt{-term>)}
\end{aligned}$$
Rojas gives an equivalent grammar for the same three rules, using a dot as the separator between a binder and its body instead of Barendregt's parentheses-only style:
$$
\begin{aligned}
\texttt{<expression>}  &::= \texttt{<name>} \mid \texttt{<function>} \mid \texttt{<application>} \\
\texttt{<function>}    &::= \lambda\ \texttt{<name>}\ .\ \texttt{<expression>} \\
\texttt{<application>} &::= \texttt{<expression>}\texttt{<expression>}
\end{aligned}
$$
(R. Rojas, *A Tutorial Introduction to the Lambda Calculus*, §1, arXiv:1503.09060v1)

All three above — the inductive rules, Barendregt's grammar, Rojas's grammar — describe the same set $\Lambda$. From here on this note uses Rojas's dot notation, with one exception: the three examples right below are transcribed directly from Barendregt's own Def 2.2, so they keep his original parenthesized, dot-free style.

In a way, the set V is the set of variables and the set $\Lambda$ is the set of valid $\lambda$-terms we can construct using the inductive rules above.

More example:
- $\text{v'}$ : A single variable from the set V. This is the 1st rule: $x \in V \implies x \in \Lambda$
- $\text{v'v}$ : An application of a variable $\text{v'}$ being applied to variable $\text{v}$ as an argument (similar to $\text{f x}$ in Haskell). This use the 2nd rule which is $M, N \in \Lambda \implies (MN) \in \Lambda$
- $(\lambda \text{v(v'v)})$ : A function that takes an input named $\text{v}$, and inside the function body, it applies $\text{v'}$ to $\text{v}$. This use the 3rd rule which is $M \in \Lambda, x \in V \implies (\lambda xM) \in \Lambda$

Example for how to represent Boolean where "True" is the two-argument function that picks its first argument and "False" is where the same function picks the second argument.
$$
\begin{aligned}
T &\equiv \lambda xy.x \\
F &\equiv \lambda xy.y
\end{aligned}
$$
Since Booleans are already function that choose between 2 things, an *if-then-else* statement doesn't need a special keyword. It's just a function application
$$
\text{if P then A else B} := PAB
$$
If `P` is `T`, it evaluates to `A`. If `P` is `F`, it evaluates to `B`. The Boolean is its own conditional statement. And in fact, when `P` reduces to `T`, `PAB` reduces to `TAB`, which is $\textcolor{#ce9178}{\texttt{(}\lambda x.\ \lambda y.\ x\texttt{)}\ A\ B}$ and that reduces to `A`.

A reminder that there is a difference between $\lambda xy. x$ (which is equivalent to $\lambda x. \lambda y. x$) compare to $\lambda x. yx$. The first one represents a 2 argument function, which is [[#Functions of more arguments|shorthand notation for nested argument]], while the second one is a single parameter where the output of the function is an application of y to x ( a function call y with parameter x). Below is even more of confused ways of reading but as long as you can distinguish the . where it signifies what the function output, it going to be okay:

| Written                                                        | Means                                                                                       | Interpretation                                                                                                                              |
| -------------------------------------------------------------- | ------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| $\textcolor{#ce9178}{\lambda x.\ f\ x\ y}$                     | $\textcolor{#ce9178}{\lambda x.\ \texttt{(}\texttt{(}f\ x\texttt{)}\ y\texttt{)}}$          | So the function with argument $x$, where the body is $\textcolor{#ce9178}{\texttt{(}\texttt{(}f\ x\texttt{)}\ y\texttt{)}}$                 |
| $\textcolor{#ce9178}{\texttt{(}\lambda x.\ x\texttt{)}\ y\ z}$ | $\textcolor{#ce9178}{\texttt{(}\texttt{(}\lambda x.\ x\texttt{)}\ y\texttt{)}\ z}$          | An application: $(\lambda x.\ x)$ applied to $y$ first, then that result applied to $z$                                                     |
| $\textcolor{#ce9178}{\lambda x.\ \lambda y.\ x\ y}$            | $\textcolor{#ce9178}{\lambda x.\ \texttt{(}\lambda y.\ \texttt{(}x\ y\texttt{)}\texttt{)}}$ | A function with argument $x$ where it bodies is an application of a function with argument $y$ where the bodies is $x$ being applies to $y$ |
For the above, we say that x is bound when it sits between $\textcolor{#ce9178}{\lambda}$ and  $\textcolor{#ce9178}{.}$
It is also crucial that the x after the $\textcolor{#ce9178}{.}$ is independent from the x before it. A bound name is local and it has no meaning outside its binder, and does not communicate with the same-named variable elsewhere in the term. Similar to scoping rules in programming languages like Rust or Haskell.
### Bound and free variables

The other variables which are not bound is call free variables. The set of free variable is usually denoted FV(M)
$$   
\begin{aligned}
\text{FV(x)} &= \{x\} \\
\text{FV(M N)} &= \text{FV(M) } \cup \text{FV(N)} \\
\text{FV(} \lambda \text{x.M)} &= \text{FV(M) } - \{x\} \\
\end{aligned}
$$
There are three cases:
- A bare variable is free in itself
- An application binds nothing, so it just unions the 2 sides
- An abstraction is the only case that remove anything $\lambda$x binds every free x in its body, so x leaves the set

Some work through example below:
$$
\begin{aligned}
\text{FV(} \lambda \text{x. x}) &= \text{FV(x) - \{x\}} \\
&= \{x\} - \{x\} \\
&= \emptyset
\end{aligned}
$$
$$
\begin{aligned}
\text{FV(} \lambda \text{x. x y}) &= \text{FV(x y) - \{x\}} \\
&= \text{(FV(x)} \cup \text{FV(y))} - \{x\} \\
&= (\{x\} \cup \{y\}) - \{x\} \\
&= \{y\}
\end{aligned}
$$
$$
\begin{aligned}
\text{FV((} \lambda \text{x. x) x}) &= \text{FV(} \lambda \text{x. x)} \cup \text{FV(x)} \\
&= \text{(FV(x)} - \{x\}) \cup \{x\} \\
&= \emptyset \cup \{x\} \\
&= \{x\}
\end{aligned}
$$
### Scoping and shadow

Let's look through this one, notice how the first $FV(\lambda x. x)$ refers to the body.
$$
\begin{aligned}
\text{FV(} \lambda \text{x. } \lambda x. \text{ x}) &= \text{FV(} \lambda \text{x. x)} - \{x\} \\
&= \text{(FV(x)} - \{x\}) - \{x\} \\
&= (\{x\} - \{x\}) - \{x\} \\
&= \emptyset - \{x\} \\
&= \emptyset 
\end{aligned}
$$
The final x belongs to the inner one and this is not a convention chosen for convenience. The set `{x}` is already emptied by the inner abstraction. By the time the outer abstraction's `- {x}` runs, there is nothing left for it to remove. The outer binder binds nothing at all. Compare to the below where, since there is no shadowing this time, it is the outer `x` that does the removing
$$
\begin{aligned}
\text{FV(} \lambda \text{x. } \lambda y. \text{ x}) &= \text{FV(} \lambda \text{y. x)} - \{x\} \\
&= \text{(FV(x)} - \{y\}) - \{x\} \\
&= (\{x\} - \{y\}) - \{x\} \\
&= \{x\} - \{x\} \\
&= \emptyset 
\end{aligned}
$$
From the 2 examples above, they are closed for different reasons where it depends on which binder captured the occurrence. The general rule, which follows from the definition being applied innermost-first: an occurrence belongs to the nearest enclosing binder of the same name. An outer binder of the same name is shadowed over that region and binds nothing here. This is the same rule as a shadowed `let` in Rust.

### Alpha-equivalence

Shadowing answers which binder wins *inside* one term. A bound name is just a pointer to its binder, and what matters is which binder it points at, not what the pointer is spelled. Because of that, 2 questions arise: when are two *different* terms actually the same term?

Renaming a bound variable never changes which function a term denotes, so the following count as equivalent, written $M \equiv N$:
$$
\begin{aligned}
(\lambda xy)z &\equiv (\lambda xy)z; \\
(\lambda xx)z &\equiv (\lambda yy)z.
\end{aligned}
$$
Rojas gives the same idea as a longer chain — rename the bound variable through several names in a row, still the same function:
$$
(\lambda z.z) \equiv (\lambda y.y) \equiv (\lambda t.t) \equiv (\lambda u.u)
$$
(Rojas, §1)

But $\equiv$ is checked on shape, not on meaning, so it can fail even between terms that end up computing to the same thing:
$$
\begin{aligned}
(\lambda xx)z &\not\equiv z; \\
(\lambda xx)z &\not\equiv (\lambda xy)z.
\end{aligned}
$$
(Barendregt & Barendsen, Convention 2.3(ii))

> [!note] Where $=$ comes from
> $(\lambda x. x)z \not\equiv z$ above, and yet $(\lambda x. x)z = z$ is also true — see the $(\beta)$ axiom under [[lambda-calculus#^beta-axiom|Application and abstraction]]: $(\lambda x. M)N = M[x := N]$.
> $\textcolor{#ce9178}{\equiv}$ is syntactic: two terms are $\textcolor{#ce9178}{\equiv}$ if they're the same term, or become the same term by renaming a bound variable — checked on shape alone, before any reduction happens. $\textcolor{#ce9178}{=}$ is the equational theory built from $(\beta)$; it's what actually lets you rewrite $(\lambda x.x)z$ down to $z$. An application can never become $\textcolor{#ce9178}{\equiv}$ to a bare variable no matter how you rename its bound variables, because renaming can't change a term's shape from "application" to "variable" — only reduction ($\textcolor{#ce9178}{=}$) can get you from one to the other.

## Resources

- [[resources#^res-72f015c2|Introduction to Lambda Calculus]]
- [[resources#^res-2330a1ca|The Lambda Calculus (Stanford Encyclopedia of Philosophy)]]
