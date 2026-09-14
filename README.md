# Pokémon d20 Companion — V0.2.7 Premade Playtest Edition


## V0.2.7 shiny creation rule
- Shiny status can only be chosen when a Pokémon is first added to the character (including starter creation).
- Existing Pokémon sheets display shiny status but no longer allow it to be toggled on or off afterward.
- Evolution and Substitute continue to preserve/restore the Pokémon's original shiny status.

## V0.2.6 shiny sprite support

- All 151 supplied Kanto shiny sprites are bundled locally under `assets/pokemon/shiny/`.
- A **Shiny Pokémon** checkbox appears when adding a Pokémon.
- Existing Pokémon can be switched between normal and shiny from their Pokémon sheet.
- Substitute still overrides the displayed sprite while active; when Substitute ends or breaks, the correct normal or shiny sprite returns automatically.
- Starter creation also supports a shiny checkbox.

This build is the premade-character edition of the V0.2.5 Player Companion. It keeps the four ready-to-use Level 4 Trainers from the earlier premade build and now includes the supplied Kanto Pokémon sprites and Substitute visual state.

## Premade characters

### Theo — Level 4 Trainer
- Background: Academy Student
- Charmander Lv. 6
- Kingler Lv. 6
- Diglett Lv. 7
- Growlithe Lv. 7

### Jordan — Level 4 Technician
- Background: Athlete
- Squirtle Lv. 5
- Voltorb Lv. 8
- Mankey Lv. 8
- Raichu Lv. 9

### Maya — Level 4 Researcher
- Background: Tinkerer
- Bulbasaur Lv. 8
- Parasect Lv. 9
- Alakazam Lv. 8
- Nidoran♂ Lv. 6

### Ava — Level 4 Nurse
- Background: Performer
- Squirtle Lv. 6
- Doduo Lv. 5
- Nidoqueen Lv. 8
- Wartortle Lv. 7

## V0.2.5 sprite update
- Bundles the supplied sprites for all 151 Kanto Pokémon.
- Shows sprites across Party, Pokémon sheets, PC storage, Pokédex and starter creation.
- Pokémon with the **Substitute** move can use a manual **Use Substitute** control.
- While Substitute is active, the Pokémon's image changes to the supplied Substitute sprite.
- Press **Break / End** to restore the normal Pokémon sprite.
- HP cost and Substitute damage remain manual tabletop bookkeeping; the app does not resolve dice or combat automatically.

## Save compatibility

This edition keeps the same separate browser storage key as the V0.2.4 Premade build, so existing premade-edition saves on the same site/device should carry forward. It remains separate from the normal Player Companion save data.

The four premades are only seeded when this edition has no saved Trainers, so updating an existing deployment will not overwrite changes your players have already made.

## GitHub Pages

For the GitHub Pages package, upload the files directly to the repository root so `index.html` is at the top level. The package includes `.nojekyll` and the offline service worker.

## Running locally

### macOS
Double-click `start.command`. If macOS blocks it, right-click it and choose Open.

### Windows
Double-click `start.bat`.

Then open `http://localhost:8080` if your browser does not open automatically.
