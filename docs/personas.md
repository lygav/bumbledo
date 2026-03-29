# Bumbledo — User Personas

> **Product space:** Personal life organization
> **Core differentiators:** Dependency DAG visualization, local-first (no backend), zero friction
> **Last updated:** 2025-07-19

These personas guide feature decisions for bumbledo. They represent real people organizing their everyday lives — household management, family events, health, finances, and daily routines. Each persona encounters natural dependency chains in their personal life and needs a tool that makes those chains visible without adding overhead.

Bumbledo's primary framing: **"I use bumbledo to organize my life."** Side projects and learning goals are valid use cases but secondary to the core mission of personal life organization.

---

## 1. Priya — The Household Organizer

**Who they are:**
Priya is a 34-year-old marketing manager who runs a busy household with her partner. She manages grocery planning, home maintenance, family events, financial deadlines, and vacation logistics. She's not technical — she uses Google Sheets and Apple Reminders today. She's organized by nature but frustrated that her tools can't show *why* something is stuck or what to tackle first on a Saturday morning.

**Why bumbledo:**
Priya's life is a web of dependency chains she manages in her head. She can't cook Sunday meal prep until she buys the ingredients, and she can't buy ingredients until she finalizes the weekly menu. She can't schedule the plumber until she gets the landlord's approval. She can't file taxes until she collects all her 1099s and W-2s, which depends on her employer mailing them. She can't send party invites until she books the venue, which depends on confirming the date with family. She's been burned by starting a task only to realize a prerequisite wasn't done. Bumbledo makes those invisible chains visible — and it's simple enough that she doesn't need to learn a "system."

**Key scenarios:**
- **Grocery → cook → prep:** Plans weekly meals, builds a grocery list with dependencies (buy chicken → marinate → cook → portion into lunch containers)
- **Home maintenance:** Tracks checklists where steps depend on each other (research contractors → get quotes → pick one → schedule work → inspect results)
- **Moving house:** Dozens of dependent steps (get boxes → pack room-by-room → schedule movers → clean old place → return keys → update address everywhere)
- **Tax season:** Collect W-2 → collect 1099s → organize deductions → fill out forms → file → pay balance
- **Birthday party:** Pick date → book venue → send invites → order cake → buy decorations → prep day-of timeline

**Key behaviors:**
- Plans in categories: Home, Family, Finance, Health, Weekly Routines
- Checks her list every morning with coffee — "what can I actually do today?"
- Adds tasks when she thinks of them (phone or laptop, whenever)
- Shares her screen with her partner to coordinate household tasks (no accounts needed)

**Pain points:**
- Reminders and sticky notes don't show relationships between tasks
- Starts a project step only to realize something else needed to happen first
- Spreadsheets work but they're tedious — she wants something visual
- Doesn't want another app that requires a login, a subscription, or a tutorial

**Feature priorities:**
1. Visual dependency map — see at a glance what's ready vs. waiting
2. Dead-simple UX — add a task, set a dependency, done
3. No sign-up, no cloud — open in browser and start immediately
4. Progress visibility (burndown) — see she's making headway on big life projects

---

## 2. Daniel — The Wellness & Routine Tracker

**Who they are:**
Daniel is a 38-year-old high school teacher and father of two. He's trying to get healthier, stay on top of medical appointments, and build consistent daily routines for himself and his family. He's not technical — he uses his phone's built-in apps and a whiteboard on the fridge. He's motivated but overwhelmed by how many things in his personal life depend on other things happening first.

**Why bumbledo:**
Daniel's health and family routines are full of hidden sequences. He can't start his new running program until his doctor clears him, which depends on getting blood work results back, which depends on scheduling the appointment. He can't switch the kids to a new school until he tours it, which depends on calling admissions, which depends on getting the recommendation letter from the current school. His morning routine has a natural flow — if he skips one step, the rest falls apart. Bumbledo shows him the chain so he can see exactly where he is and what's actually next.

