export const speciesBundleFixture = {
  species: {
    id: 25,
    name: "pikachu",
    names: [
      { language: { name: "zh-Hans" }, name: "皮卡丘" },
      { language: { name: "en" }, name: "Pikachu" },
    ],
    varieties: [
      {
        is_default: true,
        pokemon: { name: "pikachu", url: "https://pokeapi.co/api/v2/pokemon/25/" },
      },
    ],
  },
  pokemon: {
    id: 25,
    name: "pikachu",
    sprites: {
      front_default: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/25.png",
      front_female: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/female/25.png",
      other: {
        home: {
          front_default: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/home/25.png",
          front_female: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/home/female/25.png",
        },
        "official-artwork": {
          front_default: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/25.png",
        },
      },
    },
  },
  forms: [
    {
      id: 10080,
      name: "pikachu-cap-partner",
      form_name: "cap-partner",
      is_default: false,
      is_mega: false,
      is_battle_only: false,
      pokemon: { name: "pikachu", url: "https://pokeapi.co/api/v2/pokemon/25/" },
      names: [
        { language: { name: "zh-Hans" }, name: "搭档帽皮卡丘" },
        { language: { name: "en" }, name: "Pikachu Partner Cap" },
      ],
      sprites: {
        front_default: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/showdown/25-cap-partner.png",
      },
    },
  ],
} as const;
