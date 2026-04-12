# Gutenberg Refactor Brief

This is the corrected repo-specific brief for the current golden baseline. It keeps the strong parts of the earlier prompt, but it fixes the places where the prompt drifted from the actual code in this repo.

## What I Agree With

- The main failure mode is loose serialization contracts, not a generic lack of Gutenberg features.
- `theme-factory/container` should be the first refactor target.
- Buttons should be rebuilt immediately after container.
- Broad `core/html` fallback is the wrong default for this product.
- Import-time markup surgery is dangerous and should be removed or minimized.
- The next real quality gate needs to be round-trip and reopen/resave validation, not comment-matching only.

## Repo-Specific Corrections

These details match the current golden baseline and should replace the less precise wording from the earlier draft:

- `theme-factory/container` is currently registered as a dynamic block with a PHP render callback, but its `save()` still returns `InnerBlocks.Content`.
- The container block currently stores `style` as a raw string and `extraAttributes` as a JSON string.
- The container editor parses `style` back into an object and spreads parsed `extraAttributes` into `useBlockProps()`.
- The PHP render callback for `theme-factory/container` currently just returns `$content`, so the wrapper is effectively owned by saved content instead of PHP.
- The importer reparses converted markup with `parse_blocks()`, wraps missing page-shell markup, and rewrites inner block classes with `fix_block_classes()`.
- Button groups are currently faked by wrapping adjacent `theme-factory/button` blocks inside `theme-factory/container` with `wp-block-buttons` classes.
- Validation is currently limited to block comment matching. It does not model parse -> reopen editor -> resave stability.

## Corrected Master Prompt

Use this version as the next builder prompt if you want the LLM to target the current repo accurately.

```text
Act as a senior WordPress block architect, Gutenberg serialization expert, PHP block developer, React compiler engineer, and migration engineer.

I have a React-to-WordPress converter that currently produces editable output in WordPress, but the result is still brittle:
- Gutenberg sometimes shows invalid block / Attempt Recovery behavior
- deep visual editing is weaker than Gutenberg-native demo themes
- too much of the current system relies on permissive custom blocks and wrapper reconstruction
- the current container architecture is too loose and likely causing drift
- button output is not native enough
- validation/testing is not modeling real editor reopen/resave behavior

You must redesign the converter so it outputs a production-grade WordPress block theme plus companion custom-block plugin with stable serialization and strong native editing behavior.

IMPORTANT CURRENT-REPO CONTEXT

The current codebase has these real problems:

1. theme-factory/container is too loose:
- it stores style as a string
- it stores extraAttributes as arbitrary JSON/string data
- it parses style back in edit.js
- it spreads parsed extraAttributes into useBlockProps
- it is registered as dynamic, but save() still returns InnerBlocks.Content
- its PHP render callback currently just returns $content instead of owning the wrapper

2. The current converter often emits guessed wrapper HTML and pseudo-native structures instead of rigorously matching Gutenberg’s real serialization behavior.

3. Button output is not native enough:
- adjacent buttons are grouped by wrapping theme-factory/button blocks in theme-factory/container with wp-block-buttons classes
- the system is effectively faking button groups instead of using real core/buttons + core/button when safe

4. We want a visually editable Gutenberg-native experience, so broad fallback to core/html is NOT an acceptable general strategy. It can be an emergency last resort only, not a default architecture.

5. The importer currently reparses and mutates generated block content during import. That is dangerous and must be removed, minimized, or formalized as part of the block contract.

6. The short-term goal is not a total rewrite first. The first refactor must focus on tightening block contracts, especially container and button output, then adding true validation harnesses, then expanding architecture.

NON-NEGOTIABLE WORDPRESS RULES

- Static blocks must save markup that matches save().
- Static wrappers must use useBlockProps.save() when the block has a wrapper.
- Dynamic blocks rendered in PHP should use get_block_wrapper_attributes() for the wrapper.
- block.json must be the canonical block definition and blocks should be registered on both server and client.
- Block supports register additional attributes and wrapper behavior; do not fight the native style/supports system with conflicting custom attributes.
- Dynamic blocks do NOT always mean save() => null. If a dynamic block contains InnerBlocks, save() should preserve nested content with InnerBlocks.Content.
- If saved structure changes for a static block, deprecated versions and migrations are required.
- Filters or import-time mutations that alter serialized block HTML after the save contract can cause validation drift.

PRIMARY OBJECTIVE

Refactor the converter so it produces block content that:
1. survives save -> reopen editor -> save again without invalid block errors
2. is deeply visually editable in Gutenberg and the Site Editor
3. uses native core blocks whenever possible
4. uses stricter custom blocks when native blocks are unsafe or insufficient
5. avoids broad HTML-block fallbacks
6. supports migration from the current brittle architecture

RETURN YOUR ANSWER IN THESE SECTIONS:

1. Executive Summary
2. Root Cause Model for Current Failures
3. Repo-Specific Diagnosis
4. Target Architecture
5. Block Classification System
6. Native Core Block Mapping Rules
7. Custom Static Block Rules
8. Custom Dynamic Block Rules
9. Rebuild Plan for theme-factory/container
10. Rebuild Plan for Buttons
11. Rules for Styles, Classes, IDs, Anchors, and Wrapper Attributes
12. Rules for React Interactivity Conversion
13. Rules for Template / Pattern / Template Part Extraction
14. Validation and Testing Architecture
15. Migration and Deprecation Strategy
16. File/Folder Structure
17. Pseudocode for the Converter Pipeline
18. Acceptance Criteria
19. Ordered Refactor Roadmap
20. Immediate First Milestone

NON-NEGOTIABLE ENGINEERING RULES

- Do not use broad core/html fallback as the main architecture.
- Do not treat dynamic blocks as always save() => null.
- Do not keep a raw string style attribute on container-like blocks that also opt into native supports if that conflicts with the block-supports style model.
- Do not keep arbitrary extraAttributes as an uncontrolled JSON/string dumping ground.
- Do not keep guessing core block HTML with string templates where the native block schema/save behavior is not guaranteed.
- Do not mutate serialized block content after conversion unless the mutation is formally part of the block contract.
- Do not ignore deprecations for already-saved static block content.
- Do not recommend a huge full compiler rewrite as step one if container/button contract fixes can stabilize the system first.
```