**Key scenarios:**
- **Fitness program:** Get doctor clearance → buy running shoes → complete week 1 (3 runs) → increase distance week 2 → sign up for 5K
- **Medical chain:** Schedule blood work → get results → follow-up with doctor → start medication → 30-day check-in
- **Morning routine:** Wake up → stretch → make coffee → pack kids' lunches → review today's schedule → leave by 7:30
- **Evening routine:** Kids' homework → dinner prep → baths → bedtime stories → prep tomorrow's clothes → personal time
- **Kids' school switch:** Research schools → tour top 3 → request transcripts → submit application → wait for acceptance → register → buy uniforms

**Key behaviors:**
- Reviews bumbledo on Sunday evening to plan the week's health and family tasks
- Uses dependencies to model progressive fitness steps — each week builds on the last
- Tracks medical appointment chains (test → results → follow-up → action)
- Wants to see what his family can accomplish this week vs. what's waiting on external things

**Pain points:**
- Forgets which medical step comes next — was he waiting on results or supposed to schedule something?
- Fitness plans fall apart because he skips prerequisites (e.g., forgets to buy proper shoes)
- Family logistics involve chains that span days or weeks — paper lists lose the thread
- Apps aimed at fitness or health are too narrow — he needs one place for *all* his personal chains

**Feature priorities:**
1. Dependency chains for progressive goals — model "do A before B before C" naturally
2. Morning clarity — open the app, instantly see what's actionable today
3. Zero friction — no account, no setup, works on his phone's browser
4. Smart unblock alerts — when a waiting task resolves, surface what's now available

---

## 3. Jake — The Student Life Planner

**Who they are:**
Jake is a 21-year-old university student double-majoring in Environmental Science and Economics. Beyond coursework, he's managing his apartment, meal planning on a budget, a part-time job, grad school applications, and a campus organization. He's digitally native but not a developer. He tried Notion but it became a procrastination trap (building the system instead of using it).

**Why bumbledo:**
Jake's life is a web of overlapping dependency chains — academic, domestic, and personal. He can't submit grad applications until he gets recommendation letters, which he can't request until he writes the request emails. He can't register for Advanced Econometrics until he passes Stats II. But he also can't cook dinner until he goes grocery shopping, can't do laundry until he buys detergent, and can't focus on studying until his apartment isn't a disaster. He needs to see *all* these chains in one place — school, home, and life — without maintaining a complex system.

**Key scenarios:**
- **Grad applications:** Write personal statement → get feedback → revise → request rec letters → wait for letters → submit applications → send transcripts
- **Weekly chores:** Buy cleaning supplies → clean bathroom → vacuum → take out trash → do laundry (wash → dry → fold → put away)
- **Meal prep on a budget:** Plan meals → check pantry → write grocery list → shop → prep ingredients → cook batch meals
- **Course prerequisites:** Pass Stats II → register for Advanced Econ → buy textbook → complete problem set 1
- **Apartment move-out:** Give notice → start packing → schedule cleaning → return keys → get deposit back → find new place

**Key behaviors:**
- Brain-dumps tasks at the start of each week — school *and* life in the same list
- Checks bumbledo between classes — "what's the most impactful thing I can knock out in 30 minutes?"
- Uses dependencies to model everything from course prerequisites to grocery-before-cooking chains
- Privacy matters — doesn't want a cloud app seeing his half-written personal statements or finances

**Pain points:**
- Overwhelm — a flat list of 40 tasks (school + chores + errands + apps) with no structure causes paralysis
- Prerequisite blindness — forgets that Task B depends on Task A until he's stuck
- App fatigue — tried 5 productivity apps, all either too simple (no dependencies) or too complex (Notion)
- Doesn't want to pay for a subscription on a student budget

**Feature priorities:**
1. Dependency chains — model prerequisite sequences for school, chores, and life tasks
2. Zero cost, zero friction — free, no account, opens instantly in a browser
3. Clarity on "what's next" — filtered view of unblocked tasks across all life areas
4. Keyboard shortcuts — fast capture between classes

