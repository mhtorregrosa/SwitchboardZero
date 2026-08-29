# Contributing

Switchboard Zero is intentionally small and deterministic. Contributions should preserve the central contract: an agent may act only inside policy explicitly controlled by the human interface.

1. Create a branch from `main`.
2. Keep the scenario fictional and avoid third-party brand assets.
3. Add or update deterministic tests for every state transition.
4. Run `npm run check`.
5. Open a pull request describing both the visible change and its authority implications.

Do not add network calls, analytics or real-infrastructure integrations without an explicit design and security review.
