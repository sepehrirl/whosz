# Architecture

Telegram → grammY handlers → game services → SQLite repository.

Modules:
- bot: commands and callbacks
- game: lifecycle and scoring
- questions: curated question bank
- db: SQLite persistence
- achievements: unlock rules
- utils: tokens and formatting

Deep-link tokens never contain Telegram IDs.