---

## 4. Marco — The Side-Project Hobbyist

**Who they are:**
Marco is a 29-year-old software developer with a full-time job. Outside of work, he runs personal side projects — an app idea, a home server setup, learning Rust on weekends. He also uses bumbledo for personal life tasks: planning a kitchen renovation, tracking car maintenance, and organizing a camping trip. He's technically fluent but his personal life has no project manager. Things fall through the cracks constantly.

**Why bumbledo:**
Marco originally found bumbledo for his side projects — he can't deploy until he configures DNS, can't test until he sets up the dev environment. But he stayed because it works just as well for life logistics. He can't install the new backsplash until the countertops are done, and the countertops depend on the plumber finishing. His camping trip has a natural chain: reserve campsite → buy gear → pack food → prep car. He needs a tool that shows him *what's actually unblocked right now* across both his projects and his personal life.

**Key scenarios:**
- **Kitchen renovation:** Research designs → get quotes → order countertops → schedule plumber → install countertops → install backsplash → paint
- **Car maintenance:** Check tire wear → schedule rotation → get oil change → replace cabin filter → inspection due
- **Camping trip:** Reserve site → check gear → buy missing items → plan meals → pack cooler → prep car → drive
- **Side project:** Configure DNS → set up dev env → build auth → deploy staging → invite beta testers
- **Learning goal:** Pick a course → complete module 1 → build practice project → complete module 2 → write blog post

**Key behaviors:**
- Opens bumbledo on Saturday morning to figure out what to tackle — life stuff *and* projects
- Adds tasks in bursts (brain dumps after a shower thought or a podcast)
- Uses dependencies heavily — most of his tasks have a natural order, whether it's code or home improvement
- Never wants to create an account or sync to a cloud service for personal stuff

**Pain points:**
- Wastes precious weekend time figuring out *what* to do instead of *doing* it
- Forgets which tasks are blocked and why — starts something, hits a wall, loses momentum
- Work tools (Jira, Linear) feel wrong for personal life — too heavy, too corporate
- Doesn't trust cloud services with half-baked project notes or personal plans

**Feature priorities:**
1. Fast task capture (keyboard-first, no modals)
2. Dependency DAG — see the critical path through life tasks and personal projects
3. Smart blocked alerts — know instantly what's unblocked after completing a task
4. No account, no sync, no subscription — just open and use

---

## Summary Table

| Persona | Age | Technical? | Primary use case | Key dependency scenario | Top need |
|---------|-----|-----------|-----------------|------------------------|----------|
| **Priya** — Household Organizer | 34 | No | Grocery planning, home maintenance, family events, finances, moving | Can't cook until groceries bought; can't file taxes until 1099s collected; can't send invites until venue booked | Visual dependency map for everyday life chains |
| **Daniel** — Wellness & Routine Tracker | 38 | No | Fitness programs, medical appointments, daily routines, family logistics | Can't start running until doctor clears; can't switch schools until tours done | Morning clarity — see what's actionable today |
| **Jake** — Student Life Planner | 21 | No | Coursework, apartment life, meal prep, grad applications | Can't cook until groceries bought; can't submit apps until letters received | Cut through overwhelm across school + life |
| **Marco** — Side-Project Hobbyist | 29 | Yes | Kitchen renovation, car maintenance, camping trips, side projects | Can't install backsplash until countertops done; can't deploy until DNS configured | See what's unblocked across life + projects |

### Cross-cutting themes

All four personas share these needs:

- **Life organization first** — bumbledo is for managing your personal life, not your job
- **Dependency visibility** — everyday life involves natural task sequences that flat lists hide
- **Zero friction** — no accounts, no subscriptions, no onboarding tutorials
- **Local-first trust** — personal data stays on their device, period
- **Instant clarity** — open the app, see what's actionable, start doing
- **Lightweight over powerful** — they want a sharp knife, not a Swiss Army knife