## Corrected File-by-File Prompt

Use this version if you want the LLM to stay close to implementation order instead of architecture prose.

```text
Act as a senior WordPress Gutenberg block engineer, PHP block developer, React-to-WordPress compiler architect, and migration engineer.

You are not here to give advice only. You must design and implement the refactor plan in a file-by-file, build-order way so the converter becomes stable in Gutenberg and remains visually editable.

I have a React-to-WordPress converter with these current problems:

- Gutenberg still shows invalid block / Attempt Recovery behavior after save and reopen.
- The current architecture over-relies on permissive custom blocks instead of strict block contracts.
- The current theme-factory/container contract is too loose and likely a primary drift source.
- Button output is not native enough.
- Validation/testing is too shallow and does not model real reopen/resave behavior.
- I do NOT want a broad fallback to core/html because that destroys visual editing.

CURRENT REPO REALITY

1. theme-factory/container is too permissive:
- style is treated as a raw string
- extraAttributes is arbitrary/open-ended
- edit.js parses style and spreads wrapper props
- save() returns InnerBlocks.Content
- PHP render currently returns $content without owning the wrapper

2. Button generation is not native enough:
- adjacent buttons are wrapped in theme-factory/container with wp-block-buttons classes
- the system defaults to theme-factory/button instead of core/button where safe

3. Validation is too shallow:
- current validation only checks block comment pairing

4. Import-time markup mutation exists:
- process_content_for_import() reparses content
- fix_block_classes() rewrites innerContent classes
- missing page-shell wrappers are injected during import

PROJECT GOAL

Refactor the converter so it produces:
- stable Gutenberg block content with no invalid block / Attempt Recovery errors on normal edit flows
- strong visual editability in the editor and Site Editor
- native core blocks wherever safe
- stricter custom blocks where native blocks are unsafe or insufficient
- a migration path from the current brittle block shapes

DO NOT DO THESE THINGS

- Do not use broad core/html fallback as the main fix.
- Do not treat all dynamic blocks as save() => null.
- Do not keep a raw string style attribute on container-like blocks if that conflicts with the native style/supports model.
- Do not keep arbitrary extraAttributes as a JSON/string dumping ground.
- Do not keep guessing native core block HTML with brittle string templates where exact schema/save behavior is uncertain.
- Do not recommend a full IR/compiler rewrite as step 1 if container/button contract fixes can stabilize the system first.
- Do not mutate serialized block content after conversion unless that mutation is formally part of the block contract.
- Do not ignore deprecations for already-saved custom block content whose save shape changes.

YOUR TASK

Return a file-by-file execution plan and the concrete implementation design needed to refactor this repo in the correct order.

RETURN YOUR ANSWER IN THIS ORDER:
1. Executive diagnosis
2. First 3 files to change
3. File-by-file implementation plan
4. Rebuild design for theme-factory/container
5. Rebuild design for buttons
6. Converter classification rules
7. Validation/test harness redesign
8. Migration/deprecation plan
9. Immediate milestone for this week
10. Definition of done

At the end, provide:
- a one-page refactor summary
- a file edit checklist
- the first commit plan
```

## Immediate First Milestone

The safest first milestone for this repo is:

1. Add a contract-audit script that reports the current drift sources.
2. Rewrite the prompt/brief so it matches the real repo instead of an idealized one.
3. Only after that, refactor container and button contracts in code.

That sequence is deliberate. The last broad change set made the system worse because the implementation moved faster than the baseline diagnosis.
