"use strict";

/**
 * SW2.5 Library - Auto-creación de carpetas de compendium en la barra lateral.
 *
 * Garantiza que exista la jerarquía:
 *   Sword World 2.5 Library
 *     Character Options
 *     Gear
 *     Magic
 *     Monsters
 *
 * incluso en mundos creados antes de instalar el módulo o donde se activó
 * después de generar el mundo. No borra nada ni pide tocar data/packs.
 */

const SW25_LIBRARY_PACK_FOLDERS = {
  name: "Sword World 2.5 Library",
  sorting: "a",
  color: "#5b2333",
  folders: [
    { name: "Character Options", sorting: "a", color: "#7f3f98", packs: ["classes", "races", "features", "feats"] },
    { name: "Gear", sorting: "a", color: "#a8671c", packs: ["weapons", "armor", "equipment"] },
    { name: "Magic", sorting: "a", color: "#2e6959", packs: ["spells"] },
    {
      name: "Monsters",
      sorting: "a",
      color: "#8b1e2d",
      packs: [
        "monsters-animals",
        "monsters-barbarous",
        "monsters-constructs",
        "monsters-daemons",
        "monsters-fairies",
        "monsters-golems",
        "monsters-humanoids",
        "monsters-magitech",
        "monsters-mythical-beasts",
        "monsters-plants",
        "monsters-undead"
      ]
    }
  ]
};

async function ensureSw25LibraryCompendiumFolders() {
  if (!game || !game.user?.isGM) return;

  let config = game.settings.get("core", "compendiumConfiguration");
  if (typeof config !== "object" || config === null) config = {};

  const findFolder = (name, parentId) =>
    [...game.folders.values()].find((f) => f.name === name && f.type === "Compendium" && f.folder === parentId);

  let root = findFolder("Sword World 2.5 Library", null);
  const created = [];

  if (!root) {
    root = await Folder.create({
      name: "Sword World 2.5 Library",
      type: "Compendium",
      sorting: "a",
      color: "#5b2333",
      sort: 100000,
      folder: null
    });
    created.push(root.name);
  }

  let sort = 200000;
  for (const sub of SW25_LIBRARY_PACK_FOLDERS.folders) {
    let folder = findFolder(sub.name, root.id);
    if (!folder) {
      folder = await Folder.create({
        name: sub.name,
        type: "Compendium",
        sorting: sub.sorting,
        color: sub.color,
        sort: sort++,
        folder: root.id
      });
      created.push(folder.name);
    }

    for (const packName of sub.packs) {
      const packId = `sw25-library.${packName}`;
      config[packId] = {
        folder: folder.id,
        sort: config[packId]?.sort ?? sort * 100
      };
    }
  }

  if (created.length > 0) {
    await game.settings.set("core", "compendiumConfiguration", config);
    ui.notifications.info(`SW2.5 Library: carpetas creadas (${created.join(", ")})`);
  }
}

Hooks.once("ready", ensureSw25LibraryCompendiumFolders);
