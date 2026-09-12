# Pokémon d20 Companion — Premade Changelog

## V0.2.5 Premade
- Added supplied Kanto sprites throughout the Player Companion.
- Added manual Substitute sprite switching when the Substitute move is used.
- Kept the four Level 4 premade Trainers and their separate save key.
- Existing V0.2.4 Premade saves remain compatible.
- Updated offline sprite caching and GitHub Pages deployment files.

## V0.2.5
- Added supplied Kanto Pokémon sprites throughout the Player Companion.
- Added sprite previews to party, storage, Pokémon sheets, Pokédex and starter creation.
- Added manual Substitute visual state: Use Substitute swaps the Pokémon image to the supplied Substitute sprite; Break / End restores it.
- Substitute remains bookkeeping-only; HP cost and damage are resolved manually at the table.
- Updated offline cache to include all supplied sprites.

# Changelog

## V0.2.4

- Reverted starter level handling to the V0.2.1 behaviour.
- Trainer creation still limits starters to Bulbasaur, Charmander, and Squirtle.
- Starter level is editable from Level 1–20 again and defaults to Level 1.
- Starting active moves and the Relearnable Move Pool are generated from the selected starter level.
- Retains V0.2.3 Pokémon Center healing, captured-Pokémon current HP entry, and limited-use Trainer feature tracking.
- Bumped offline cache/version to V0.2.4.

## V0.2.3

- Added a **Heal at Pokémon Center** button to the Home dashboard. It restores the current six-party Pokémon to full HP, revives fainted party Pokémon, clears conditions and temporary stat stages, and refills Nurse Care Charges. PC-stored Pokémon are not healed.
- Newly added/captured Pokémon can now be entered with their **current HP at the moment they are caught or received** instead of always arriving at full HP.
- Added per-fight use tracking for activated Trainer-class features while keeping passive features always available.
- Core repeatable class features use a number of times per fight equal to Trainer Proficiency: Tactical Command, Pokédex Scan, Encourage, and Ball Tuning.
- Existing once-per-fight features remain once per fight: Battle Instinct, Quick Command, and Triage. Quick Command also spends one Tactical Command use.
- Added manual **Reset for new fight** controls. There is still no Battle Mode; players must reset these only when the GM starts a new fight.
- Existing save data is migrated with full per-fight feature uses available.
- Retains the V0.2.2 Level 3 starter rule and the V0.2.1 natural move progression system.
- Bumped offline cache/version to V0.2.3.

## V0.2.2

- New Trainers now always begin with a **Level 3** starter Pokémon.
- Starter level is fixed in the Trainer creator rather than editable.
- Starter active moves and Relearnable Move Pool are generated from the Level 3 natural learnset.
- Existing saved Trainers and Pokémon are not retroactively changed.
- Bumped offline cache/version to V0.2.2.

## V0.2.1

- Natural level-up moves now unlock by Pokémon level instead of being freely selectable.
- Added a Kanto V1 level-up progression for all 151 Pokémon, using their game learnset order scaled to the tabletop 1–20 level range.
- Newly added Pokémon automatically learn every natural move unlocked at their current level.
- A newly added Pokémon starts with its most recent four unlocked natural moves active; earlier unlocked moves stay in the Relearnable Move Pool.
- Leveling a Pokémon unlocks new natural moves into the Relearnable Move Pool without automatically replacing its active four moves.
- The Move Manager now shows learned and future natural moves with their unlock levels; locked natural moves cannot be selected.
- TMs remain a separate way to permanently add legal moves to the Relearnable Move Pool.
- Trainer creation now limits starter selection to Bulbasaur, Charmander, and Squirtle.
- Trainer Level 4 now opens a dedicated Ability Score Improvement menu for +2 to one ability or +1 to two different abilities.
- Fixed Trainer sheet columns overlapping at narrower desktop widths.
- Fixed temporary Pokémon stat-stage controls overflowing their card, especially on smaller screens.
- Bumped offline cache/version to V0.2.1.

## V0.2.0

- Initial player companion prototype.
- Trainer creator and Level 1–5 class sheets.
- Party/PC manager, Kanto Pokédex, move compendium, Bag/economy, Held Items, Battle Marks, evolution, conditions, and manual HP/stat tracking.
- No Battle Mode and no digital dice rolling.
