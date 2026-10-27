# SW2.5 Library

A community compendium library for the [Sword World 2.5 Foundry system](https://github.com/matsu-o-taka/Sword-World-2.5-Taka).

It contains the full Sword World 2.5 catalog in English, parsed from [sw25.wikidot.com](https://sw25.wikidot.com) and organized in Foundry VTT compendium packs. Every pack keeps the folder tree used in the source world, so classes, spells, feats, equipment and monsters are browsable by the categories you would expect from the books.

![Foundry VTT version](https://img.shields.io/badge/Foundry-V14%2B-orange) ![System](https://img.shields.io/badge/System-sword--world--25%200.14.20%2B-blue)

## Installation

1. Install the system first: in Foundry VTT, open **Game Systems → Install System** and paste this Manifest URL:

   ```
   https://raw.githubusercontent.com/matsu-o-taka/Sword-World-2.5-Taka/main/system.json
   ```

2. Then install this library: open **Add-on Modules → Install Module** and paste this Manifest URL:

   ```
   https://raw.githubusercontent.com/matsu-o-taka/SW25-Library/main/module.json
   ```

3. In your game world, enable **SW2.5 Library** in **Manage Modules**, restart, and open **Compendium Packs**.

Alternatively, download the `sw25-library.zip` from the [releases page](https://github.com/matsu-o-taka/SW25-Library/releases) and unpack it into `Data/modules/sw25-library`.

## Contents

The sidebar groups the packs under a single **Sword World 2.5 Library** folder (created per world from the module's `packFolders`):

- **Character Options** — Classes (25), Races (42), Class Features (229), Feats (119)
- **Gear** — Weapons (318), Armor and Shields (76), Equipment (461)
- **Magic** — Spells (656)
- **Monsters** — 11 category packs with 712 monster actors

Inside each pack, documents are arranged in folders mirroring the source world layout, for example:

- `Monsters SW25 > Undead`
- `Spells > Fairy Magic > Level 7`
- `Features > Tactician > Stratagems`
- `Ancestry > Humanoid`

## Notes

- Requires Foundry **14 or later** (the same requirement as the sword-world-25 system; folders inside compendium packs come included).
- Requires the **sword-world-25** system 0.14.20 or newer (0.15.0 verified).
- Every document keeps its `sourceUrl` pointing to the original wiki page, so "Import SW2.5 ..." buttons of the system will not re-import content that is already here.
- The monsters are plain `monster` actors and can be spawned directly onto scenes.

## Source and credits

- Catalog data parsed from the SW2.5 community wiki: [sw25.wikidot.com](https://sw25.wikidot.com).
- System: [Sword World 2.5 by Daedalus](https://github.com/DaedaIus/Sword-World-2.5-Foundry) and the [Taka fork](https://github.com/matsu-o-taka/Sword-World-2.5-Taka).
- Sword World 2.5 is a tabletop RPG by Group SNE / Fujimi Shobo. This packaging is a non-commercial fan resource; please check the source wiki and the game's terms before redistributing.

---

O-Taka
