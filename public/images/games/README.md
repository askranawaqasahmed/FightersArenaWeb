# Game artwork

Local artwork for all 13 games in the seeded catalogue, plus three widescreen
images for the homepage carousel. `sources.json` records each original image
URL and its publisher/store page.

Artwork is sourced from SNK's official ACA NEOGEO catalogue and publisher
listings on Steam. Game artwork and trademarks belong to their respective
owners; downloading them does not transfer ownership or grant a license.

To refresh the assets from the repository root:

```sh
node scripts/download-game-art.mjs
```

The UI uses these files when a game has no custom uploaded image. Operator
uploads continue to take precedence. Published Content Studio slides also
take precedence over the three built-in homepage highlights.
